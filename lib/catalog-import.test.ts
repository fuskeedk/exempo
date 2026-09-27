import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCatalogCsv, parseListPriceToOre } from "./catalog-import";

describe("parseListPriceToOre", () => {
  it("reads Danish and English decimals", () => {
    assert.equal(parseListPriceToOre("14,50"), 1450);
    assert.equal(parseListPriceToOre("1.234,56"), 123456);
    assert.equal(parseListPriceToOre("12.50"), 1250);
    assert.equal(parseListPriceToOre("227"), 22700);
  });
});

describe("parseCatalogCsv", () => {
  it("maps a STARK-style semicolon file", () => {
    const rows = parseCatalogCsv(`Varenr;Varenavn;EAN;Indkøbspris;Salgspris;Enhed
1017040421;Fuga Halvtangent hvid;5703302100700;9,80;14,50;stk
;uden nummer;1;1;1;stk
`);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.sku, "1017040421");
    assert.equal(rows[0]?.costPrice, 980);
    assert.equal(rows[0]?.salePrice, 1450);
    assert.equal(rows[0]?.barcode, "5703302100700");
  });

  it("maps English headers and comma CSV", () => {
    const rows = parseCatalogCsv(`ItemNumber,Name,Barcode,NetPrice,SalesPrice
LM-1,"Kabel 2,5 mm",570111,8.20,12.50
`);
    assert.equal(rows[0]?.sku, "LM-1");
    assert.equal(rows[0]?.name, "Kabel 2,5 mm");
    assert.equal(rows[0]?.costPrice, 820);
    assert.equal(rows[0]?.salePrice, 1250);
  });
});
