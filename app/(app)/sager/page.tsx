import Link from "next/link";
import { CoverageBadge, StatusBadge } from "@/components/StatusBadge";
import { Card, PageHeader, PrimaryLink, Select } from "@/components/ui";
import { canManageOffice, requireSession } from "@/lib/auth";
import { TRADE_LABELS, isTrade } from "@/lib/catalog";
import { caseEconomics } from "@/lib/coverage";
import { CASE_STATES, STATE_LABELS, isCaseState } from "@/lib/fsm";
import { prisma } from "@/lib/prisma";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; q?: string }>;
}) {
  const user = await requireSession();
  const { state, q } = await searchParams;
  const office = canManageOffice(user.role);

  const cases = await prisma.case.findMany({
    where: {
      AND: [
        office ? {} : { assignedToId: user.id },
        state && isCaseState(state) ? { state } : {},
        q
          ? {
              OR: [
                { title: { contains: q } },
                { caseNumber: { contains: q } },
                { customerName: { contains: q } },
                { claimNumber: { contains: q } },
              ],
            }
          : {},
      ],
    },
    include: {
      assignedTo: true,
      invoices: { include: { lines: true } },
      timeEntries: true,
      materials: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <>
      <PageHeader
        kicker="Sager"
        title="Alle sager"
        description="Opret, filtrér og følg sager gennem FSM-statusserne."
        actions={office ? <PrimaryLink href="/sager/ny">Opret sag</PrimaryLink> : null}
      />
      <form className="mb-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q}
          placeholder="Søg på sag, kunde eller skadenr."
          className="w-full max-w-sm rounded-xl border border-line bg-white px-3 py-2.5"
        />
        <Select name="state" defaultValue={state ?? ""}>
          <option value="">Alle statusser</option>
          {CASE_STATES.map((item) => (
            <option key={item} value={item}>
              {STATE_LABELS[item]}
            </option>
          ))}
        </Select>
        <button className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold">
          Filtrér
        </button>
      </form>
      <div className="cases-cards">
        {cases.length === 0 ? (
          <p className="rounded-2xl border border-line bg-paper-2 px-5 py-8 text-sm text-muted">
            Ingen sager matcher filteret.
          </p>
        ) : null}
        {cases.map((sag) => {
          const economics = caseEconomics(sag);
          return (
            <Link
              key={sag.id}
              href={`/sager/${sag.id}`}
              className="block rounded-2xl border border-line bg-paper-2 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{sag.caseNumber}</p>
                  <p className="text-sm text-muted">{sag.title}</p>
                </div>
                <StatusBadge state={sag.state} />
              </div>
              <p className="mt-2 text-sm">
                {sag.customerName}
                <span className="block text-muted">
                  {sag.customerAddress}, {sag.customerCity}
                </span>
              </p>
              <p className="mt-2 text-sm text-muted">{sag.assignedTo?.name ?? "—"}</p>
              <div className="mt-2">
                <CoverageBadge value={economics.coverage} />
              </div>
            </Link>
          );
        })}
      </div>
      <Card className="cases-table overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Sag</th>
              <th className="px-5 py-3">Kunde / sted</th>
              <th className="px-5 py-3">Medarbejder</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">DG</th>
            </tr>
          </thead>
          <tbody>
            {cases.map((sag) => {
              const economics = caseEconomics(sag);
              return (
                <tr key={sag.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <Link href={`/sager/${sag.id}`} className="font-medium hover:underline">
                      {sag.caseNumber}
                      <span className="block text-muted font-normal">{sag.title}</span>
                    </Link>
                  </td>
                  <td className="px-5 py-3">
                    {sag.customerName}
                    <p className="text-muted">
                      {sag.customerAddress}, {sag.customerCity}
                    </p>
                  </td>
                  <td className="px-5 py-3">{sag.assignedTo?.name ?? "—"}</td>
                  <td className="px-5 py-3">
                    <StatusBadge state={sag.state} />
                  </td>
                  <td className="px-5 py-3">
                    <CoverageBadge value={economics.coverage} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {cases.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">Ingen sager matcher filteret.</p>
        ) : null}
      </Card>
      <p className="mt-3 text-xs text-muted">
        Fag: {Object.values(TRADE_LABELS).join(" · ")}
        {cases[0] && isTrade(cases[0].trade) ? "" : ""}
      </p>
    </>
  );
}
