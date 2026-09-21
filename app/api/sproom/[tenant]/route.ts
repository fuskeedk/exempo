import { NextRequest, NextResponse } from "next/server";
import { getTenant } from "@/lib/platform";
import { enterTenant, prisma } from "@/lib/prisma";
import { ingestPurchase } from "@/lib/sproom";

type Body = {
  id?: string;
  documentId?: string;
  uuid?: string;
  supplierName?: string;
  senderName?: string;
  sender?: { name?: string; vatNumber?: string; cvr?: string };
  supplierCvr?: string;
  invoiceNumber?: string;
  number?: string;
  issueDate?: string;
  issuedAt?: string;
  dueDate?: string;
  dueAt?: string;
  netAmount?: number;
  vatAmount?: number;
  grossAmount?: number;
  amount?: number;
  currency?: string;
  note?: string;
  lines?: Array<{ description?: string; name?: string; quantity?: number; unitPrice?: number; amount?: number }>;
};

function ore(value: unknown): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(n) < 10000 && n % 1 !== 0 ? Math.round(n * 100) : Math.round(n);
}

export async function POST(request: NextRequest, context: { params: Promise<{ tenant: string }> }) {
  const { tenant } = await context.params;
  if (!getTenant(tenant) && tenant !== "exempo") {
    return NextResponse.json({ error: "Ukendt virksomhed" }, { status: 404 });
  }
  enterTenant(tenant);

  const secret = request.headers.get("x-sproom-signature") || request.headers.get("x-webhook-secret") || "";
  const stored = await prisma.setting.findUnique({ where: { key: "sproom_webhook_secret" } });
  if (stored?.value && secret && stored.value !== secret) {
    return NextResponse.json({ error: "Ugyldig signatur" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as Body | Body[] | null;
  if (!payload) return NextResponse.json({ error: "Ugyldigt JSON" }, { status: 400 });
  const docs = Array.isArray(payload) ? payload : [payload];
  const created: string[] = [];
  for (const doc of docs) {
    const sender = doc.sender ?? {};
    const purchase = await ingestPurchase("SPROOM", {
      externalId: String(doc.id ?? doc.documentId ?? doc.uuid ?? `sproom-${Date.now()}`),
      supplierName: doc.supplierName || doc.senderName || sender.name || "Ukendt leverandør",
      supplierCvr: doc.supplierCvr || sender.vatNumber || sender.cvr || "",
      invoiceNumber: doc.invoiceNumber || doc.number || "",
      issuedAt: doc.issueDate || doc.issuedAt || null,
      dueAt: doc.dueDate || doc.dueAt || null,
      netAmount: ore(doc.netAmount),
      vatAmount: ore(doc.vatAmount),
      grossAmount: ore(doc.grossAmount ?? doc.amount),
      currency: doc.currency || "DKK",
      note: doc.note || "",
      lines: (doc.lines ?? []).map((line) => ({
        description: line.description || line.name || "Varelinje",
        quantity: line.quantity ?? 1,
        unitPrice: ore(line.unitPrice),
        amount: ore(line.amount),
      })),
    });
    created.push(purchase.id);
  }
  return NextResponse.json({ ok: true, ids: created });
}
