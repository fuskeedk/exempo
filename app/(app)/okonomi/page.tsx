import Link from "next/link";
import { CoverageBadge, StatusBadge } from "@/components/StatusBadge";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { caseEconomics, rollupEconomics, type CaseEconomics } from "@/lib/coverage";
import { formatKr, percent } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function EconomyPage() {
  await requireRole(["ADMIN", "PL"]);
  const cases = await prisma.case.findMany({
    include: {
      assignedTo: true,
      invoices: { include: { lines: true } },
      timeEntries: true,
      materials: true,
    },
    orderBy: { caseNumber: "asc" },
  });
  const rows = cases.map((sag) => ({ sag, economics: caseEconomics(sag) }));
  const totals = rollupEconomics(rows.map((row) => row.economics));
  const byWorker = new Map<string, CaseEconomics[]>();
  for (const row of rows) {
    const key = row.sag.assignedTo?.name ?? "Ikke tildelt";
    const current = byWorker.get(key) ?? [];
    current.push(row.economics);
    byWorker.set(key, current);
  }

  return (
    <>
      <PageHeader
        kicker="Økonomi"
        title="Dækningsgrad"
        description="DG = (omsætning − direkte omkostninger) / omsætning. Omsætning er sendt/betalt faktura, ellers estimat."
      />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted">Omsætning</p>
          <p className="mt-2 font-serif text-3xl">{formatKr(totals.revenue)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted">Direkte omk.</p>
          <p className="mt-2 font-serif text-3xl">{formatKr(totals.cost)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted">Dækningsbidrag</p>
          <p className="mt-2 font-serif text-3xl">{formatKr(totals.contribution)}</p>
        </Card>
        <Card>
          <p className="text-xs uppercase tracking-wider text-muted">Dækningsgrad</p>
          <p className="mt-2 font-serif text-3xl">
            {totals.coverage === null ? "—" : percent(totals.coverage)}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Sag</th>
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
                  <td className="px-5 py-3">
                    <StatusBadge state={sag.state} />
                  </td>
                  <td className="px-5 py-3">
                    {formatKr(economics.revenue)}
                    {economics.usingEstimate ? (
                      <p className="text-xs text-muted">Estimat</p>
                    ) : null}
                  </td>
                  <td className="px-5 py-3">{formatKr(economics.cost)}</td>
                  <td className="px-5 py-3">
                    <CoverageBadge value={economics.coverage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="font-serif text-xl">Pr. medarbejder</h2>
          <ul className="mt-4 space-y-3">
            {[...byWorker.entries()].map(([name, list]) => {
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
      </div>
    </>
  );
}
