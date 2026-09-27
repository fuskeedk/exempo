export type AoAuthFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

export type AoCredentials = {
  username: string;
  password: string;
  account?: string;
};

const AO_ORIGIN = "https://ao.dk";
const SESSION_MS = 15 * 60 * 1000;

type CachedSession = {
  cookie: string;
  expiresAt: number;
};

const sessions = new Map<string, CachedSession>();
const inflight = new Map<string, Promise<string | null>>();

export function resetAoSessions() {
  sessions.clear();
  inflight.clear();
}

export function canLoginAo(auth?: AoCredentials | null) {
  return Boolean(auth?.username?.trim() && auth?.password);
}

export function aoLoginPayload(auth: Pick<AoCredentials, "username" | "password">) {
  return {
    Brugernavn: auth.username.trim(),
    Password: auth.password,
    HuskLogin: false,
    LoginKanal: "Web",
  };
}

function sessionKey(auth: AoCredentials) {
  return `${auth.username.trim()}\n${auth.account?.trim() ?? ""}`;
}

function requestUrl(input: string | URL) {
  return String(input);
}

export function mergeAoCookies(previous: string, response: Response) {
  const jar = new Map<string, string>();
  for (const part of previous.split(";")) {
    const pair = part.trim();
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1));
  }
  const incoming =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];
  for (const raw of incoming) {
    if (!raw) continue;
    const pair = raw.split(";", 1)[0] ?? "";
    const eq = pair.indexOf("=");
    if (eq <= 0) continue;
    const name = pair.slice(0, eq).trim();
    if (!name || /^expires$/i.test(name) || /^path$/i.test(name)) continue;
    jar.set(name, pair.slice(eq + 1));
  }
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function aoHeaders(cookie = ""): HeadersInit {
  return {
    Accept: "application/json",
    Origin: AO_ORIGIN,
    Referer: `${AO_ORIGIN}/kunde/log-ind-side`,
    ...(cookie ? { Cookie: cookie } : {}),
  };
}

async function readJson(response: Response) {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

async function warmCookies(fetchImpl: AoAuthFetch) {
  try {
    const response = await fetchImpl(`${AO_ORIGIN}/kunde/log-ind-side`, {
      headers: { Accept: "text/html", Referer: `${AO_ORIGIN}/` },
      signal: AbortSignal.timeout(8_000),
    });
    return mergeAoCookies("", response);
  } catch {
    return "";
  }
}

async function loginAo(auth: AoCredentials, fetchImpl: AoAuthFetch) {
  let cookie = await warmCookies(fetchImpl);
  const loginUrl = `${AO_ORIGIN}/api/v2/bruger/ValiderBruger`;
  assertNoSecretInUrl(loginUrl, auth.password);
  const response = await fetchImpl(loginUrl, {
    method: "POST",
    headers: {
      ...aoHeaders(cookie),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(aoLoginPayload(auth)),
    signal: AbortSignal.timeout(12_000),
  });
  cookie = mergeAoCookies(cookie, response);
  const payload = await readJson(response);
  const status =
    payload && typeof payload === "object" && "Status" in payload
      ? Boolean((payload as { Status?: unknown }).Status)
      : false;
  if (!response.ok || !status || !cookie.includes(".EPiServerLogin=")) return null;
  if (auth.account?.trim()) {
    try {
      const select = await fetchImpl(`${AO_ORIGIN}/api/v2/Pris/VaelgPrisKonto`, {
        method: "POST",
        headers: {
          ...aoHeaders(cookie),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(auth.account.trim()),
        signal: AbortSignal.timeout(8_000),
      });
      cookie = mergeAoCookies(cookie, select);
    } catch {
      /* default account from login is still usable */
    }
  }
  return cookie;
}

export async function ensureAoSession(auth: AoCredentials, fetchImpl: AoAuthFetch) {
  if (!canLoginAo(auth)) return null;
  const key = sessionKey(auth);
  const cached = sessions.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.cookie;
  const pending = inflight.get(key);
  if (pending) return pending;
  const work = loginAo(auth, fetchImpl)
    .then((cookie) => {
      if (cookie) {
        sessions.set(key, { cookie, expiresAt: Date.now() + SESSION_MS });
      } else {
        sessions.delete(key);
      }
      return cookie;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, work);
  return work;
}

export async function aoAuthedPost(
  path: string,
  body: unknown,
  auth: AoCredentials,
  fetchImpl: AoAuthFetch,
) {
  const firstCookie = await ensureAoSession(auth, fetchImpl);
  if (!firstCookie) return null;
  const url = new URL(path, AO_ORIGIN);
  assertNoSecretInUrl(url, auth.password);
  const post = async (cookie: string) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        ...aoHeaders(cookie),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    return response;
  };
  let response = await post(firstCookie);
  if (response.status === 401) {
    sessions.delete(sessionKey(auth));
    const retryCookie = await ensureAoSession(auth, fetchImpl);
    if (!retryCookie) return null;
    response = await post(retryCookie);
  }
  if (!response.ok) return null;
  return readJson(response);
}

export function assertNoSecretInUrl(input: string | URL, secret: string) {
  if (!secret) return;
  if (requestUrl(input).includes(secret)) {
    throw new Error("AO-adgangskode må ikke sendes i URL.");
  }
}
