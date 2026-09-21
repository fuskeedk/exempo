import { deleteEmployeeAction, toggleEmployeeAction } from "@/app/actions/employees";
import { AdminTabs } from "@/components/AdminTabs";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash } from "@/components/Flash";
import { Card, GhostLink, PageHeader, PrimaryLink } from "@/components/ui";
import { canSeePayroll, requireRole } from "@/lib/auth";
import { ROLE_LABELS, TRADE_LABELS, isRole, isTrade } from "@/lib/catalog";
import { isSalaried, PAY_TYPE_LABELS, isPayType } from "@/lib/employees";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string }>;
}) {
  const user = await requireRole(["ADMIN", "PL"]);
  const showPay = canSeePayroll(user.role);
  const { besked } = await searchParams;
  const employees = await prisma.user.findMany({
    include: { _count: { select: { assignedCases: true } } },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Medarbejdere"
        description="Deaktivér medarbejdere, der stopper, så de ikke kan logge ind. Slet kun, hvis der ikke er tid eller faktura på dem."
        actions={<PrimaryLink href="/medarbejdere/ny">Ny medarbejder</PrimaryLink>}
      />
      <AdminTabs />
      <Flash message={besked} />
      <div className="grid gap-4 md:grid-cols-2">
        {employees.map((employee) => (
          <Card key={employee.id} className={employee.active ? "" : "opacity-75"}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  className="h-10 w-10 rounded-full"
                  style={{ background: employee.color }}
                />
                <div>
                  <p className="font-medium">{employee.name}</p>
                  <p className="text-sm text-muted">{employee.email}</p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${employee.active ? "tone-green" : "tone-rose"}`}>
                {employee.active ? "Aktiv" : "Inaktiv"}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Rolle</dt>
                <dd>{isRole(employee.role) ? ROLE_LABELS[employee.role] : employee.role}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Fag</dt>
                <dd>{isTrade(employee.trade) ? TRADE_LABELS[employee.trade] : employee.trade}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Kostpris</dt>
                <dd>{formatKr(employee.hourlyRate)}</dd>
              </div>
              {showPay ? (
                <div>
                  <dt className="text-xs uppercase tracking-wider text-muted">
                    {isSalaried(employee.payType) ? "Månedsløn" : "Timeløn"}
                  </dt>
                  <dd>
                    {isSalaried(employee.payType)
                      ? employee.monthlySalary
                        ? formatKr(employee.monthlySalary)
                        : "—"
                      : employee.wageRate
                        ? formatKr(employee.wageRate)
                        : "—"}
                    <span className="block text-xs text-muted">
                      {isPayType(employee.payType) ? PAY_TYPE_LABELS[employee.payType] : PAY_TYPE_LABELS.TIMER}
                    </span>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Sager</dt>
                <dd>{employee._count.assignedCases}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-muted">{employee.phone}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <GhostLink href={`/medarbejdere/${employee.id}`}>Rediger</GhostLink>
              {employee.id !== user.id ? (
                <>
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
                      Slet
                    </ConfirmSubmit>
                  </form>
                </>
              ) : (
                <p className="self-center text-xs text-muted">Det er din egen konto.</p>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
