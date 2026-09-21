import { createProductAction } from "@/app/actions/products";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { requireProductCatalog } from "@/lib/modules";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function ProductsPage() {
  const session = await requireRole(["ADMIN", "PL"]);
  await requireProductCatalog(session);
  const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader
        kicker="Lager"
        title="Varekatalog"
        description="Egne varer med varenr. og stregkode. AO-varer søges direkte på arbejdssedlen og Min dag, så I ikke behøver at taste hele kataloget ind her."
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-3">Vare</th>
                <th className="px-5 py-3">Nr.</th>
                <th className="px-5 py-3">Stregkode</th>
                <th className="px-5 py-3">Lager</th>
                <th className="px-5 py-3">Kost</th>
                <th className="px-5 py-3">Salg</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    {product.name}
                    <p className="text-muted">{product.group} · {product.unit}</p>
                  </td>
                  <td className="px-5 py-3">{product.sku}</td>
                  <td className="px-5 py-3">{product.barcode || "—"}</td>
                  <td className="px-5 py-3">{product.group === "YDELSE" ? "—" : product.stock}</td>
                  <td className="px-5 py-3">{formatKr(product.costPrice)}</td>
                  <td className="px-5 py-3">{formatKr(product.salePrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
          <Card>
            <h2 className="font-serif text-xl">Ny vare</h2>
            <form action={createProductAction} className="mt-4 grid gap-3">
              <Field label="Navn">
                <Input name="name" required />
              </Field>
              <Field label="Varenr.">
                <Input name="sku" required />
              </Field>
              <Field label="Stregkode">
                <Input name="barcode" />
              </Field>
              <Field label="Lagerantal">
                <Input name="stock" defaultValue="0" />
              </Field>
              <Field label="Enhed">
                <Input name="unit" defaultValue="stk" />
              </Field>
              <Field label="Gruppe">
                <Select name="group" defaultValue="EGNE">
                  <option value="EGNE">Egne varer</option>
                  <option value="GROSSIST">Grossist</option>
                  <option value="YDELSE">Ydelse</option>
                </Select>
              </Field>
              <Field label="Kostpris, kr.">
                <Input name="costPrice" />
              </Field>
              <Field label="Salgspris, kr.">
                <Input name="salePrice" />
              </Field>
              <SubmitButton>Opret vare</SubmitButton>
            </form>
          </Card>
      </div>
    </>
  );
}
