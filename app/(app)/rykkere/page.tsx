import Link from "next/link";
import { createReminderAction } from "@/app/actions/field";
import { AdminTabs } from "@/components/AdminTabs";
import { InvoiceBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { invoiceNet } from "@/lib/coverage";
import { formatDate } from "@/lib/dates";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function RemindersPage() {
  await requireRole(["ADMIN", "PL"]);
  const invoices = await prisma.invoice.findMany({
    where: { status: { in: ["SENDT", "RYKKET", "INKASSO"] }, paidAt: null },
    include: { case: true, reminders: true, lines: true },
    orderBy: { dueAt: "asc" },
  });
  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Rykkere og inkasso"
        description="Send 1., 2. og 3. rykker. Tredje rykker sætter fakturaen i inkasso."
      />
      <AdminTabs />
      <div className="space-y-4">
        {invoices.map((invoice) => {
          const net = invoiceNet(invoice.lines);
          const overdue = invoice.dueAt && invoice.dueAt < new Date();
          return (
            <Card key={invoice.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/fakturaer/${invoice.id}`} className="font-medium hover:underline">
                    {invoice.invoiceNumber}
                  </Link>
                  <p className="text-sm text-muted">
                    {invoice.case.customerName} · {formatKr(net)}
                    {invoice.dueAt ? ` · forfald ${formatDate(invoice.dueAt)}` : ""}
                    {overdue ? " · overskredet" : ""}
                  </p>
                </div>
                <InvoiceBadge status={invoice.status} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {invoice.reminders.length
                  ? `Sendt ${invoice.reminders.length} rykker(e)`
                  : "Ingen rykker sendt endnu"}
              </p>
              <form action={createReminderAction} className="mt-3">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <SubmitButton variant="secondary">
                  {invoice.reminderLevel >= 2 ? "Send til inkasso" : `Send rykker ${(invoice.reminderLevel || 0) + 1}`}
                </SubmitButton>
              </form>
            </Card>
          );
        })}
        {invoices.length === 0 ? <p className="text-sm text-muted">Ingen åbne debitorer.</p> : null}
      </div>
    </>
  );
}
