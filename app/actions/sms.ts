"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { formatTime } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { customerSmsText, sendGatewaySms, type SmsKind } from "@/lib/sms";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function go(next: string, message: string, error = false): never {
  const target = next.startsWith("/") ? next : "/min-dag";
  const join = target.includes("?") ? "&" : "?";
  const key = error ? "fejl" : "besked";
  redirect(`${target}${join}${key}=${encodeURIComponent(message)}`);
}

export async function sendCaseSmsAction(formData: FormData) {
  const user = await requireSession();
  const caseId = str(formData, "caseId");
  const next = str(formData, "next") || (caseId ? `/sager/${caseId}` : "/min-dag");
  const kind: SmsKind = str(formData, "kind") === "paa_vej" ? "paa_vej" : "idag";
  const sag = await prisma.case.findUnique({
    where: { id: caseId },
    include: { assignedTo: { select: { name: true } } },
  });
  if (!sag) go(next, "Sagen findes ikke.", true);
  if (!sag.customerPhone.trim()) go(next, "Kunden har ikke et telefonnummer.", true);

  const settings = await getSettings();
  const message = customerSmsText(kind, {
    customerName: sag.customerName,
    company: settings.company_name,
    worker: sag.assignedTo?.name || user.name,
    from: sag.scheduledStart ? formatTime(sag.scheduledStart) : undefined,
    to: sag.scheduledEnd ? formatTime(sag.scheduledEnd) : undefined,
  });
  const sent = await sendGatewaySms({
    token: settings.sms_token,
    sender: settings.sms_sender || settings.company_name,
    to: sag.customerPhone,
    message,
  });
  if (!sent.ok) go(next, sent.reason, true);

  await prisma.caseEvent.create({
    data: {
      caseId,
      fromState: sag.state,
      toState: sag.state,
      note: kind === "paa_vej" ? "SMS sendt: på vej." : "SMS sendt: vi kommer i dag.",
      userId: user.id,
    },
  });
  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/min-dag");
  go(next, kind === "paa_vej" ? "SMS sendt: på vej." : "SMS sendt: i dag.");
}
