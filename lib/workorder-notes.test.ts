import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkOrderNote,
  isWorkOrderUserNote,
  workOrderNoteTitle,
} from "./workorder-notes";

describe("work-order notes", () => {
  it("marks notes written by montør or PL", () => {
    const note = formatWorkOrderNote("Husk nøgle", "Kunden er hjemme efter 15.");
    assert.equal(isWorkOrderUserNote(note), true);
    assert.deepEqual(workOrderNoteTitle(note), {
      title: "Husk nøgle",
      body: "Kunden er hjemme efter 15.",
    });
  });

  it("does not treat calendar events as notes", () => {
    assert.equal(isWorkOrderUserNote("Sagen er flyttet i kalenderen."), false);
    assert.equal(isWorkOrderUserNote("Planlagt tid er ændret til ikke ordrerelateret."), false);
    assert.equal(isWorkOrderUserNote("Sagen er lagt i kalenderen."), false);
  });

  it("keeps a title-only note", () => {
    const note = formatWorkOrderNote("Ring til kunden");
    assert.equal(isWorkOrderUserNote(note), true);
    assert.deepEqual(workOrderNoteTitle(note), { title: "Ring til kunden", body: "" });
  });
});
