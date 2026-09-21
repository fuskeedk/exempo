import { notFound } from "next/navigation";
import { WorkOrder } from "@/components/WorkOrder";
import { Flash, ErrorFlash } from "@/components/Flash";
import { requireSession } from "@/lib/auth";
import { canManageOffice } from "@/lib/auth";
import { caseEconomics } from "@/lib/coverage";
import { prisma } from "@/lib/prisma";
import { getSettings, productCatalogEnabled, vanStockEnabled } from "@/lib/settings";
import { ensureDefaultKlsTemplates } from "@/lib/kls-catalog";

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ besked?: string; fejl?: string }>;
}) {
  const user = await requireSession();
  const { id } = await params;
  const { besked, fejl } = await searchParams;
  const sag = await prisma.case.findUnique({
    where: { id },
    include: {
      assignedTo: true,
      projectLeader: true,
      events: { include: { user: true }, orderBy: { createdAt: "desc" } },
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      timeEntries: { include: { user: true }, orderBy: { date: "desc" } },
      materials: { include: { product: true }, orderBy: { createdAt: "desc" } },
      invoices: { include: { lines: true }, orderBy: { issuedAt: "desc" } },
      extraWorks: { orderBy: { createdAt: "desc" } },
      purchases: { orderBy: { createdAt: "desc" } },
      klsReports: {
        include: {
          template: true,
          signedBy: true,
          checks: { include: { item: true } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!sag) notFound();
  if (!canManageOffice(user.role) && sag.assignedToId !== user.id) notFound();

  const settings = await getSettings();
  const catalogOn = productCatalogEnabled(settings);
  const vanOn = vanStockEnabled(settings);
  await ensureDefaultKlsTemplates(prisma);

  const [employees, templates, products, vanItems, plannedActivities] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, role: { in: ["MEDARBEJDER", "PL", "ADMIN"] } },
      orderBy: { name: "asc" },
    }),
    prisma.klsTemplate.findMany({
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
    catalogOn
      ? prisma.product.findMany({
          where: { active: true },
          select: { id: true, sku: true, name: true, unit: true, salePrice: true, costPrice: true, imageUrl: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
    vanOn
      ? prisma.vanStock.findMany({
          where: { userId: user.id, quantity: { gt: 0 } },
          include: { product: true },
        })
      : Promise.resolve([]),
    prisma.calendarActivity.findMany({
      where: { caseId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { start: "asc" },
    }),
  ]);

  return (
    <>
      <Flash message={besked} />
      <ErrorFlash message={fejl} />
      <WorkOrder
      sag={sag}
      economics={caseEconomics(sag)}
      user={user}
      employees={employees}
      templates={templates}
      products={products}
      vanItems={vanItems.map((row) => ({
        productId: row.productId,
        quantity: row.quantity,
        name: row.product.name,
        sku: row.product.sku,
      }))}
      catalogEnabled={catalogOn}
      vanEnabled={vanOn}
      plannedActivities={plannedActivities.map((activity) => ({
        id: activity.id,
        userId: activity.userId,
        userName: activity.user.name,
        start: activity.start,
        end: activity.end,
        status: activity.status,
        kind: activity.kind,
        allDay: activity.allDay,
        caseId: activity.caseId,
      }))}
    />
    </>
  );
}
