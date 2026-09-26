import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ensureCustomerFromForm, readCustomerDraft, type CustomerStore } from "./customer-from-form";

function form(entries: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(entries)) {
    data.set(key, value);
  }
  return data;
}

describe("readCustomerDraft", () => {
  it("reads the sag and tilbud field names", () => {
    const draft = readCustomerDraft(
      form({
        customerName: "Anna Holm",
        customerAddress: "Strandvejen 12",
        customerPostal: "2100",
        customerCity: "København Ø",
        customerPhone: "40112233",
        customerEmail: "anna@example.dk",
        vatNumber: "12345678",
      }),
    );
    assert.equal(draft.name, "Anna Holm");
    assert.equal(draft.street, "Strandvejen 12");
    assert.equal(draft.postal, "2100");
    assert.equal(draft.city, "København Ø");
    assert.equal(draft.phone, "40112233");
    assert.equal(draft.email, "anna@example.dk");
    assert.equal(draft.cvr, "12345678");
  });

  it("falls back to the kunde-formular aliases", () => {
    const draft = readCustomerDraft(
      form({
        name: "Bo Vind",
        street: "Torvet 1",
        postal: "4000",
        city: "Roskilde",
        phone: "20202020",
        email: "bo@example.dk",
        cvr: "87654321",
      }),
    );
    assert.equal(draft.name, "Bo Vind");
    assert.equal(draft.street, "Torvet 1");
    assert.equal(draft.cvr, "87654321");
  });
});

describe("ensureCustomerFromForm", () => {
  it("reuses a picked customer and their address", async () => {
    const store: CustomerStore = {
      customer: {
        async findUnique() {
          return {
            id: "cust-1",
            name: "Kragh ApS",
            phone: "11111111",
            email: "mail@kragh.dk",
            addresses: [{ id: "addr-1", street: "Industrivej 4", postal: "2600", city: "Glostrup" }],
          };
        },
        async create() {
          throw new Error("should not create");
        },
      },
    };

    const resolved = await ensureCustomerFromForm(
      store,
      form({ customerId: "cust-1", addressId: "addr-1" }),
    );
    assert.equal(resolved.created, false);
    assert.equal(resolved.customerId, "cust-1");
    assert.equal(resolved.addressId, "addr-1");
    assert.equal(resolved.customerName, "Kragh ApS");
    assert.equal(resolved.customerAddress, "Industrivej 4");
  });

  it("creates a customer from typed fields when none is picked", async () => {
    const store: CustomerStore = {
      customer: {
        async findUnique() {
          return null;
        },
        async create(args) {
          return {
            id: "cust-new",
            name: args.data.name,
            phone: args.data.phone,
            email: args.data.email,
            addresses: args.data.addresses
              ? [
                  {
                    id: "addr-new",
                    street: args.data.addresses.create.street,
                    postal: args.data.addresses.create.postal,
                    city: args.data.addresses.create.city,
                  },
                ]
              : [],
          };
        },
      },
    };

    const resolved = await ensureCustomerFromForm(
      store,
      form({
        customerName: "Nadia Frost",
        customerAddress: "Birkevej 8",
        customerPostal: "2800",
        customerCity: "Kongens Lyngby",
        customerPhone: "30303030",
        customerEmail: "nadia@example.dk",
      }),
      { requireAddress: true },
    );
    assert.equal(resolved.created, true);
    assert.equal(resolved.customerId, "cust-new");
    assert.equal(resolved.addressId, "addr-new");
    assert.equal(resolved.customerName, "Nadia Frost");
    assert.equal(resolved.customerAddress, "Birkevej 8");
  });

  it("requires a name when creating from the form", async () => {
    const store: CustomerStore = {
      customer: {
        async findUnique() {
          return null;
        },
        async create() {
          throw new Error("should not create");
        },
      },
    };
    await assert.rejects(
      () => ensureCustomerFromForm(store, form({ title: "Udskift stikkontakt" })),
      /Kundenavn er påkrævet/,
    );
  });
});
