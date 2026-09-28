import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bookInvoice } from "./bookkeeping";
import { electricianSlutkontrolDone } from "./kls-catalog";
import { payrollExportFilter } from "./payroll-export";
import { customerSmsText, msisdn, smsSender } from "./sms";

const invoice = {
  invoiceNumber: "FAK-1",
  issuedAt: new Date("2026-09-28T10:00:00.000Z"),
  lines: [{ description: "Time", quantity: 2, unitPrice: 45000 }],
  customerName: "Renovo",
  email: "kunde@example.dk",
  address: "Vej 1",
  postal: "4000",
  city: "Roskilde",
  phone: "12345678",
};

const emptyBooks = {
  accounting_provider: "",
  economic_agreement_grant: "",
  economic_app_secret: "",
  billy_api_key: "",
  billy_org_id: "",
  dinero_api_key: "",
  dinero_org_id: "",
  dinero_client_id: "",
  dinero_client_secret: "",
};

describe("SMS", () => {
  it("normalises Danish numbers", () => {
    assert.equal(msisdn("12 34 56 78"), "4512345678");
    assert.equal(msisdn("+45 12 34 56 78"), "4512345678");
    assert.equal(msisdn("123"), null);
  });

  it("writes the customer texts", () => {
    assert.equal(
      customerSmsText("idag", { customerName: "Mette Hansen", company: "Syd El", worker: "Bo", from: "08:00", to: "10:00" }),
      "Hej Mette. Vi kommer mellem 08:00 og 10:00. Syd El",
    );
    assert.equal(
      customerSmsText("paa_vej", { customerName: "Mette Hansen", company: "Syd El", worker: "Bo" }),
      "Hej Mette. Bo er på vej. Syd El",
    );
    assert.equal(smsSender("Syd El A/S"), "Syd El AS");
  });
});

describe("slutkontrol", () => {
  it("requires a signed complete electrical report", () => {
    assert.equal(electricianSlutkontrolDone([]), false);
    assert.equal(
      electricianSlutkontrolDone([
        { templateName: "Slutkontrol — El", signedAt: null, checks: [{ status: "OK" }] },
      ]),
      false,
    );
    assert.equal(
      electricianSlutkontrolDone([
        { templateName: "Slutkontrol — El", signedAt: "2026-09-28", checks: [{ status: "PENDING" }] },
      ]),
      false,
    );
    assert.equal(
      electricianSlutkontrolDone([
        {
          templateName: "Slutkontrol — El",
          signedAt: "2026-09-28",
          checks: [{ status: "OK" }, { status: "NA" }, { status: "AFVIGELSE" }],
        },
      ]),
      true,
    );
  });
});

describe("løneksport", () => {
  it("exports approved timesheets unless a status is chosen", () => {
    assert.deepEqual(payrollExportFilter(null), { in: ["GODKENDT"] });
    assert.deepEqual(payrollExportFilter("alle"), { in: ["GODKENDT"] });
    assert.equal(payrollExportFilter("AFLEVERET"), "AFLEVERET");
  });
});

describe("bogføring", () => {
  it("skips when no provider is selected", async () => {
    const result = await bookInvoice(emptyBooks, invoice, async () => {
      throw new Error("should not call");
    });
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.skipped, true);
  });

  it("posts an e-conomic draft for an existing customer", async () => {
    const calls: string[] = [];
    const result = await bookInvoice(
      { ...emptyBooks, accounting_provider: "economic", economic_agreement_grant: "a", economic_app_secret: "b" },
      invoice,
      async (url, init) => {
        calls.push(`${init?.method ?? "GET"} ${url}`);
        if (String(url).includes("/customers?")) {
          return new Response(JSON.stringify({ collection: [{ customerNumber: 7 }] }), { status: 200 });
        }
        return new Response(JSON.stringify({ draftInvoiceNumber: 42 }), { status: 200 });
      },
    );
    assert.equal(result.ok, true);
    if (result.ok) assert.equal(result.ref, "economic:42");
    assert.equal(calls.some((call) => call.startsWith("POST")), true);
  });
});
