import Link from "next/link";
import { addDays, addWeeks } from "date-fns";
import { assignCaseToCalendarAction } from "@/app/actions/cases";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, PageHeader, Select } from "@/components/ui";
import { canManageOffice, requireSession } from "@/lib/auth";
import { TRADE_LABELS, isTrade } from "@/lib/catalog";
import { formatDay, toDateTimeInput, weekDays, weekStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";

function overlapsDay(start: Date, end: Date, day: Date) {
  const from = new Date(day);
  from.setHours(0, 0, 0, 0);
  const to = addDays(from, 1);
  return start < to && end > from;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ uge?: string; medarbejder?: string }>;
}) {
  const user = await requireSession();
  const { uge, medarbejder } = await searchParams;
  const office = canManageOffice(user.role);
  const start = weekStart(uge ? new Date(`${uge}T12:00:00`) : new Date());
  const days = weekDays(start);
  const end = addDays(start, 7);

  const employees = await prisma.user.findMany({
    where: office
      ? { active: true, role: { in: ["MEDARBEJDER", "PL"] } }
      : { id: user.id },
    orderBy: { name: "asc" },
  });
  const visible = medarbejder ? employees.filter((item) => item.id === medarbejder) : employees;

  const cases = await prisma.case.findMany({
    where: {
      scheduledStart: { not: null },
      scheduledEnd: { not: null },
      assignedToId: office && !medarbejder ? { not: null } : { in: visible.map((item) => item.id) },
    },
    include: { assignedTo: true },
  });

  const unassigned = office
    ? await prisma.case.findMany({
        where: {
          state: { notIn: ["AFSLUTTET", "ANNULLERET"] },
          OR: [{ assignedToId: null }, { scheduledStart: null }, { scheduledEnd: null }],
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  const prev = addWeeks(start, -1).toISOString().slice(0, 10);
  const next = addWeeks(start, 1).toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        kicker="Kalender"
        title="Medarbejderkalender"
        description="Projektlederen lægger sager på den enkelte medarbejders uge."
        actions={
          <div className="flex gap-2">
            <Link className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold" href={`/kalender?uge=${prev}`}>
              Forrige uge
            </Link>
            <Link className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold" href={`/kalender?uge=${next}`}>
              Næste uge
            </Link>
          </div>
        }
      />

      {office && employees.length > 1 ? (
        <div className="mb-6 flex flex-wrap gap-2">
          <Link
            href={`/kalender?uge=${start.toISOString().slice(0, 10)}`}
            className={`rounded-full px-3 py-1.5 text-sm ${!medarbejder ? "bg-pine text-white" : "bg-white border border-line"}`}
          >
            Alle
          </Link>
          {employees.map((employee) => (
            <Link
              key={employee.id}
              href={`/kalender?uge=${start.toISOString().slice(0, 10)}&medarbejder=${employee.id}`}
              className={`rounded-full px-3 py-1.5 text-sm ${
                medarbejder === employee.id ? "bg-pine text-white" : "bg-white border border-line"
              }`}
            >
              {employee.name}
            </Link>
          ))}
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-line bg-paper-2">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="w-48 px-4 py-3 text-xs uppercase tracking-wider text-muted">Medarbejder</th>
              {days.map((day) => (
                <th key={day.toISOString()} className="px-3 py-3 text-xs uppercase tracking-wider text-muted">
                  {formatDay(day)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((employee) => (
              <tr key={employee.id} className="border-t border-line align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{employee.name}</p>
                  <p className="text-xs text-muted">
                    {isTrade(employee.trade) ? TRADE_LABELS[employee.trade] : employee.trade}
                  </p>
                </td>
                {days.map((day) => {
                  const items = cases.filter(
                    (sag) =>
                      sag.assignedToId === employee.id &&
                      sag.scheduledStart &&
                      sag.scheduledEnd &&
                      overlapsDay(sag.scheduledStart, sag.scheduledEnd, day),
                  );
                  return (
                    <td key={day.toISOString()} className="px-2 py-2">
                      <div className="min-h-24 space-y-2">
                        {items.map((sag) => (
                          <Link
                            key={sag.id}
                            href={`/sager/${sag.id}`}
                            className="block rounded-xl p-2 text-white"
                            style={{ background: employee.color }}
                          >
                            <p className="text-[11px] opacity-80">{sag.caseNumber}</p>
                            <p className="text-sm font-medium leading-snug">{sag.title}</p>
                            <div className="mt-1">
                              <StatusBadge state={sag.state} />
                            </div>
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {office && unassigned.length > 0 ? (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <h2 className="font-serif text-xl">Sager der venter på kalenderen</h2>
            <ul className="mt-4 divide-y divide-line">
              {unassigned.map((sag) => (
                <li key={sag.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <Link href={`/sager/${sag.id}`} className="font-medium hover:underline">
                      {sag.caseNumber} · {sag.title}
                    </Link>
                    <p className="text-sm text-muted">
                      {sag.customerCity || sag.customerAddress} · <StatusBadge state={sag.state} />
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <h2 className="font-serif text-xl">Smid sag på kalender</h2>
            <form action={assignCaseToCalendarAction} className="mt-4 space-y-3">
              <Field label="Sag">
                <Select name="caseId" required>
                  {unassigned.map((sag) => (
                    <option key={sag.id} value={sag.id}>
                      {sag.caseNumber} · {sag.title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Medarbejder">
                <Select name="assignedToId" required>
                  {employees.map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Start">
                <input
                  type="datetime-local"
                  name="scheduledStart"
                  required
                  defaultValue={toDateTimeInput(new Date(start.getTime() + 8 * 60 * 60 * 1000))}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
                />
              </Field>
              <Field label="Slut">
                <input
                  type="datetime-local"
                  name="scheduledEnd"
                  required
                  defaultValue={toDateTimeInput(new Date(start.getTime() + 16 * 60 * 60 * 1000))}
                  className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
                />
              </Field>
              <SubmitButton>Læg på kalender</SubmitButton>
            </form>
          </Card>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">
          Uge {start.toLocaleDateString("da-DK")} – {end.toLocaleDateString("da-DK")}
        </p>
      )}
    </>
  );
}
