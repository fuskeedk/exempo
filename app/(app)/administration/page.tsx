import Link from "next/link";
import { AdminTabs } from "@/components/AdminTabs";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { caseEconomics, rollupEconomics } from "@/lib/coverage";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function AdministrationPage() {
  const user = await requireRole(["ADMIN", "PL"]);

  const [employeeCount, invoiceCount, openDebt, cases, purchaseCount, pendingPurchases] = await Promise.all([
    prisma.user.count({ where: { active: true } }),
    prisma.invoice.count(),
    prisma.invoice.count({
      where: { status: { in: ["SENDT", "RYKKET", "INKASSO"] }, paidAt: null },
    }),
    prisma.case.findMany({
      where: user.role === "PL" ? { projectLeaderId: user.id } : undefined,
      include: {
        invoices: { include: { lines: true } },
        timeEntries: true,
        materials: true,
      },
    }),
    prisma.purchase.count(),
    prisma.purchase.count({ where: { status: { in: ["MODTAGET", "AFVENTER"] } } }),
  ]);

  const totals = rollupEconomics(cases.map((sag) => caseEconomics(sag)));

  const tiles = [
    {
      href: "/medarbejdere",
      label: "Medarbejdere",
      value: String(employeeCount),
      hint: "Aktive logins — redigér navn, rolle, fag og timepris",
    },
    {
      href: "/okonomi",
      label: "Omsætning",
      value: formatKr(totals.revenue),
      hint: user.role === "PL" ? "Omsætning på dine projekter" : totals.usingEstimate ? "Inkl. estimater" : "Faktureret",
    },
    {
      href: "/fakturaer",
      label: "Fakturaer",
      value: String(invoiceCount),
      hint: "Alle udstedte fakturaer",
    },
    {
      href: "/rykkere",
      label: "Rykkere",
      value: String(openDebt),
      hint: "Åbne debitorer uden betaling",
    },
    {
      href: "/indkob",
      label: "Indkøb",
      value: String(purchaseCount),
      hint: pendingPurchases ? `${pendingPurchases} afventer godkendelse` : "Leverandørfakturaer til sager",
    },
    {
      href: "/lon",
      label: "Løn",
      value: "Timesedler",
      hint: "Godkend timer og eksportér til Excel, Danløn eller Dataløn",
    },
    {
      href: "/indstillinger",
      label: "Indstillinger",
      value: "Opsætning",
      hint: "Sproom, løn, bogføring, mail og sagsnumre",
    },
  ];

  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Kontoret"
        description="Medarbejdere, løn, omsætning, fakturaer, rykkere, indkøb og indstillinger."
      />
      <AdminTabs />
      <div className="grid gap-4 sm:grid-cols-2">
        {tiles.map((tile) => (
          <Link key={tile.href} href={tile.href} className="block">
            <Card className="h-full transition hover:border-pine/30">
              <p className="text-xs uppercase tracking-wider text-muted">{tile.label}</p>
              <p className="mt-2 font-serif text-3xl">{tile.value}</p>
              <p className="mt-2 text-sm text-muted">{tile.hint}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
