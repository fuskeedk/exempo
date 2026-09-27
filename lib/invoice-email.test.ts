import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceEmail, invoiceCustomerEmail } from "./notify-copy";

describe("invoiceCustomerEmail", () => {
  it("prefers the customer record", () => {
    assert.equal(invoiceCustomerEmail({ customerEmail: "kunde@firma.dk", caseEmail: "gammel@firma.dk" }), "kunde@firma.dk");
    assert.equal(invoiceCustomerEmail({ customerEmail: "", caseEmail: "sag@firma.dk" }), "sag@firma.dk");
    assert.equal(invoiceCustomerEmail({ customerEmail: "x", caseEmail: "" }), "");
  });
});

describe("buildInvoiceEmail", () => {
  it("includes totals and bank", () => {
    const mail = buildInvoiceEmail({
      invoiceNumber: "FAK-2026-0004",
      kind: "FAKTURA",
      customerName: "Casper",
      address: "Stien 1",
      postal: "4700",
      city: "Næstved",
      dueAt: new Date("2026-10-10T12:00:00"),
      lines: [{ description: "El-arbejde", quantity: 1, unitPrice: 125000 }],
      companyName: "Sydsjællands El Teknik",
      companyEmail: "faktura@sydsjel.dk",
      bankReg: "1234",
      bankAccount: "1234567890",
    });
    assert.match(mail.subject, /Faktura FAK-2026-0004/);
    assert.match(mail.text, /I alt/);
    assert.match(mail.text, /1234 1234567890/);
  });
});
