import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsv, rowsFromUpload } from "./spreadsheet";
import { utils, write } from "xlsx";
import {
  mapCaseState,
  mapMigration,
  mapTrade,
  matchPerson,
  parseLooseDate,
  splitAddressLine,
} from "./migration";

const minubaCustomers = `Kunde nr.;Kundenavn;Kundebeskrivelse;Betalingsfrist;Att.;Adresse;Adresse2;Postnr.;By;Land;Beskrivelse;Tlf.;Mobil;E-mail;GLN nr.;Att.;Adresse;Postnr.;By
1042;Renovo ApS;Ladebokse;8;Mads;Vesterbro 14;;9000;Aalborg;Danmark;;75111111;25135565;mads@example.dk;579000;;;9000;Aalborg
1043;Anne Holm;;14;;Algade 5, 4000 Roskilde;;;;;;;;anne@example.dk;;;;
`;

const minubaOrders = `Ordrenummer;Kunde-nr.;Overskrift;Ordrebeskrivelse;Status;Afdeling;Ansvarlig;Installationsadresse;Startdato;Fast pris
551;1042;Montering af ladeboks;Udskiftning;Igang;Elektriker;Anders Berg;Engelstrupvej 14, 4733 Tappernøje;29-09-2026;12500,50
552;1043;Badeværelse;Fliser;Arkiv;Murer;Lars Holm;Vesterbro 14;01/03/2024;0
`;

describe("overflytning", () => {
  it("reads a Minuba customer export and keeps the contact address", () => {
    const sheet = mapMigration(parseCsv(minubaCustomers));
    assert.equal(sheet.source, "minuba");
    assert.equal(sheet.kind, "kunder");
    assert.equal(sheet.customers.length, 2);
    assert.equal(sheet.customers[0].externalNumber, "1042");
    assert.equal(sheet.customers[0].street, "Vesterbro 14");
    assert.equal(sheet.customers[0].postal, "9000");
    assert.equal(sheet.customers[0].city, "Aalborg");
    assert.equal(sheet.customers[0].phone, "25135565");
    assert.equal(sheet.customers[0].email, "mads@example.dk");
    assert.equal(sheet.customers[1].postal, "4000");
    assert.equal(sheet.customers[1].city, "Roskilde");
    assert.equal(sheet.customers[1].street, "Algade 5");
  });

  it("reads Minuba orders with status, trade and price", () => {
    const sheet = mapMigration(parseCsv(minubaOrders));
    assert.equal(sheet.source, "minuba");
    assert.equal(sheet.kind, "ordrer");
    assert.equal(sheet.orders[0].externalNumber, "551");
    assert.equal(sheet.orders[0].customerNumber, "1042");
    assert.equal(sheet.orders[0].state, "I_GANG");
    assert.equal(sheet.orders[0].trade, "ELEKTRIKER");
    assert.equal(sheet.orders[0].postal, "4733");
    assert.equal(sheet.orders[0].city, "Tappernøje");
    assert.equal(sheet.orders[0].priceOre, 1250050);
    assert.equal(sheet.orders[0].start?.getDate(), 29);
    assert.equal(sheet.orders[1].state, "AFSLUTTET");
    assert.equal(sheet.orders[1].trade, "MURER");
  });

  it("recognises Ordrestyring, Apacta and a plain sheet", () => {
    const debtors = mapMigration(
      parseCsv("Kundenummer;Kundenavn;Adresse;Postnummer;By;Fakturanavn;Betalingsbetingelser\n8;Holm A/S;Boulevarden 1;9000;Aalborg;Holm A/S;8 dage\n"),
    );
    assert.equal(debtors.source, "ordrestyring");
    assert.equal(debtors.kind, "kunder");
    assert.equal(debtors.customers[0].name, "Holm A/S");

    const jobs = mapMigration(
      parseCsv("Sagsnr;Sagsnavn;Kunde;Status\n12;Tagudskiftning;Holm A/S;Færdigmeldt\n"),
      "apacta",
    );
    assert.equal(jobs.source, "apacta");
    assert.equal(jobs.orders[0].state, "KLAR_TIL_FAKTURA");
    assert.equal(jobs.orders[0].customerName, "Holm A/S");

    const plain = mapMigration(parseCsv("Navn;Telefon;Adresse;Postnr;By\nPia;11223344;Hovedvejen 4;2600;Glostrup\n"));
    assert.equal(plain.source, "andet");
    assert.equal(plain.kind, "kunder");
    assert.equal(plain.customers[0].phone, "11223344");
  });

  it("reads a material list as products", () => {
    const sheet = mapMigration(parseCsv("Varenr;Varenavn;Enhed;Kostpris\nEL-1;Afbryder;stk;49,95\n"));
    assert.equal(sheet.kind, "varer");
    assert.equal(sheet.products[0].sku, "EL-1");
    assert.equal(sheet.products[0].costPrice, 4995);
  });

  it("maps states, trades, dates and people", () => {
    assert.equal(mapCaseState("Tilbud"), "NY");
    assert.equal(mapCaseState("Faktureret"), "FAKTURERET");
    assert.equal(mapTrade("VVS-afdeling"), "VVS");
    assert.equal(mapTrade("Tømrer"), "TOMRER");
    assert.equal(parseLooseDate("2026-09-29")?.getMonth(), 8);
    assert.equal(splitAddressLine("Vesterbro 14, st. tv, 9000 Aalborg").postal, "9000");
    assert.equal(matchPerson("Anders Berg", [{ id: "a", name: "Anders Berg" }, { id: "b", name: "Lars Holm" }]), "a");
    assert.equal(matchPerson("Berg", [{ id: "a", name: "Anders Berg" }, { id: "b", name: "Lars Holm" }]), "a");
    assert.equal(matchPerson("Berg", [{ id: "a", name: "Anders Berg" }, { id: "b", name: "Mads Berg" }]), "");
  });

  it("reads an Excel file", async () => {
    const book = utils.book_new();
    utils.book_append_sheet(
      book,
      utils.aoa_to_sheet([
        ["Kundenavn", "Postnr", "By"],
        ["Holm", "9000", "Aalborg"],
      ]),
      "Kunder",
    );
    const buffer = write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
    const file = new File([new Uint8Array(buffer)], "kunder.xlsx");
    const sheet = mapMigration(await rowsFromUpload(file), "ordrestyring");
    assert.equal(sheet.kind, "kunder");
    assert.equal(sheet.customers[0].city, "Aalborg");
    assert.equal(sheet.source, "ordrestyring");
  });
});
