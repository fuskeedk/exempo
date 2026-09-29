import { createTeamAction, deleteTeamAction, saveTeamAction } from "@/app/actions/teams";
import { AdminTabs } from "@/components/AdminTabs";
import { ConfirmSubmit } from "@/components/ConfirmSubmit";
import { Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { ROLE_LABELS, TRADE_LABELS, isRole, isTrade } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

function personLabel(person: { name: string; trade: string; role: string }) {
  const trade = isTrade(person.trade) ? TRADE_LABELS[person.trade] : person.trade;
  const role = isRole(person.role) ? ROLE_LABELS[person.role] : person.role;
  return `${person.name} · ${trade === "Andet" ? role : trade}`;
}

export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string }>;
}) {
  const user = await requireRole(["ADMIN", "PL"]);
  const { besked } = await searchParams;
  const [teams, people, leaders] = await Promise.all([
    prisma.team.findMany({
      where: user.role === "ADMIN" ? undefined : { leaderId: user.id },
      include: {
        leader: { select: { id: true, name: true } },
        members: { select: { userId: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, trade: true, role: true },
    }),
    user.role === "ADMIN"
      ? prisma.user.findMany({
          where: { active: true, role: { in: ["ADMIN", "PL"] } },
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader kicker="Administration" title="Teams" />
      <AdminTabs />
      <Flash message={besked} />
      <Card>
        <form action={createTeamAction} className="grid gap-4">
          <Field label="Navn">
            <Input name="name" required placeholder="Team 1" />
          </Field>
          {leaders.length ? (
            <Field label="Projektleder">
              <Select name="leaderId" defaultValue={user.id}>
                {leaders.map((leader) => (
                  <option key={leader.id} value={leader.id}>
                    {leader.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Medarbejdere</legend>
            <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
              {people.map((person) => (
                <label key={person.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="members" value={person.id} />
                  {personLabel(person)}
                </label>
              ))}
            </div>
          </fieldset>
          <SubmitButton>Opret team</SubmitButton>
        </form>
      </Card>
      <div className="mt-6 grid gap-4">
        {teams.map((team) => {
          const chosen = new Set(team.members.map((member) => member.userId));
          return (
            <Card key={team.id}>
              <form action={saveTeamAction} className="grid gap-4">
                <input type="hidden" name="id" value={team.id} />
                <Field label="Navn">
                  <Input name="name" required defaultValue={team.name} />
                </Field>
                {user.role === "ADMIN" ? (
                  <Field label="Projektleder">
                    <Select name="leaderId" defaultValue={team.leaderId}>
                      {leaders.map((leader) => (
                        <option key={leader.id} value={leader.id}>
                          {leader.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                ) : (
                  <p className="text-sm text-muted">{team.leader.name}</p>
                )}
                <fieldset>
                  <legend className="mb-2 text-sm font-medium">Medarbejdere</legend>
                  <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
                    {people.map((person) => (
                      <label key={person.id} className="flex items-center gap-2 text-sm">
                        <input type="checkbox" name="members" value={person.id} defaultChecked={chosen.has(person.id)} />
                        {personLabel(person)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <SubmitButton>Gem</SubmitButton>
              </form>
              <form action={deleteTeamAction} className="mt-3">
                <input type="hidden" name="id" value={team.id} />
                <ConfirmSubmit variant="danger" message={`Slet ${team.name}?`}>
                  Slet team
                </ConfirmSubmit>
              </form>
            </Card>
          );
        })}
      </div>
    </>
  );
}
