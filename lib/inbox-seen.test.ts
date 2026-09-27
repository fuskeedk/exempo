import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { inboxKeysForCase, inboxKeysForQuote, markInboxSeen, readInboxSeen, unreadInbox } from "./inbox-seen";
import type { InboxItem } from "./inbox";

function item(overrides: Partial<InboxItem> = {}): InboxItem {
  return {
    id: "quote:q1",
    kind: "quote_accepted",
    href: "/sager/c1",
    title: "Kunden har godkendt tilbuddet",
    detail: "Casper · 000003",
    at: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("unreadInbox", () => {
  it("hides an item after it was opened", () => {
    const rows = [item(), item({ id: "quote:q2", href: "/tilbud/q2" })];
    const unread = unreadInbox(rows, { "quote:q1": "2026-09-27T08:00:00.000Z" });
    assert.deepEqual(
      unread.map((row) => row.id),
      ["quote:q2"],
    );
  });

  it("shows the item again if it is newer than the last visit", () => {
    const rows = [item({ at: "2026-09-27T12:00:00.000Z" })];
    const unread = unreadInbox(rows, { "quote:q1": "2026-09-20T10:00:00.000Z" });
    assert.equal(unread.length, 1);
  });
});

describe("inbox keys", () => {
  it("clears both the sag and its tilbud", () => {
    assert.deepEqual(inboxKeysForCase("c1", ["q1", "q1"]), ["case:c1", "quote:q1"]);
    assert.deepEqual(inboxKeysForQuote("q1"), ["quote:q1"]);
  });
});

describe("inbox seen file", () => {
  it("remembers a visit per user", () => {
    const previous = process.env.DATA_DIR;
    process.env.DATA_DIR = mkdtempSync(path.join(tmpdir(), "exempo-inbox-"));
    try {
      markInboxSeen("sydsjel", "mads", ["quote:q1"], new Date("2026-09-27T08:00:00.000Z"));
      assert.equal(readInboxSeen("sydsjel", "mads")["quote:q1"], "2026-09-27T08:00:00.000Z");
      assert.equal(readInboxSeen("sydsjel", "other")["quote:q1"], undefined);
    } finally {
      if (previous === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previous;
    }
  });
});
