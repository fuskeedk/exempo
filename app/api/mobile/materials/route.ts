import { attachProductToCase } from "@/lib/materials";
import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const body = (await request.json().catch(() => null)) as {
    caseId?: string;
    productId?: string;
    barcode?: string;
    name?: string;
    quantity?: number | string;
    unitPrice?: string;
    costPrice?: string;
  } | null;
  const caseId = String(body?.caseId ?? "");
  const quantity = Number.parseFloat(String(body?.quantity ?? "1").replace(",", ".")) || 1;
  if (!caseId) return jsonError("Sag mangler.");

  if (body?.name) {
    const { parseKrToOre } = await import("@/lib/money");
    await prisma.material.create({
      data: {
        caseId,
        name: String(body.name),
        quantity,
        unitPrice: parseKrToOre(String(body.unitPrice ?? "0")),
        costPrice: parseKrToOre(String(body.costPrice ?? "0")),
      },
    });
    return jsonOk({ ok: true, name: String(body.name), quantity });
  }

  const product = body?.productId
    ? await prisma.product.findUnique({ where: { id: body.productId } })
    : await prisma.product.findFirst({
        where: {
          active: true,
          OR: [{ barcode: String(body?.barcode ?? "") }, { sku: String(body?.barcode ?? "") }],
        },
      });
  if (!product) return jsonError("Varen findes ikke.");
  await attachProductToCase(caseId, product, quantity);
  return jsonOk({ ok: true, name: product.name, quantity });
}
