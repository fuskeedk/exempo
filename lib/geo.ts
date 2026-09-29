export type DawaAdresse = {
  vejnavn?: string;
  husnr?: string;
  etage?: string | null;
  dør?: string | null;
  postnr?: string;
  postnrnavn?: string;
};

export type DawaHit = {
  tekst?: string;
  adresse?: DawaAdresse;
};

export type ParsedAddress = {
  street: string;
  postal: string;
  city: string;
  label: string;
};

export function streetFromDawa(adresse: DawaAdresse | undefined, fallback = "") {
  if (!adresse) return fallback.trim();
  const base = [adresse.vejnavn, adresse.husnr].filter(Boolean).join(" ").trim();
  const floor = adresse.etage ? `${adresse.etage}.` : "";
  const extra = [floor, adresse.dør].filter(Boolean).join(" ").trim();
  if (base && extra) return `${base}, ${extra}`;
  return base || fallback.trim();
}

export function parseDawaSuggestion(hit: DawaHit): ParsedAddress {
  const label = hit.tekst?.trim() || "";
  const street = streetFromDawa(hit.adresse, label.split(",")[0] || "");
  return {
    street,
    postal: hit.adresse?.postnr?.trim() || "",
    city: hit.adresse?.postnrnavn?.trim() || "",
    label: label || [street, hit.adresse?.postnr, hit.adresse?.postnrnavn].filter(Boolean).join(", "),
  };
}

export function formatPlace(parts: Array<string | null | undefined>) {
  return parts.map((part) => (part ?? "").trim()).filter(Boolean).join(", ");
}

export function countryLabel(country: string | null | undefined) {
  const code = (country ?? "").trim().toUpperCase();
  if (!code || code === "DK" || code === "DANMARK") return "Danmark";
  return country?.trim() || "Danmark";
}

export function telHref(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (digits.replace(/\D/g, "").length < 8) return "";
  return `tel:${digits}`;
}

export function mailHref(email: string) {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) return "";
  return `mailto:${trimmed}`;
}

export function googleMapsSearchUrl(address: string) {
  const q = address.trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export type LatLng = { lat: number; lng: number };

export function distanceKm(a: LatLng, b: LatLng) {
  const earth = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function formatKm(km: number) {
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

export function closestHome<T extends LatLng & { name: string }>(point: LatLng, homes: T[]) {
  let best: (T & { km: number }) | null = null;
  for (const home of homes) {
    const km = distanceKm(point, home);
    if (!best || km < best.km) best = { ...home, km };
  }
  return best;
}

export async function geocodeDanishAddress(query: string, fetchImpl: typeof fetch = fetch): Promise<LatLng | null> {
  const q = query.trim();
  if (q.length < 3) return null;
  const response = await fetchImpl(
    `https://api.dataforsyningen.dk/adresser?q=${encodeURIComponent(q)}&per_side=1&srid=4326`,
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Array<{
    adgangsadresse?: { adgangspunkt?: { koordinater?: number[] } };
  }>;
  const point = rows[0]?.adgangsadresse?.adgangspunkt?.koordinater;
  if (!point || point.length < 2) return null;
  const lng = Number(point[0]);
  const lat = Number(point[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function appleMapsUrl(address: string) {
  const q = address.trim();
  if (!q) return "";
  return `maps://?q=${encodeURIComponent(q)}`;
}
