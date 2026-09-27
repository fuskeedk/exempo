import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ACCEPTED_QUOTE_DAYS,
  STALE_CASE_DAYS,
  acceptedQuoteItem,
  calendarDaysSince,
  collectInbox,
  lastCaseActivity,
  rejectedQuoteItem,
  staleCaseItem,
  type InboxCase,
  type InboxQuote,
} from "./inbox";

const now = new Date("2026-09-27T12:00:00");

function daysAgo(days: number) {
  return new Date(now.getTime() - days * 86_400_000);
}

function quote(overrides: Partial<InboxQuote> = {}): InboxQuote {
  return {
    id: "q1",
    quoteNumber: "TIL-2026-0003",
    title: "El-tavle",
    status: "GODKENDT",
    caseId: null,
    approvedAt: daysAgo(1),
    updatedAt: daysAgo(1),
    emailedAt: daysAgo(3),
    customer: { name: "Anna Holm" },
    cases: [],
    ...overrides,
  };
}

function sag(overrides: Partial<InboxCase> = {}): InboxCase {
  return {
    id: "c1",
    caseNumber: "EX-2026-0004",
    title: "Rørskade",
    state: "NY",
    customerName: "Aalborg Boligselskab",
    assignedToId: "lars",
    projectLeaderId: "pia",
    createdAt: daysAgo(20),
    updatedAt: daysAgo(20),
    events: [{ createdAt: daysAgo(20) }],
    ...overrides,
  };
}

describe("calendarDaysSince", () => {
  it("counts whole calendar days", () => {
    assert.equal(calendarDaysSince(daysAgo(8), now), 8);
    assert.equal(calendarDaysSince(now, now), 0);
  });
});

describe("lastCaseActivity", () => {
  it("uses the newest event, time or material", () => {
    const last = lastCaseActivity(
      sag({
        updatedAt: daysAgo(12),
        events: [{ createdAt: daysAgo(10) }],
        timeEntries: [{ createdAt: daysAgo(3) }],
        materials: [{ createdAt: daysAgo(9) }],
      }),
    );
    assert.equal(last.toISOString(), daysAgo(3).toISOString());
  });
});

describe("acceptedQuoteItem", () => {
  it("keeps an approved quote without a sag", () => {
    const item = acceptedQuoteItem(quote({ approvedAt: daysAgo(40) }), now);
    assert.ok(item);
    assert.equal(item?.href, "/tilbud/q1");
    assert.equal(item?.title, "Kunden har godkendt tilbuddet");
    assert.match(item?.detail ?? "", /Anna Holm/);
  });

  it("keeps a converted quote only while it is recent", () => {
    const recent = acceptedQuoteItem(quote({ caseId: "c1", cases: [{ id: "c1" }], approvedAt: daysAgo(2) }), now);
    assert.equal(recent?.href, "/sager/c1");
    const old = acceptedQuoteItem(
      quote({ caseId: "c1", cases: [{ id: "c1" }], approvedAt: daysAgo(ACCEPTED_QUOTE_DAYS + 1) }),
      now,
    );
    assert.equal(old, null);
  });

  it("ignores drafts", () => {
    assert.equal(acceptedQuoteItem(quote({ status: "SENDT" }), now), null);
  });
});

describe("rejectedQuoteItem", () => {
  it("flags a recently rejected quote", () => {
    const item = rejectedQuoteItem(
      quote({ status: "AFVIST", updatedAt: daysAgo(1), rejectedNote: "For dyrt" }),
      now,
    );
    assert.ok(item);
    assert.equal(item?.kind, "quote_rejected");
    assert.equal(item?.href, "/tilbud/q1");
    assert.equal(item?.title, "Kunden har afvist tilbuddet");
    assert.match(item?.detail ?? "", /For dyrt/);
  });

  it("drops an old rejection", () => {
    assert.equal(
      rejectedQuoteItem(quote({ status: "AFVIST", updatedAt: daysAgo(ACCEPTED_QUOTE_DAYS + 1) }), now),
      null,
    );
  });

  it("ignores approved quotes", () => {
    assert.equal(rejectedQuoteItem(quote(), now), null);
  });
});

describe("staleCaseItem", () => {
  it("flags a sag after eight untouched days", () => {
    const item = staleCaseItem(sag({ updatedAt: daysAgo(STALE_CASE_DAYS), events: [] }), now);
    assert.ok(item);
    assert.equal(item?.title, "Sagen har stået stille i 8 dage");
    assert.equal(item?.href, "/sager/c1");
  });

  it("waits until the eighth day", () => {
    assert.equal(staleCaseItem(sag({ updatedAt: daysAgo(7), events: [] }), now), null);
  });

  it("skips closed cases", () => {
    assert.equal(staleCaseItem(sag({ state: "AFSLUTTET", updatedAt: daysAgo(30) }), now), null);
    assert.equal(staleCaseItem(sag({ state: "ANNULLERET", updatedAt: daysAgo(30) }), now), null);
  });
});

describe("collectInbox", () => {
  it("shows quotes to the office and only own sager to the fitter", () => {
    const rejected = quote({ id: "q2", status: "AFVIST", updatedAt: daysAgo(1), quoteNumber: "TIL-2026-0009" });
    const office = collectInbox(
      [quote(), rejected],
      [sag(), sag({ id: "c2", assignedToId: "other", projectLeaderId: "other" })],
      { id: "pia", office: true },
      now,
    );
    assert.equal(office.some((item) => item.kind === "quote_accepted"), true);
    assert.equal(office.some((item) => item.kind === "quote_rejected"), true);
    assert.equal(office.filter((item) => item.kind === "case_stale").length, 2);

    const fitter = collectInbox(
      [quote(), rejected],
      [sag(), sag({ id: "c2", assignedToId: "other", projectLeaderId: "other" })],
      { id: "lars", office: false },
      now,
    );
    assert.equal(fitter.some((item) => item.kind === "quote_accepted"), false);
    assert.equal(fitter.some((item) => item.kind === "quote_rejected"), false);
    assert.equal(fitter.map((item) => item.id).join(), "case:c1");
  });
});
