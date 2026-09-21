import { loadVanAction, returnVanAction } from "@/app/actions/van";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { canManageOffice, requireSession } from "@/lib/auth";
import { requireVanStock } from "@/lib/modules";
import { prisma } from "@/lib/prisma";

export default async function VanStockPage({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string }>;
}) {
  const session = await requireSession();
  await requireVanStock(session);
  const { besked } = await searchParams;
  const office = canManageOffice(session.role);
  const [staff, products, rows] = await Promise.all([
    office
      ? prisma.user.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })
      : Promise.resolve([]),
    prisma.product.findMany({
      where: { active: true, group: { not: "YDELSE" } },
      orderBy: { name: "asc" },
    }),
    prisma.vanStock.findMany({
      where: office ? undefined : { userId: session.id },
      include: { user: { select: { name: true } }, product: true },
      orderBy: [{ user: { name: "asc" } }, { product: { name: "asc" } }],
    }),
  ]);

  return (
    <>
      <PageHeader
        kicker="Lager"
        title="Vognlager"
        description="Læg varer fra lageret ud i bilen. På sagen trækkes der fra vognen, ikke fra hovedlageret."
      />
      <Flash message={besked} />
      {office ? (
        <Card className="mb-6">
          <h2 className="font-serif text-xl">Læg på vogn</h2>
          <form action={loadVanAction} className="mt-4 grid gap-3 sm:grid-cols-4">
            <Field label="Medarbejder">
              <Select name="userId" required defaultValue={session.id}>
                {staff.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Vare">
              <Select name="productId" required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name} ({product.stock} på lager)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Antal">
              <Input name="quantity" defaultValue="1" />
            </Field>
            <div className="flex items-end">
              <SubmitButton>Læg på vogn</SubmitButton>
            </div>
          </form>
        </Card>
      ) : null}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wider text-muted">
            <tr>
              {office ? <th className="px-5 py-3">Medarbejder</th> : null}
              <th className="px-5 py-3">Vare</th>
              <th className="px-5 py-3">På vogn</th>
              {office ? <th className="px-5 py-3" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.filter((row) => row.quantity > 0).map((row) => (
              <tr key={row.id} className="border-t border-line">
                {office ? <td className="px-5 py-3">{row.user.name}</td> : null}
                <td className="px-5 py-3">
                  {row.product.name}
                  <p className="text-muted">{row.product.sku}</p>
                </td>
                <td className="px-5 py-3">{String(row.quantity).replace(".", ",")}</td>
                {office ? (
                  <td className="px-5 py-3 text-right">
                    <form action={returnVanAction} className="inline-flex items-center gap-2">
                      <input type="hidden" name="id" value={row.id} />
                      <Input name="quantity" defaultValue={String(row.quantity)} className="w-20" />
                      <SubmitButton variant="secondary">Tilbage på lager</SubmitButton>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
        {rows.filter((row) => row.quantity > 0).length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted">Ingen varer på vognen.</p>
        ) : null}
      </Card>
    </>
  );
}
