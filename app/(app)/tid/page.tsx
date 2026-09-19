import { createAbsenceAction } from "@/app/actions/field";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireSession, canManageOffice } from "@/lib/auth";
import { ABSENCE_TYPE_LABELS, ABSENCE_TYPES, TIME_KIND_LABELS } from "@/lib/catalog";
import { formatDate, toDateInput } from "@/lib/dates";
import { formatKr } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export default async function TimePage() {
  const user = await requireSession();
  const office = canManageOffice(user.role);
  const entries = await prisma.timeEntry.findMany({
    where: office ? undefined : { userId: user.id },
    include: { user: true, case: true },
    orderBy: { date: "desc" },
    take: 80,
  });
  const absences = await prisma.absence.findMany({
    where: office ? undefined : { userId: user.id },
    include: { user: true },
    orderBy: { date: "desc" },
    take: 40,
  });

  return (
    <>
      <PageHeader
        kicker="Ressourcer"
        title="Tid og fravær"
        description="Timer lander på arbejdssedlen og kan trækkes med over på fakturaen."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-x-auto p-0">
          <h2 className="px-5 pt-5 font-serif text-xl">Registrerede timer</h2>
          <table className="mt-3 w-full text-left text-sm">
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-5 py-2">
                    {entry.user.name}
                    <p className="text-muted">{entry.case.caseNumber}</p>
                  </td>
                  <td>
                    {entry.hours} t · {TIME_KIND_LABELS[entry.kind as keyof typeof TIME_KIND_LABELS] ?? entry.kind}
                  </td>
                  <td className="px-5 py-2">{formatKr(Math.round(entry.hours * entry.hourlyRate))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <h2 className="font-serif text-xl">Fravær</h2>
          <form action={createAbsenceAction} className="mt-4 grid gap-3">
            <Field label="Dato">
              <Input type="date" name="date" defaultValue={toDateInput(new Date())} required />
            </Field>
            <Field label="Type">
              <Select name="type" defaultValue="FERIE">
                {ABSENCE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ABSENCE_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Timer">
              <Input name="hours" defaultValue="7,4" />
            </Field>
            <SubmitButton>Registrér</SubmitButton>
          </form>
          <ul className="mt-4 space-y-2 text-sm">
            {absences.map((absence) => (
              <li key={absence.id}>
                {absence.user.name}: {ABSENCE_TYPE_LABELS[absence.type as keyof typeof ABSENCE_TYPE_LABELS] ?? absence.type}{" "}
                {formatDate(absence.date)} ({absence.hours} t)
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
