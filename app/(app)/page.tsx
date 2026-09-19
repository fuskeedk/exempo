import Link from "next/link";
import { CoverageBadge, StatusBadge } from "@/components/StatusBadge";
import { Card, PageHeader, PrimaryLink } from "@/components/ui";
import { canManageOffice, requireSession } from "@/lib/auth";
import { TRADE_LABELS, isTrade } from "@/lib/catalog";
import { caseEconomics, rollupEconomics } from "@/lib/coverage";
import { ACTIVE_PIPELINE, STATE_LABELS, type CaseState } from "@/lib/fsm";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await requireSession();
  const office = canManageOffice(user.role);

  const cases = await prisma.case.findMany({
    where: office ? undefined : { assignedToId: user.id },
    include: {
      assignedTo: true,
      invoices: { include: { lines: true } },
      timeEntries: true,
      materials: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const rows = cases.map((sag) => ({
    sag,
    economics: caseEconomics(sag),
  }));
  const totals = rollupEconomics(rows.map((row) => row.economics));
  const open = cases.filter((sag) => !["AFSLUTTET", "ANNULLERET"].includes(sag.state));

  const [openQuotes, pendingExtra, overdueInvoices] = office
    ? await Promise.all([
        prisma.quote.count({ where: { status: "SENDT" } }),
        prisma.extraWork.count({ where: { status: "SENDT" } }),
        prisma.invoice.count({
          where: {
            status: { in: ["SENDT", "RYKKET", "INKASSO"] },
            paidAt: null,
            dueAt: { lt: new Date() },
          },
        }),
      ])
    : [0, 0, 0];

  const columns = ACTIVE_PIPELINE.map((state) => ({
    state,
    items: cases.filter((sag) => sag.state === state),
  }));

  return (
    <>
      <PageHeader
        kicker="Overblik"
        title={office ? "Ordrer i pipeline" : "Dine arbejdssedler"}
        description="Fra tilbud og nye sager til udførelse, KLS og faktura — samme flow som i Minuba."
        actions={office ? <PrimaryLink href="/sager/ny">Ny sag</PrimaryLink> : null}
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Åbne sager" value={String(open.length)} />
        <Stat label="Omsætning" value={formatKr(totals.revenue)} hint={totals.usingEstimate ? "Inkl. estimater" : "Faktureret"} />
        <Stat label="Direkte omkostninger" value={formatKr(totals.cost)} />
        <Stat
          label="Dækningsgrad"
          value={totals.coverage === null ? "—" : `${(Math.round(totals.coverage * 1000) / 10).toString().replace(".", ",")} %`}
        />
      </div>

      {office ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <Link href="/tilbud" className="block">
            <Stat label="Tilbud afventer" value={String(openQuotes)} hint="Sendt til kunden" />
          </Link>
          <Link href="/sager" className="block">
            <Stat label="Ekstraarbejde" value={String(pendingExtra)} hint="Sendt, mangler godkendelse" />
          </Link>
          <Link href="/rykkere" className="block">
            <Stat label="Forfaldne fakturaer" value={String(overdueInvoices)} hint="Rykkere og inkasso" />
          </Link>
        </div>
      ) : null}

      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex min-w-[1100px] gap-3">
          {columns.map((column) => (
            <div key={column.state} className="w-44 shrink-0 rounded-2xl bg-[#efe8da] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  {STATE_LABELS[column.state as CaseState]}
                </p>
                <span className="text-xs text-muted">{column.items.length}</span>
              </div>
              <div className="space-y-2">
                {column.items.map((sag) => (
                  <Link
                    key={sag.id}
                    href={`/sager/${sag.id}`}
                    className="block rounded-xl bg-paper-2 p-3 shadow-sm hover:ring-2 hover:ring-pine/20"
                  >
                    <p className="text-[11px] text-muted">{sag.caseNumber}</p>
                    <p className="mt-1 text-sm font-medium leading-snug">{sag.title}</p>
                    <p className="mt-2 text-xs text-muted">
                      {sag.assignedTo?.name ?? "Ikke tildelt"}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <h2 className="mb-4 font-serif text-xl">Seneste sager</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="pb-2">Sag</th>
                <th className="pb-2">Kunde</th>
                <th className="pb-2">Fag</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">DG</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map(({ sag, economics }) => (
                <tr key={sag.id} className="border-t border-line">
                  <td className="py-3">
                    <Link href={`/sager/${sag.id}`} className="font-medium hover:underline">
                      {sag.caseNumber}
                      <span className="block text-muted font-normal">{sag.title}</span>
                    </Link>
                  </td>
                  <td>{sag.customerName}</td>
                  <td>{isTrade(sag.trade) ? TRADE_LABELS[sag.trade] : sag.trade}</td>
                  <td>
                    <StatusBadge state={sag.state} />
                  </td>
                  <td>
                    <CoverageBadge value={economics.coverage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-serif text-3xl">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </Card>
  );
}
