import { notFound } from "next/navigation";
import {
  addPurchaseFollowUpAction,
  approvePurchaseAction,
  assignPurchaseAction,
  overheadPurchaseAction,
  rejectPurchaseAction,
} from "@/app/actions/purchases";
import { AdminTabs } from "@/components/AdminTabs";
import { PurchaseResponsible } from "@/components/PurchaseInboxClient";
import { PurchaseBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, GhostLink, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDate, formatNumericDateTime } from "@/lib/dates";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { purchaseOrderReference, purchaseRoleTag } from "@/lib/purchases";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["ADMIN", "PL"]);
  const { id } = await params;
  const [purchase, cases, staff] = await Promise.all([
    prisma.purchase.findUnique({
      where: { id },
      include: { case: true, lines: true, approvedBy: true, responsibleUser: true },
    }),
    prisma.case.findMany({
      select: { id: true, caseNumber: true, title: true },
      orderBy: { caseNumber: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "PL"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!purchase) notFound();
  const open = purchase.status === "MODTAGET" || purchase.status === "DELVIST" || purchase.status === "AFVENTER";

  return (
    <>
      <PageHeader
        kicker="Indkøb"
        title={purchase.supplierName}
        description={`${purchase.invoiceNumber || "Uden fakturanr."} · ${formatKr(purchase.grossAmount, true)}`}
        actions={<GhostLink href="/indkob">Tilbage</GhostLink>}
      />
      <AdminTabs />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <PurchaseBadge status={purchase.status} />
            <p className="text-sm text-muted">{purchase.source}</p>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">CVR</dt>
              <dd>{purchase.supplierCvr || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Fakturadato</dt>
              <dd>{purchase.issuedAt ? formatDate(purchase.issuedAt) : "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Modtaget</dt>
              <dd>{formatNumericDateTime(purchase.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">Ordrereference</dt>
              <dd>{purchaseOrderReference(purchase) || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted">Netto</dt>
              <dd>{formatKr(purchase.netAmount, true)}</dd>
            </div>
            <div>
              <dt className="text-muted">Moms</dt>
              <dd>{formatKr(purchase.vatAmount, true)}</dd>
            </div>
          </dl>
          <table className="mt-6 w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="py-2">Linje</th>
                <th className="py-2">Antal</th>
                <th className="py-2">Beløb</th>
              </tr>
            </thead>
            <tbody>
              {purchase.lines.map((line) => (
                <tr key={line.id} className="border-t border-line">
                  <td className="py-2">{line.description}</td>
                  <td className="py-2">{line.quantity}</td>
                  <td className="py-2">{formatKr(line.amount, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="font-serif text-xl">Sag og godkendelse</h2>
          {purchase.case ? (
            <p className="mt-2 text-sm">
              Sat på{" "}
              <a className="underline" href={`/sager/${purchase.case.id}`}>
                {purchase.case.caseNumber} · {purchase.case.title}
              </a>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted">Ikke matchet til en sag endnu.</p>
          )}
          {open ? (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted">Ansvarlig</p>
                <PurchaseResponsible
                  purchaseId={purchase.id}
                  tab="indkomne"
                  currentId={purchase.responsibleUserId ?? ""}
                  currentLabel={
                    purchase.responsibleUser
                      ? `${purchase.responsibleUser.name} (${purchaseRoleTag(purchase.responsibleUser.role)})`
                      : ""
                  }
                  staff={staff}
                />
              </div>
              <form action={assignPurchaseAction} className="space-y-2">
                <input type="hidden" name="id" value={purchase.id} />
                <Select name="caseId" defaultValue={purchase.caseId ?? ""}>
                  <option value="">Ingen sag</option>
                  {cases.map((sag) => (
                    <option key={sag.id} value={sag.id}>
                      {sag.caseNumber} · {sag.title}
                    </option>
                  ))}
                </Select>
                <SubmitButton variant="secondary">Sæt på sag</SubmitButton>
              </form>
              <form action={addPurchaseFollowUpAction} className="space-y-2">
                <input type="hidden" name="id" value={purchase.id} />
                <Textarea name="note" rows={2} defaultValue={purchase.followUpNote} placeholder="Opfølgning" />
                <SubmitButton variant="ghost">Gem opfølgning</SubmitButton>
              </form>
              <form action={approvePurchaseAction}>
                <input type="hidden" name="id" value={purchase.id} />
                {purchase.caseId ? (
                  <SubmitButton>Godkend og belast sag</SubmitButton>
                ) : (
                  <p className="text-sm text-muted">Sæt fakturaen på en sag, før du godkender.</p>
                )}
              </form>
              <form action={overheadPurchaseAction}>
                <input type="hidden" name="id" value={purchase.id} />
                <SubmitButton variant="secondary">Godkend som drift</SubmitButton>
              </form>
              <form action={rejectPurchaseAction} className="space-y-2">
                <input type="hidden" name="id" value={purchase.id} />
                <Textarea name="note" rows={2} placeholder="Årsag til afvisning" />
                <SubmitButton variant="ghost">Afvis</SubmitButton>
              </form>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">
              {purchase.approvedBy ? `Afgjort af ${purchase.approvedBy.name}.` : "Låst."}
            </p>
          )}
          {purchase.note ? <p className="mt-4 text-sm">{purchase.note}</p> : null}
          {purchase.followUpNote ? <p className="mt-2 text-sm text-muted">Opfølgning: {purchase.followUpNote}</p> : null}
        </Card>
      </div>
    </>
  );
}
