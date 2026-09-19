import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransition } from "./fsm";
import { caseEconomics, rollupEconomics } from "./coverage";

describe("FSM", () => {
  it("blocks skip from NY to faktura", () => {
    const result = canTransition("NY", "FAKTURERET");
    assert.equal(result.ok, false);
  });

  it("requires signed KLS before ready to invoice", () => {
    const blocked = canTransition("KLS", "KLAR_TIL_FAKTURA", { hasSignedKls: false });
    assert.equal(blocked.ok, false);
    const allowed = canTransition("KLS", "KLAR_TIL_FAKTURA", { hasSignedKls: true });
    assert.equal(allowed.ok, true);
  });

  it("requires calendar assignment before PLANLAGT", () => {
    const blocked = canTransition("NY", "PLANLAGT", { isScheduled: false });
    assert.equal(blocked.ok, false);
  });
});

describe("dækningsgrad", () => {
  it("uses estimate until a sent invoice exists", () => {
    const economics = caseEconomics({
      estimatedRevenue: 100_000_00,
      invoices: [
        {
          status: "KLADDE",
          lines: [{ quantity: 1, unitPrice: 50_000_00 }],
        },
      ],
      timeEntries: [{ hours: 10, hourlyRate: 450_00 }],
      materials: [{ quantity: 1, unitPrice: 10_000_00 }],
    });
    assert.equal(economics.usingEstimate, true);
    assert.equal(economics.revenue, 100_000_00);
    assert.equal(economics.cost, 14_500_00);
    assert.equal(economics.coverage, (100_000_00 - 14_500_00) / 100_000_00);
  });

  it("rolls up portfolio coverage", () => {
    const total = rollupEconomics([
      {
        revenue: 100,
        billed: 100,
        laborCost: 30,
        materialCost: 20,
        cost: 50,
        contribution: 50,
        coverage: 0.5,
        usingEstimate: false,
      },
      {
        revenue: 100,
        billed: 100,
        laborCost: 10,
        materialCost: 10,
        cost: 20,
        contribution: 80,
        coverage: 0.8,
        usingEstimate: false,
      },
    ]);
    assert.equal(total.coverage, 0.65);
  });
});
