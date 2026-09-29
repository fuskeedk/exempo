"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { tenantPrisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function bounce(message: string): never {
  redirect(`/teams?besked=${encodeURIComponent(message)}`);
}

function revalidate() {
  revalidatePath("/teams");
  revalidatePath("/kalender");
  revalidatePath("/administration");
}

async function ownedTeam(id: string, session: { id: string; role: string; tenantSlug: string }) {
  const db = tenantPrisma(session.tenantSlug);
  const team = await db.team.findUnique({ where: { id } });
  if (!team) bounce("Teamet findes ikke.");
  if (session.role !== "ADMIN" && team.leaderId !== session.id) bounce("Teamet findes ikke.");
  return { db, team };
}

export async function createTeamAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const db = tenantPrisma(session.tenantSlug);
  const name = str(formData, "name").slice(0, 80);
  if (!name) bounce("Teamet skal have et navn.");
  const requestedLeader = str(formData, "leaderId");
  const leaderId = session.role === "ADMIN" && requestedLeader ? requestedLeader : session.id;
  const leader = await db.user.findFirst({
    where: { id: leaderId, active: true, role: { in: ["ADMIN", "PL"] } },
    select: { id: true },
  });
  if (!leader) bounce("Vælg en projektleder.");
  const memberIds = await activeMemberIds(db, formData);
  const team = await db.team.create({
    data: {
      name,
      leaderId: leader.id,
      members: { create: memberIds.map((userId) => ({ userId })) },
    },
  });
  revalidate();
  redirect(`/teams?besked=${encodeURIComponent(`${team.name} er oprettet.`)}`);
}

export async function saveTeamAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const id = str(formData, "id");
  const { db, team } = await ownedTeam(id, session);
  const name = str(formData, "name").slice(0, 80);
  if (!name) bounce("Teamet skal have et navn.");
  const memberIds = await activeMemberIds(db, formData);
  let leaderId = team.leaderId;
  if (session.role === "ADMIN") {
    const requested = str(formData, "leaderId");
    if (requested) {
      const leader = await db.user.findFirst({
        where: { id: requested, active: true, role: { in: ["ADMIN", "PL"] } },
        select: { id: true },
      });
      if (leader) leaderId = leader.id;
    }
  }
  await db.$transaction([
    db.team.update({ where: { id: team.id }, data: { name, leaderId } }),
    db.teamMember.deleteMany({ where: { teamId: team.id } }),
    ...(memberIds.length
      ? [db.teamMember.createMany({ data: memberIds.map((userId) => ({ teamId: team.id, userId })) })]
      : []),
  ]);
  revalidate();
  redirect(`/teams?besked=${encodeURIComponent(`${name} er gemt.`)}`);
}

export async function deleteTeamAction(formData: FormData) {
  const session = await requireRole(["ADMIN", "PL"]);
  const { db, team } = await ownedTeam(str(formData, "id"), session);
  await db.team.delete({ where: { id: team.id } });
  revalidate();
  redirect(`/teams?besked=${encodeURIComponent(`${team.name} er slettet.`)}`);
}

async function activeMemberIds(db: ReturnType<typeof tenantPrisma>, formData: FormData) {
  const requested = [...new Set(formData.getAll("members").map((value) => String(value)))];
  if (!requested.length) return [];
  const users = await db.user.findMany({
    where: { id: { in: requested }, active: true },
    select: { id: true },
  });
  const allowed = new Set(users.map((user) => user.id));
  return requested.filter((id) => allowed.has(id));
}
