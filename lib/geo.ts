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

export function appleMapsUrl(address: string) {
  const q = address.trim();
  if (!q) return "";
  return `maps://?q=${encodeURIComponent(q)}`;
}
