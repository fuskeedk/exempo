"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole, requireSession } from "@/lib/auth";
import { mailAccountFor, sendMail } from "@/lib/mail";
import { parseKrToOre } from "@/lib/money";
import { nextQuoteNumber } from "@/lib/numbers";
import { buildQuoteEmail, isEmail, quoteEmailMessageId } from "@/lib/quote-email";
import { fetchQuoteReplies } from "@/lib/quote-replies";
import { convertApprovedQuoteToCase, customerQuotePath, ensureQuoteShareToken, newShareToken } from "@/lib/quotes";
import { companyLogoAbsoluteUrl } from "@/lib/logo";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bounce(path: string, message: string): never {
  redirect(`${path}?besked=${encodeURIComponent(message)}`);
}

function linesFromForm(formData: FormData) {
  const descriptions = formData.getAll("lineDescription").map((value) => String(value).trim());
  const kinds = formData.getAll("lineKind").map((value) => String(value));
  const quantities = formData.getAll("lineQuantity").map((value) => String(value));
  const prices = formData.getAll("linePrice").map((value) => String(value));
  const costs = formData.getAll("lineCost").map((value) => String(value));
  return descriptions
    .map((description, index) => ({
      description,
      kind: kinds[index] || "YDELSE",
      quantity: Number.parseFloat(quantities[index]?.replace(",", ".") || "1") || 1,
      unitPrice: parseKrToOre(prices[index] ?? "0"),
      costPrice: parseKrToOre(costs[index] ?? "0"),
    }))
    .filter((line) => line.description);
}

export async function createQuoteAction(formData: FormData) {
  const user = await requireRole(["ADMIN", "PL"]);
  const customerId = str(formData, "customerId");
  const title = str(formData, "title");
  if (!customerId || !title) throw new Error("Kunde og titel er påkrævet.");
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { addresses: true },
  });
  if (!customer) throw new Error("Kunden findes ikke.");
  const requestedAddress = str(formData, "addressId");
  const addressId = customer.addresses.some((item) => item.id === requestedAddress)
    ? requestedAddress
    : customer.addresses[0]?.id;
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: await nextQuoteNumber(),
      customerId,
      addressId,
      title,
      description: str(formData, "description"),
      trade: str(formData, "trade") || "ANDET",
      pricingMode: str(formData, "pricingMode") || "FAST_PRIS",
      createdById: user.id,
      shareToken: newShareToken(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      lines: { create: linesFromForm(formData) },
    },
  });
  revalidatePath("/tilbud");
  redirect(`/tilbud/${quote.id}`);
}

export async function setQuoteStatusAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "quoteId");
  const status = str(formData, "status");
  await ensureQuoteShareToken(id);
  await prisma.quote.update({ where: { id }, data: { status } });
  revalidatePath(`/tilbud/${id}`);
  revalidatePath("/tilbud");
}

export async function convertQuoteToCaseAction(formData: FormData) {
  await requireSession();
  const id = str(formData, "quoteId");
  const result = await convertApprovedQuoteToCase(id);
  if (!result.ok) {
    redirect(`/tilbud/${id}?besked=${encodeURIComponent(result.reason)}`);
  }
  revalidatePath("/sager");
  revalidatePath("/tilbud");
  redirect(`/sager/${result.caseId}`);
}

export async function sendQuoteEmailAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "quoteId");
  const path = `/tilbud/${id}`;
  const quote = await prisma.quote.findUnique({
    where: { id },
    include: { customer: true, address: true, lines: true },
  });
  if (!quote) bounce("/tilbud", "Tilbuddet findes ikke.");
  if (quote.status === "GODKENDT" || quote.status === "AFVIST") {
    bounce(path, "Tilbuddet er allerede afgjort.");
  }
  const to = (str(formData, "to") || quote.customer.email).toLowerCase();
  if (!isEmail(to)) bounce(path, "Kunden har ingen gyldig e-mail. Skriv adressen, før I sender.");
  const profile = await mailAccountFor("TILBUD");
  if (!profile) {
    bounce("/indstillinger", "Tilføj en mailkonto med SMTP under Indstillinger, før I kan sende tilbudsmail.");
  }

  const shareToken = await ensureQuoteShareToken(quote.id);
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") || headerStore.get("host") || "localhost:3000";
  const proto = headerStore.get("x-forwarded-proto") || "https";
  const approveUrl = `${proto}://${host}${customerQuotePath(session.tenantSlug, shareToken)}`;
  const settings = await getSettings();
  const mail = buildQuoteEmail({
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    description: quote.description,
    validUntil: quote.validUntil,
    customerName: quote.customer.name,
    address: quote.address,
    lines: quote.lines,
    companyName: settings.company_name,
    companyEmail: settings.company_email || profile.fromEmail,
    approveUrl,
    logoUrl: companyLogoAbsoluteUrl(`${proto}://${host}`, session.tenantSlug, settings.company_logo),
  });

  const messageId = quoteEmailMessageId(quote.id, profile.fromEmail);
  let sentId = messageId;
  try {
    const sent = await sendMail({
      profile,
      to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      messageId,
    });
    sentId = sent.messageId || messageId;
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Ukendt fejl";
    bounce(path, `Tilbudsmailen kunne ikke sendes: ${reason}`);
  }

  await prisma.quote.update({
    where: { id: quote.id },
    data: { status: "SENDT", emailedAt: new Date(), emailedTo: to, emailedMessageId: sentId },
  });
  revalidatePath(path);
  revalidatePath("/tilbud");
  bounce(path, `Tilbuddet er sendt til ${to}.`);
}

export async function fetchQuoteRepliesAction() {
  await requireRole(["ADMIN", "PL"]);
  const result = await fetchQuoteReplies();
  revalidatePath("/tilbud");
  revalidatePath("/sager");
  if (result.errors.length && result.processed === 0) {
    const path = result.errors[0].includes("IMAP") ? "/indstillinger" : "/tilbud";
    bounce(path, result.errors[0]);
  }
  bounce(
    "/tilbud",
    result.processed
      ? `Hentede ${result.processed} kundesvar${result.skipped ? ` (${result.skipped} sprunget over)` : ""}.`
      : "Ingen nye kundesvar.",
  );
}
