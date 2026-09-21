import Link from "next/link";
import { AdminTabs } from "@/components/AdminTabs";
import { RevenueChart } from "@/components/RevenueChart";
import { RevenueFilters } from "@/components/RevenueFilters";
import { CoverageBadge, StatusBadge } from "@/components/StatusBadge";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { caseEconomics, rollupEconomics, type CaseEconomics } from "@/lib/coverage";
import { toDateInput } from "@/lib/dates";
import { formatKrDa, percent } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  aggregateRevenue,
  invoiceSignedNet,
  isCostPurchase,
  laborCostOre,
  materialCostOre,
  parseRevenuePeriod,
  revenueRange,
} from "@/lib/revenue";

export default async function EconomyPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; fra?: string; til?: string; leder?: string }>;
}) {
  const user = await requireRole(["ADMIN", "PL"]);
  const params = await searchParams;
  const period = parseRevenuePeriod(params.periode);
  const range = revenueRange(period, params.fra, params.til);
  const leaderId = user.role === "PL" ? user.id : (params.leder ?? "").trim();
  const leaderFilter = leaderId ? { projectLeaderId: leaderId } : undefined;

  const [invoices, timeEntries, materials, purchases, unrelatedPurchases, leaders, cases] = await Promise.all([
    prisma.invoice.findMany({
      where: leaderFilter ? { case: leaderFilter } : undefined,
      include: { lines: true },
    }),
    prisma.timeEntry.findMany({
      where: {
        date: { gte: range.start, lte: range.end },
        ...(leaderFilter ? { case: leaderFilter } : {}),
      },
      select: { hours: true, hourlyRate: true, date: true },
    }),
    prisma.material.findMany({
      where: {
        createdAt: { gte: range.start, lte: range.end },
        ...(leaderFilter ? { case: leaderFilter } : {}),
      },
      select: { quantity: true, unitPrice: true, costPrice: true, createdAt: true },
    }),
    prisma.purchase.findMany({
      where: {
        caseId: { not: null },
        issuedAt: { gte: range.start, lte: range.end },
        ...(leaderFilter ? { case: leaderFilter } : {}),
      },
      select: { netAmount: true, issuedAt: true, status: true },
    }),
    leaderId
      ? Promise.resolve([])
      : prisma.purchase.findMany({
          where: {
            caseId: null,
            issuedAt: { gte: range.start, lte: range.end },
          },
          select: { netAmount: true, issuedAt: true, status: true },
        }),
    prisma.user.findMany({
      where: {
        active: true,
        OR: [{ role: "PL" }, { ledCases: { some: {} } }],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.case.findMany({
      where: user.role === "PL" ? { projectLeaderId: user.id } : leaderId ? { projectLeaderId: leaderId } : undefined,
      include: {
        projectLeader: true,
        invoices: { include: { lines: true } },
        timeEntries: true,
        materials: true,
      },
      orderBy: { caseNumber: "asc" },
    }),
  ]);

  const totals = aggregateRevenue({
    start: range.start,
    end: range.end,
    invoices: invoices.map((invoice) => ({
      status: invoice.status,
      kind: invoice.kind,
      issuedAt: invoice.issuedAt,
      paidAt: invoice.paidAt,
      net: invoiceSignedNet(invoice),
    })),
    costs: [
      ...timeEntries.map((entry) => ({ date: entry.date, amount: laborCostOre(entry) })),
      ...materials.map((material) => ({ date: material.createdAt, amount: materialCostOre(material) })),
      ...purchases
        .filter((purchase) => isCostPurchase(purchase.status) && purchase.issuedAt)
        .map((purchase) => ({ date: purchase.issuedAt as Date, amount: purchase.netAmount })),
    ],
    unrelated: unrelatedPurchases
      .filter((purchase) => isCostPurchase(purchase.status) && purchase.issuedAt)
      .map((purchase) => ({ date: purchase.issuedAt as Date, amount: purchase.netAmount })),
  });

  const rows = cases.map((sag) => ({ sag, economics: caseEconomics(sag) }));
  const byLeader = new Map<string, CaseEconomics[]>();
  for (const row of rows) {
    const key = row.sag.projectLeader?.name ?? "Uden projektleder";
    const current = byLeader.get(key) ?? [];
    current.push(row.economics);
    byLeader.set(key, current);
  }

  const kpis = [
    {
      label: "Omsætning",
      hint: "faktureret, eks. moms",
      value: formatKrDa(totals.invoiced),
      tone: "rev-kpi--invoice",
    },
    {
      label: "Cashflow",
      hint: "betalt, eks. moms",
      value: formatKrDa(totals.cashflow),
      tone: "rev-kpi--cash",
    },
    {
      label: "Omkostninger",
      hint: "sager i perioden",
      value: formatKrDa(totals.costs),
      tone: "rev-kpi--cost",
    },
    {
      label: "Dækningsgrad",
      hint: "periode",
      value: totals.coverage === null ? "—" : percent(totals.coverage).replace(" ", ""),
      tone: "rev-kpi--cover",
    },
    {
      label: "Dækningsbidrag",
      hint: "omsætning − omkostninger",
      value: formatKrDa(totals.contribution),
      tone: "rev-kpi--contrib",
    },
    {
      label: "Ikke ordre-relateret",
      hint: "leverandør, eks. moms",
      value: formatKrDa(totals.unrelated),
      tone: "rev-kpi--unrelated",
    },
  ];

  return (
    <>
      <PageHeader kicker="Administration" title="Omsætning" />
      <AdminTabs />
      <RevenueFilters
        period={period}
        from={params.fra || toDateInput(range.start)}
        to={params.til || toDateInput(range.end)}
        leaderId={leaderId}
        leaders={leaders}
        showLeaders={user.role === "ADMIN"}
      />

      <div className="rev-kpis">
        {kpis.map((kpi) => (
          <article key={kpi.label} className={`rev-kpi ${kpi.tone}`}>
            <p className="rev-kpi-value">{kpi.value}</p>
            <p className="rev-kpi-label">{kpi.label}</p>
            <p className="rev-kpi-hint">{kpi.hint}</p>
          </article>
        ))}
      </div>

      <Card className="rev-panel">
        <h2 className="font-serif text-xl tracking-tight">Omsætning, omkostning og resultat</h2>
        <p className="mt-1 text-sm text-muted">
          Beløb eks. moms pr. måned. Fakturaer = sendte fakturaer. Cashflow = betalte fakturaer.
        </p>
        <RevenueChart months={totals.months} />
      </Card>

      <div className={`mt-6 grid gap-6 ${user.role === "ADMIN" && !leaderId ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Projekt</th>
                {user.role === "ADMIN" ? <th className="px-5 py-3">Projektleder</th> : null}
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Omsætning</th>
                <th className="px-5 py-3">Omk.</th>
                <th className="px-5 py-3">DG</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ sag, economics }) => (
                <tr key={sag.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link href={`/sager/${sag.id}`} className="font-medium hover:underline">
                      {sag.caseNumber}
                    </Link>
                    <p className="text-muted">{sag.title}</p>
                  </td>
                  {user.role === "ADMIN" ? (
                    <td className="px-5 py-3">{sag.projectLeader?.name ?? "—"}</td>
                  ) : null}
                  <td className="px-5 py-3">
                    <StatusBadge state={sag.state} />
                  </td>
                  <td className="px-5 py-3">
                    {formatKrDa(economics.revenue)}
                    {economics.usingEstimate ? <p className="text-xs text-muted">Estimat</p> : null}
                  </td>
                  <td className="px-5 py-3">{formatKrDa(economics.cost)}</td>
                  <td className="px-5 py-3">
                    <CoverageBadge value={economics.coverage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted">Ingen projekter at vise dækningsgrad for.</p>
          ) : null}
        </Card>
        {user.role === "ADMIN" && !leaderId ? (
          <Card>
            <h2 className="font-serif text-xl">Pr. projektleder</h2>
            <ul className="mt-4 space-y-3">
              {[...byLeader.entries()].map(([name, list]) => {
                const rolled = rollupEconomics(list);
                return (
                  <li key={name} className="flex items-center justify-between gap-3 text-sm">
                    <span>{name}</span>
                    <CoverageBadge value={rolled.coverage} />
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
