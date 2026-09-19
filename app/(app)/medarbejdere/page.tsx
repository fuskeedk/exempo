import { toggleEmployeeAction } from "@/app/actions/employees";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, PageHeader, PrimaryLink } from "@/components/ui";
import { canManageOffice, requireSession } from "@/lib/auth";
import { ROLE_LABELS, TRADE_LABELS, isRole, isTrade } from "@/lib/catalog";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function EmployeesPage() {
  const user = await requireSession();
  const office = canManageOffice(user.role);
  const employees = await prisma.user.findMany({
    include: { _count: { select: { assignedCases: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <>
      <PageHeader
        kicker="Organisation"
        title="Medarbejdere"
        description="Hver medarbejder har en kalender, som projektlederen kan lægge sager i."
        actions={office ? <PrimaryLink href="/medarbejdere/ny">Ny medarbejder</PrimaryLink> : null}
      />
      <div className="grid gap-4 md:grid-cols-2">
        {employees.map((employee) => (
          <Card key={employee.id}>
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
                <dt className="text-xs uppercase tracking-wider text-muted">Timepris</dt>
                <dd>{formatKr(employee.hourlyRate)}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-muted">Sager</dt>
                <dd>{employee._count.assignedCases}</dd>
              </div>
            </dl>
            <p className="mt-3 text-sm text-muted">{employee.phone}</p>
            {office && employee.id !== user.id ? (
              <form action={toggleEmployeeAction} className="mt-4">
                <input type="hidden" name="id" value={employee.id} />
                <SubmitButton variant="secondary">
                  {employee.active ? "Deaktivér" : "Aktivér"}
                </SubmitButton>
              </form>
            ) : null}
          </Card>
        ))}
      </div>
    </>
  );
}
