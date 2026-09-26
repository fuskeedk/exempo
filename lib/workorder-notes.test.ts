import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatWorkOrderNote,
  isWorkOrderUserNote,
  workOrderNoteText,
} from "./workorder-notes";

describe("work-order notes", () => {
  it("stores the note text and not a typed name", () => {
    const note = formatWorkOrderNote("Kunden er hjemme efter 15.");
    assert.equal(isWorkOrderUserNote(note), true);
    assert.equal(workOrderNoteText(note), "Kunden er hjemme efter 15.");
  });

  it("does not treat calendar events as notes", () => {
    assert.equal(isWorkOrderUserNote("Sagen er flyttet i kalenderen."), false);
    assert.equal(isWorkOrderUserNote("Planlagt tid er ændret til ikke ordrerelateret."), false);
  });
});
