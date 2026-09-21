import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";
import { requireSession } from "@/lib/auth";
import { CUSTOMER_TYPE_LABELS } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

export default async function CustomersPage() {
  await requireSession();
  const customers = await prisma.customer.findMany({
    include: { addresses: true, _count: { select: { cases: true, quotes: true } } },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        kicker="Kartotek"
        title="Kunder og adresser"
        description="Ét kartotek til kunder, adresser, sager og tilbud."
        tour="tour-page"
      />
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-5 py-3">Kunde</th>
              <th className="px-5 py-3">Type</th>
              <th className="px-5 py-3">Adresse</th>
              <th className="px-5 py-3">Sager</th>
              <th className="px-5 py-3">Tilbud</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((customer) => (
              <tr key={customer.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <Link href={`/kunder/${customer.id}`} className="font-medium hover:underline">
                    {customer.name}
                  </Link>
                  <p className="text-muted">{customer.phone} {customer.email}</p>
                </td>
                <td className="px-5 py-3">
                  {CUSTOMER_TYPE_LABELS[customer.type as keyof typeof CUSTOMER_TYPE_LABELS] ?? customer.type}
                </td>
                <td className="px-5 py-3">
                  {customer.addresses[0]
                    ? `${customer.addresses[0].street}, ${customer.addresses[0].postal} ${customer.addresses[0].city}`
                    : "—"}
                </td>
                <td className="px-5 py-3">{customer._count.cases}</td>
                <td className="px-5 py-3">{customer._count.quotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
