import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildIdleCasesMail, buildOfficeQuoteMail, uniqueEmails } from "./notify-copy";

describe("uniqueEmails", () => {
  it("keeps valid office addresses once", () => {
    assert.deepEqual(uniqueEmails(["mj@jbnet.dk", " MJ@jbnet.dk ", "nej", "", "pl@firma.dk"]), [
      "mj@jbnet.dk",
      "pl@firma.dk",
    ]);
  });
});

describe("office quote mail", () => {
  it("says the customer accepted", () => {
    const mail = buildOfficeQuoteMail({
      companyName: "Sydsjællands El Teknik",
      decision: "godkend",
      quoteNumber: "TIL-2026-0003",
      customerName: "Casper",
      approvedName: "Casper Holm",
      href: "https://exempo.jbnet.dk/sager/abc",
    });
    assert.match(mail.subject, /Casper har godkendt TIL-2026-0003/);
    assert.match(mail.text, /Casper Holm/);
    assert.match(mail.text, /exempo.jbnet.dk\/sager\/abc/);
  });

  it("says the customer rejected", () => {
    const mail = buildOfficeQuoteMail({
      companyName: "Exempo",
      decision: "afvis",
      quoteNumber: "TIL-2026-0003",
      customerName: "Casper",
      note: "For dyrt",
      href: "https://exempo.jbnet.dk/tilbud/q1",
    });
    assert.match(mail.subject, /afvist/);
    assert.match(mail.text, /For dyrt/);
  });
});

describe("idle cases mail", () => {
  it("lists the quiet sager", () => {
    const mail = buildIdleCasesMail({
      companyName: "Exempo",
      items: [{ title: "Sagen har stået stille i 8 dage", detail: "000003 · Casper", href: "https://x/sager/1" }],
    });
    assert.equal(mail.subject, "1 sag har stået stille i 8 dage");
    assert.match(mail.text, /Casper/);
  });
});
