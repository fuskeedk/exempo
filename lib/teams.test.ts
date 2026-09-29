import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planningTeamView, type TeamChoice } from "./teams";

const team1: TeamChoice = { id: "t1", name: "Team 1", memberIds: ["peter", "sofie"] };
const team2: TeamChoice = { id: "t2", name: "Team 2", memberIds: ["sofie", "otto"] };

describe("planningTeamView", () => {
  it("shows every employee when nobody has a team", () => {
    assert.deepEqual(planningTeamView({ role: "PL", requested: undefined, teams: [] }), {
      selected: "alle",
      memberIds: null,
    });
  });

  it("opens a project leader on their only team", () => {
    assert.deepEqual(planningTeamView({ role: "PL", requested: undefined, teams: [team1] }), {
      selected: "t1",
      memberIds: ["peter", "sofie"],
    });
  });

  it("lets that project leader ask for every employee", () => {
    assert.deepEqual(planningTeamView({ role: "PL", requested: "alle", teams: [team1] }), {
      selected: "alle",
      memberIds: null,
    });
  });

  it("joins every team a project leader runs", () => {
    assert.deepEqual(planningTeamView({ role: "PL", requested: undefined, teams: [team1, team2] }), {
      selected: "mine",
      memberIds: ["peter", "sofie", "otto"],
    });
  });

  it("narrows to the team that was picked", () => {
    assert.deepEqual(planningTeamView({ role: "PL", requested: "t2", teams: [team1, team2] }), {
      selected: "t2",
      memberIds: ["sofie", "otto"],
    });
  });

  it("ignores a team the project leader does not run", () => {
    assert.deepEqual(planningTeamView({ role: "PL", requested: "anden", teams: [team1] }), {
      selected: "t1",
      memberIds: ["peter", "sofie"],
    });
  });

  it("keeps the office on every employee until a team is picked", () => {
    assert.deepEqual(planningTeamView({ role: "ADMIN", requested: undefined, teams: [team1, team2] }), {
      selected: "alle",
      memberIds: null,
    });
    assert.deepEqual(planningTeamView({ role: "ADMIN", requested: "t1", teams: [team1, team2] }), {
      selected: "t1",
      memberIds: ["peter", "sofie"],
    });
  });
});
