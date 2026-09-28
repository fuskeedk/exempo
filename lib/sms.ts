export type SmsKind = "idag" | "paa_vej";

export function msisdn(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 8) return `45${digits}`;
  if (digits.startsWith("45") && digits.length === 10) return digits;
  if (digits.length >= 10 && digits.length <= 15) return digits;
  return null;
}

export function smsSender(name: string) {
  const cleaned = name.replace(/[^A-Za-z0-9ÆØÅæøå ]/g, "").trim();
  return (cleaned || "Exempo").slice(0, 11);
}

export function customerSmsText(
  kind: SmsKind,
  input: { customerName: string; company: string; worker: string; from?: string; to?: string },
) {
  const who = input.customerName.trim().split(" ")[0] || "Hej";
  const company = input.company.trim() || "Vi";
  if (kind === "paa_vej") {
    const worker = input.worker.trim() || "Montøren";
    return `Hej ${who}. ${worker} er på vej. ${company}`;
  }
  const slot = input.from && input.to ? ` mellem ${input.from} og ${input.to}` : " i dag";
  return `Hej ${who}. Vi kommer${slot}. ${company}`;
}

export async function sendGatewaySms(
  input: { token: string; sender: string; to: string; message: string },
  fetchImpl: typeof fetch = fetch,
) {
  const recipient = msisdn(input.to);
  if (!recipient) return { ok: false as const, reason: "Telefonnummeret kan ikke bruges til SMS." };
  if (!input.token.trim()) return { ok: false as const, reason: "SMS er ikke sat op." };
  const response = await fetchImpl("https://gatewayapi.com/rest/mtsms", {
    method: "POST",
    headers: {
      Authorization: `Token ${input.token.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      sender: smsSender(input.sender),
      message: input.message.slice(0, 459),
      recipients: [{ msisdn: Number(recipient) }],
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180);
    return { ok: false as const, reason: detail || "SMS kunne ikke sendes." };
  }
  return { ok: true as const };
}
