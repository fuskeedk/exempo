import { prisma } from "@/lib/prisma";

export type IncomingPurchase = {
  externalId: string;
  supplierName: string;
  supplierCvr?: string;
  invoiceNumber?: string;
  orderReference?: string;
  issuedAt?: string | Date | null;
  dueAt?: string | Date | null;
  netAmount?: number;
  vatAmount?: number;
  grossAmount?: number;
  currency?: string;
  note?: string;
  fileName?: string;
  caseId?: string | null;
  responsibleUserId?: string | null;
  status?: string;
  lines?: Array<{ description: string; quantity?: number; unitPrice?: number; amount?: number }>;
};

function asDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function ingestPurchase(source: "SPROOM" | "MAIL" | "MANUEL", input: IncomingPurchase) {
  const externalId = input.externalId || `manual-${Date.now()}`;
  const invoiceNumber = (input.invoiceNumber ?? "").trim();
  const existing = await prisma.purchase.findFirst({
    where: {
      source,
      OR: [
        { externalId },
        ...(invoiceNumber.length >= 4 ? [{ invoiceNumber }] : []),
      ],
    },
  });
  if (existing) {
    if (input.caseId && !existing.caseId) {
      return prisma.purchase.update({
        where: { id: existing.id },
        data: {
          caseId: input.caseId,
          orderReference: input.orderReference || existing.orderReference,
          responsibleUserId: input.responsibleUserId ?? existing.responsibleUserId,
          status: input.status || existing.status,
        },
      });
    }
    return existing;
  }

  const lines = input.lines?.length
    ? input.lines
    : [{ description: invoiceNumber || "Leverandørfaktura", quantity: 1, unitPrice: input.grossAmount ?? 0, amount: input.grossAmount ?? 0 }];

  const gross =
    input.grossAmount ??
    lines.reduce((sum, line) => sum + (line.amount ?? Math.round((line.quantity ?? 1) * (line.unitPrice ?? 0))), 0);
  const net = input.netAmount ?? Math.round(gross / 1.25);
  const vat = input.vatAmount ?? gross - net;

  return prisma.purchase.create({
    data: {
      source,
      externalId,
      supplierName: input.supplierName || "Ukendt leverandør",
      supplierCvr: input.supplierCvr ?? "",
      invoiceNumber,
      orderReference: input.orderReference ?? "",
      issuedAt: asDate(input.issuedAt),
      dueAt: asDate(input.dueAt),
      netAmount: net,
      vatAmount: vat,
      grossAmount: gross,
      currency: input.currency || "DKK",
      note: input.note ?? "",
      fileName: input.fileName ?? "",
      caseId: input.caseId || null,
      responsibleUserId: input.responsibleUserId || null,
      status: input.status || "MODTAGET",
      lines: {
        create: lines.map((line) => {
          const quantity = line.quantity ?? 1;
          const unitPrice = line.unitPrice ?? line.amount ?? 0;
          const amount = line.amount ?? Math.round(quantity * unitPrice);
          return {
            description: line.description || "Varelinje",
            quantity,
            unitPrice,
            amount,
          };
        }),
      },
    },
  });
}

export async function fetchSproomInbox(token: string): Promise<IncomingPurchase[]> {
  const url = process.env.SPROOM_API_URL || "https://api.sproom.net/v1/documents?direction=inbound";
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Sproom svarede ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`);
  }
  const payload = (await response.json()) as unknown;
  const list = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items
      : Array.isArray((payload as { documents?: unknown[] }).documents)
        ? (payload as { documents: unknown[] }).documents
        : [];

  return list.map((raw) => {
    const doc = raw as Record<string, unknown>;
    const sender = (doc.sender as Record<string, unknown> | undefined) ?? {};
    const totals = (doc.totals as Record<string, unknown> | undefined) ?? {};
    const lines = Array.isArray(doc.lines) ? (doc.lines as Record<string, unknown>[]) : [];
    return {
      externalId: String(doc.id ?? doc.documentId ?? doc.uuid ?? ""),
      supplierName: String(sender.name ?? doc.supplierName ?? doc.senderName ?? "Ukendt leverandør"),
      supplierCvr: String(sender.vatNumber ?? sender.cvr ?? doc.supplierCvr ?? ""),
      invoiceNumber: String(doc.invoiceNumber ?? doc.number ?? ""),
      issuedAt: (doc.issueDate ?? doc.issuedAt ?? null) as string | null,
      dueAt: (doc.dueDate ?? doc.dueAt ?? null) as string | null,
      netAmount: Math.round(Number(totals.net ?? doc.netAmount ?? 0) * (Number(totals.net ?? 0) < 1000 && Number(totals.net ?? 0) % 1 !== 0 ? 100 : 1)),
      vatAmount: Math.round(Number(totals.vat ?? doc.vatAmount ?? 0)),
      grossAmount: Math.round(Number(totals.gross ?? doc.grossAmount ?? doc.amount ?? 0)),
      currency: String(doc.currency ?? "DKK"),
      lines: lines.map((line) => ({
        description: String(line.description ?? line.name ?? "Varelinje"),
        quantity: Number(line.quantity ?? 1),
        unitPrice: Math.round(Number(line.unitPrice ?? 0)),
        amount: Math.round(Number(line.amount ?? line.total ?? 0)),
      })),
    };
  }).filter((item) => item.externalId);
}
