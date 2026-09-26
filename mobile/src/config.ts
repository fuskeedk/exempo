export const DEFAULT_API_URL = "https://exempo.jbnet.dk";

export function resolveApiUrl(value?: string | null) {
  const next = (value ?? "").trim().replace(/\/+$/, "");
  return next || DEFAULT_API_URL;
}

export function describeNetworkError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (/network request failed|failed to fetch|load failed|network error/i.test(message)) {
    return "Kunne ikke nå Exempo-serveren. Tjek at iPhonen har internet, og at serveren under Indstillinger er https://exempo.jbnet.dk.";
  }
  return message || "Noget gik galt.";
}
