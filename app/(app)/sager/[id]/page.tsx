import { notFound } from "next/navigation";
import {
  CalendarAssignForm,
  CaseHero,
  DocumentsPanel,
  EconomyPanel,
  FsmForm,
  KlsPanel,
  StamdataForm,
  Timeline,
} from "@/components/CasePanels";
import { requireSession } from "@/lib/auth";
import { canManageOffice } from "@/lib/auth";
import { caseEconomics } from "@/lib/coverage";
import { prisma } from "@/lib/prisma";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireSession();
  const { id } = await params;
  const sag = await prisma.case.findUnique({
    where: { id },
    include: {
      assignedTo: true,
      projectLeader: true,
      events: { include: { user: true }, orderBy: { createdAt: "desc" } },
      documents: { include: { uploadedBy: true }, orderBy: { createdAt: "desc" } },
      timeEntries: { include: { user: true }, orderBy: { date: "desc" } },
      materials: { orderBy: { createdAt: "desc" } },
      invoices: { include: { lines: true }, orderBy: { issuedAt: "desc" } },
      extraWorks: { orderBy: { createdAt: "desc" } },
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

  const [employees, templates, products] = await Promise.all([
    prisma.user.findMany({
      where: { active: true, role: { in: ["MEDARBEJDER", "PL"] } },
      orderBy: { name: "asc" },
    }),
    prisma.klsTemplate.findMany({
      include: { items: { orderBy: { sortOrder: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.product.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const economics = caseEconomics(sag);

  return (
    <div className="space-y-6">
      <CaseHero sag={sag} economics={economics} />
      <div className="grid gap-6 lg:grid-cols-2">
        <FsmForm sag={sag} />
        <CalendarAssignForm sag={sag} employees={employees} user={user} />
      </div>
      <DocumentsPanel sag={sag} />
      <KlsPanel sag={sag} templates={templates} />
      <EconomyPanel sag={sag} economics={economics} user={user} products={products} />
      <StamdataForm sag={sag} user={user} />
      <Timeline sag={sag} />
    </div>
  );
}
