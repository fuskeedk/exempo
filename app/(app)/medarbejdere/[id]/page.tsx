import { notFound } from "next/navigation";
import { deleteEmployeeAction, toggleEmployeeAction } from "@/app/actions/employees";
import { AdminTabs } from "@/components/AdminTabs";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { EmployeeForm } from "@/components/EmployeeForm";
import { Flash } from "@/components/Flash";
import { Card, GhostLink, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { listAgreements } from "@/lib/payroll-store";
import { prisma } from "@/lib/prisma";

export default async function EditEmployeePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ besked?: string }>;
}) {
  const user = await requireRole(["ADMIN", "PL"]);
  const { id } = await params;
  const { besked } = await searchParams;
  const [employee, agreements, managers] = await Promise.all([
    prisma.user.findUnique({ where: { id } }),
    listAgreements(),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "PL"] } },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!employee) notFound();

  return (
    <>
      <PageHeader
        kicker="Administration"
        title={`Rediger ${employee.name}`}
        description="Opdatér login, rolle, fag, kostpris, ansættelse (timeløn eller funktionær), overenskomst og kalenderfarve. Deaktivér, hvis medarbejderen stopper."
        actions={<GhostLink href="/medarbejdere">Tilbage</GhostLink>}
      />
      <AdminTabs />
      <Flash message={besked} />
      <Card>
        <EmployeeForm
          employee={{
            id: employee.id,
            name: employee.name,
            email: employee.email,
            phone: employee.phone,
            role: employee.role,
            trade: employee.trade,
            hourlyRate: employee.hourlyRate,
            wageRate: employee.wageRate,
            payType: employee.payType,
            monthlySalary: employee.monthlySalary,
            employeeNumber: employee.employeeNumber,
            agreementCode: employee.agreementCode,
            apprenticeStep: employee.apprenticeStep,
            apprenticeStart: employee.apprenticeStart,
            managerId: employee.managerId,
            color: employee.color,
          }}
          agreements={agreements}
          managers={managers}
        />
      </Card>
      {employee.id !== user.id ? (
        <Card className="mt-4">
          <h2 className="font-serif text-xl">Når medarbejderen stopper</h2>
          <p className="mt-1 text-sm text-muted">
            Deaktivér, så login og kalender lukkes, men tid og sager bliver. Slet kun, hvis der ikke er historik.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <form action={toggleEmployeeAction}>
              <input type="hidden" name="id" value={employee.id} />
              <input type="hidden" name="employeeId" value={employee.id} />
              <ConfirmSubmit
                message={
                  employee.active
                    ? `Deaktivér ${employee.name}? Personen kan ikke logge ind, men tid og sager bevares.`
                    : `Aktivér ${employee.name} igen?`
                }
              >
                {employee.active ? "Deaktivér" : "Aktivér"}
              </ConfirmSubmit>
            </form>
            <form action={deleteEmployeeAction}>
              <input type="hidden" name="id" value={employee.id} />
              <input type="hidden" name="employeeId" value={employee.id} />
              <ConfirmSubmit
                variant="danger"
                message={`Slet ${employee.name}? Det kan ikke fortrydes. Har personen tid eller faktura, skal du deaktivere i stedet.`}
              >
                Slet medarbejder
              </ConfirmSubmit>
            </form>
          </div>
        </Card>
      ) : null}
    </>
  );
}
