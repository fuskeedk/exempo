import { prisma } from "@/lib/prisma";

export async function nextCaseNumber(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `EX-${year}-`;
  const latest = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: "desc" },
    select: { caseNumber: true },
  });
  const last = latest ? Number.parseInt(latest.caseNumber.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(last) ? last + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}

export async function nextInvoiceNumber(now = new Date()): Promise<string> {
  const year = now.getFullYear();
  const prefix = `FAK-${year}-`;
  const latest = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const last = latest ? Number.parseInt(latest.invoiceNumber.slice(prefix.length), 10) : 0;
  const next = Number.isFinite(last) ? last + 1 : 1;
  return `${prefix}${String(next).padStart(4, "0")}`;
}
