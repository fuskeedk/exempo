import type { DayPayload, SessionUser } from "./types";

function trimUrl(url: string) {
  return url.trim().replace(/\/+$/, "");
}

async function parseError(response: Response) {
  const data = (await response.json().catch(() => null)) as { error?: string } | null;
  return data?.error || `Fejl ${response.status}`;
}

export async function request<T>(
  apiUrl: string,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const base = trimUrl(apiUrl);
  if (!base) throw new Error("Sæt serveradressen under Indstillinger.");
  const headers = new Headers(init.headers);
  if (init.token) headers.set("Authorization", `Bearer ${init.token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${base}${path}`, { ...init, headers });
  if (!response.ok) throw new Error(await parseError(response));
  return (await response.json()) as T;
}

export async function checkHealth(apiUrl: string) {
  return request<{ ok: boolean; name: string; version: string }>(apiUrl, "/api/mobile/health");
}

export async function login(apiUrl: string, email: string, password: string) {
  return request<{ token: string; user: SessionUser }>(apiUrl, "/api/mobile/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function fetchDay(apiUrl: string, token: string) {
  return request<DayPayload>(apiUrl, "/api/mobile/day", { token });
}

export async function setTimer(apiUrl: string, token: string, action: "start" | "stop", caseId?: string) {
  return request<{ ok: true; running: boolean; hours?: number }>(apiUrl, "/api/mobile/timer", {
    method: "POST",
    token,
    body: JSON.stringify({ action, caseId }),
  });
}

export async function addMaterial(
  apiUrl: string,
  token: string,
  input: { caseId: string; productId?: string; barcode?: string; quantity: string },
) {
  return request<{ ok: true; name: string; quantity: number }>(apiUrl, "/api/mobile/materials", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function addExtraWork(
  apiUrl: string,
  token: string,
  input: { caseId: string; title: string; description: string; amount: string },
) {
  return request<{ ok: true }>(apiUrl, "/api/mobile/extra-work", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function addAbsence(
  apiUrl: string,
  token: string,
  input: { date: string; type: string; hours: string; note: string },
) {
  return request<{ ok: true }>(apiUrl, "/api/mobile/absence", {
    method: "POST",
    token,
    body: JSON.stringify(input),
  });
}

export async function uploadPhoto(apiUrl: string, token: string, caseId: string, uri: string) {
  const body = new FormData();
  body.append("caseId", caseId);
  body.append("file", {
    uri,
    name: "foto.jpg",
    type: "image/jpeg",
  } as unknown as Blob);
  return request<{ ok: true; id: string }>(apiUrl, "/api/mobile/photos", {
    method: "POST",
    token,
    body,
  });
}
