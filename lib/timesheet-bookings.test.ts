import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dropCaseJobsCoveredByActivity,
  isCaseCoveredByActivity,
  uniqueTimesheetJobs,
  unlinkCaseId,
} from "./timesheet-bookings";

const slot = {
  scheduledStart: "2026-09-28T05:00:00.000Z",
  scheduledEnd: "2026-09-28T13:00:00.000Z",
};

describe("unlinkCaseId", () => {
  it("returns the original case when the picker is cleared", () => {
    assert.equal(unlinkCaseId("case-4", ""), "case-4");
    assert.equal(unlinkCaseId("case-4", "   "), "case-4");
  });

  it("returns the original case when switching to another sag", () => {
    assert.equal(unlinkCaseId("case-4", "case-9"), "case-4");
  });

  it("does nothing when the sag is unchanged or there was no sag", () => {
    assert.equal(unlinkCaseId("case-4", "case-4"), "");
    assert.equal(unlinkCaseId("", ""), "");
    assert.equal(unlinkCaseId(undefined, "case-4"), "");
  });
});

describe("isCaseCoveredByActivity", () => {
  const job = {
    id: "case-4",
    scheduledStart: new Date("2026-09-28T05:00:00.000Z"),
    scheduledEnd: new Date("2026-09-28T13:00:00.000Z"),
  };

  it("covers a case when an ikke-ordrelateret activity sits on the same slot", () => {
    assert.equal(
      isCaseCoveredByActivity(job, [
        {
          start: new Date("2026-09-28T05:00:00.000Z"),
          end: new Date("2026-09-28T13:00:00.000Z"),
          caseId: null,
        },
      ]),
      true,
    );
  });

  it("covers a case when a registered activity is linked to that case", () => {
    assert.equal(
      isCaseCoveredByActivity(job, [
        {
          start: new Date("2026-09-28T05:00:00.000Z"),
          end: new Date("2026-09-28T13:00:00.000Z"),
          caseId: "case-4",
        },
      ]),
      true,
    );
  });

  it("does not cover a case when a later activity is on another slot", () => {
    assert.equal(
      isCaseCoveredByActivity(job, [
        {
          start: new Date("2026-09-28T14:00:00.000Z"),
          end: new Date("2026-09-28T15:00:00.000Z"),
          caseId: null,
        },
      ]),
      false,
    );
  });
});

describe("uniqueTimesheetJobs", () => {
  it("drops the leftover case booking so Timer is 7,5 not 15", () => {
    const jobs = uniqueTimesheetJobs([
      { id: "case-4", source: "case", ...slot },
      { id: "act-1", source: "activity", caseId: null, ...slot },
    ]);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.id, "act-1");
  });

  it("keeps a case and a later ikke-ordrelateret block on the same day", () => {
    const jobs = uniqueTimesheetJobs([
      { id: "case-4", source: "case", ...slot },
      {
        id: "act-1",
        source: "activity",
        caseId: null,
        scheduledStart: "2026-09-28T14:00:00.000Z",
        scheduledEnd: "2026-09-28T15:00:00.000Z",
      },
    ]);
    assert.equal(jobs.length, 2);
  });

  it("still dedupes identical case rows", () => {
    const jobs = uniqueTimesheetJobs([
      { id: "case-4", source: "case", ...slot },
      { id: "case-4", source: "case", ...slot },
    ]);
    assert.equal(jobs.length, 1);
  });
});

describe("dropCaseJobsCoveredByActivity", () => {
  it("leaves activity-only days untouched", () => {
    const jobs = dropCaseJobsCoveredByActivity([{ id: "act-1", source: "activity", caseId: null, ...slot }]);
    assert.equal(jobs.length, 1);
  });
});
