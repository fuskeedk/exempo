import { AdminTabs } from "@/components/AdminTabs";
import { EmployeeForm } from "@/components/EmployeeForm";
import { Flash } from "@/components/Flash";
import { Card, GhostLink, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { listAgreements } from "@/lib/payroll-store";
import { prisma } from "@/lib/prisma";

export default async function NewEmployeePage({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string }>;
}) {
  await requireRole(["ADMIN", "PL"]);
  const { besked } = await searchParams;
  const [agreements, managers] = await Promise.all([
    listAgreements(),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "PL"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Ny medarbejder"
        description="Medarbejderen får egen login og kalender. Vælg timeløn eller funktionær (fast månedsløn), og sæt overenskomst, hvis I kører løn herfra."
        actions={<GhostLink href="/medarbejdere">Tilbage</GhostLink>}
      />
      <AdminTabs />
      <Flash message={besked} />
      <Card>
        <EmployeeForm agreements={agreements} managers={managers} />
      </Card>
    </>
  );
}