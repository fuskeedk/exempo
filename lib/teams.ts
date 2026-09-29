export type TeamChoice = {
  id: string;
  name: string;
  memberIds: string[];
};

export function planningTeamView(input: {
  role: string;
  requested: string | undefined;
  teams: TeamChoice[];
}): { selected: string; memberIds: string[] | null } {
  const allowed = new Map(input.teams.map((team) => [team.id, team]));
  if (input.requested === "alle") return { selected: "alle", memberIds: null };
  const chosen = input.requested ? allowed.get(input.requested) : undefined;
  if (chosen) return { selected: chosen.id, memberIds: chosen.memberIds };
  if (input.requested === "mine" && input.role === "PL" && input.teams.length > 1) {
    return { selected: "mine", memberIds: uniqueMembers(input.teams) };
  }
  if (input.role === "PL" && input.teams.length === 1) {
    return { selected: input.teams[0].id, memberIds: input.teams[0].memberIds };
  }
  if (input.role === "PL" && input.teams.length > 1) {
    return { selected: "mine", memberIds: uniqueMembers(input.teams) };
  }
  return { selected: "alle", memberIds: null };
}

function uniqueMembers(teams: TeamChoice[]) {
  return [...new Set(teams.flatMap((team) => team.memberIds))];
}
