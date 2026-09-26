"use client";

import { useMemo, useState } from "react";
import { createQuoteAction } from "@/app/actions/quotes";
import { QuoteDocument } from "@/components/QuoteDocument";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Input, Select, Textarea } from "@/components/ui";
import { CASE_TRADES, PRICING_MODE_LABELS, PRICING_MODES, TRADE_LABELS } from "@/lib/catalog";
import { parseKrToOre } from "@/lib/money";

type Address = { id: string; street: string; postal: string; city: string };
type Customer = { id: string; name: string; phone?: string; email?: string; addresses: Address[] };

type DraftLine = {
  key: string;
  description: string;
  kind: string;
  quantity: string;
  price: string;
  cost: string;
};

function newLine(): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    kind: "YDELSE",
    quantity: "1",
    price: "",
    cost: "",
  };
}

export function QuoteComposer({
  customers,
  nextQuoteNumber,
  companyName,
  logoUrl,
}: {
  customers: Customer[];
  nextQuoteNumber: string;
  companyName: string;
  logoUrl?: string;
}) {
  const [customerId, setCustomerId] = useState("");
  const [addressId, setAddressId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [street, setStreet] = useState("");
  const [postal, setPostal] = useState("");
  const [city, setCity] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => Array.from({ length: 5 }, () => newLine()));
  const validUntil = useMemo(() => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), []);

  const customer = customers.find((row) => row.id === customerId);
  const addresses = customer?.addresses ?? [];
  const pickedAddress =
    addresses.find((row) => row.id === addressId) ?? addresses[0] ?? null;
  const address = street || postal || city ? { street, postal, city } : pickedAddress;

  const previewLines = lines
    .filter((line) => line.description.trim())
    .map((line) => ({
      description: line.description.trim(),
      quantity: Number.parseFloat(line.quantity.replace(",", ".")) || 1,
      unitPrice: parseKrToOre(line.price || "0"),
    }));

  function applyAddress(row?: Address | null) {
    setStreet(row?.street ?? "");
    setPostal(row?.postal ?? "");
    setCity(row?.city ?? "");
  }

  function pickCustomer(id: string) {
    setCustomerId(id);
    const row = customers.find((item) => item.id === id);
    const nextAddress = row?.addresses[0] ?? null;
    setAddressId(nextAddress?.id ?? "");
    setCustomerName(row?.name ?? "");
    setCustomerPhone(row?.phone ?? "");
    setCustomerEmail(row?.email ?? "");
    applyAddress(nextAddress);
  }

  function pickAddress(id: string) {
    setAddressId(id);
    applyAddress(addresses.find((item) => item.id === id) ?? null);
  }

  return (
    <form action={createQuoteAction} className="inv-layout">
      <section className="inv-editor space-y-4">
        <h2 className="font-serif text-xl">Tilbuddet</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kunde">
            <Select name="customerId" value={customerId} onChange={(event) => pickCustomer(event.target.value)}>
              <option value="">Ny kunde…</option>
              {customers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Titel">
            <Input
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Udskiftning af køkkenbord"
            />
          </Field>
          <Field label="Kundenavn">
            <Input
              name="customerName"
              required
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              placeholder="Navn"
            />
          </Field>
          <Field label="Telefon">
            <Input
              name="customerPhone"
              type="tel"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </Field>
          <Field label="E-mail">
            <Input
              name="customerEmail"
              type="email"
              value={customerEmail}
              onChange={(event) => setCustomerEmail(event.target.value)}
            />
          </Field>
          <Field label="Adresse">
            <Input
              name="customerAddress"
              value={street}
              onChange={(event) => setStreet(event.target.value)}
            />
          </Field>
          <Field label="Postnr.">
            <Input name="customerPostal" value={postal} onChange={(event) => setPostal(event.target.value)} />
          </Field>
          <Field label="By">
            <Input name="customerCity" value={city} onChange={(event) => setCity(event.target.value)} />
          </Field>
          {customer ? (
            <Field label="Gemt adresse">
              <Select name="addressId" value={addressId} onChange={(event) => pickAddress(event.target.value)}>
                <option value="">Kundens primære adresse</option>
                {addresses.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.street}, {row.postal} {row.city}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Field label="Fag">
            <Select name="trade" defaultValue="ANDET">
              {CASE_TRADES.map((trade) => (
                <option key={trade} value={trade}>
                  {TRADE_LABELS[trade]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prisform">
            <Select name="pricingMode" defaultValue="FAST_PRIS">
              {PRICING_MODES.map((mode) => (
                <option key={mode} value={mode}>
                  {PRICING_MODE_LABELS[mode]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Beskrivelse">
              <Textarea
                name="description"
                rows={4}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-serif text-lg">Kalkulation</h3>
          <div className="overflow-x-auto">
          <div className="inv-lines min-w-[40rem]">
            <div className="inv-line inv-line-head quote-line-head">
              <span>Beskrivelse</span>
              <span>Type</span>
              <span>Antal</span>
              <span>Salgspris</span>
              <span>Kostpris</span>
              <span />
            </div>
            {lines.map((line) => (
              <div key={line.key} className="inv-line quote-line">
                <input
                  name="lineDescription"
                  value={line.description}
                  placeholder="Beskrivelse"
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row) => (row.key === line.key ? { ...row, description: event.target.value } : row)),
                    )
                  }
                />
                <select
                  name="lineKind"
                  value={line.kind}
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row) => (row.key === line.key ? { ...row, kind: event.target.value } : row)),
                    )
                  }
                >
                  <option value="YDELSE">Ydelse</option>
                  <option value="MATERIALE">Materiale</option>
                  <option value="TIMER">Timer</option>
                </select>
                <input
                  name="lineQuantity"
                  value={line.quantity}
                  placeholder="Antal"
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row) => (row.key === line.key ? { ...row, quantity: event.target.value } : row)),
                    )
                  }
                />
                <input
                  name="linePrice"
                  value={line.price}
                  placeholder="kr."
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row) => (row.key === line.key ? { ...row, price: event.target.value } : row)),
                    )
                  }
                />
                <input
                  name="lineCost"
                  value={line.cost}
                  placeholder="kr."
                  onChange={(event) =>
                    setLines((current) =>
                      current.map((row) => (row.key === line.key ? { ...row, cost: event.target.value } : row)),
                    )
                  }
                />
                <button
                  type="button"
                  className="inv-line-remove"
                  disabled={lines.length <= 1}
                  onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}
                >
                  Fjern
                </button>
              </div>
            ))}
          </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="inv-chip" onClick={() => setLines((current) => [...current, newLine()])}>
              Tilføj linje
            </button>
            <SubmitButton>Gem tilbud</SubmitButton>
          </div>
          <p className="mt-3 text-xs text-muted">Kostpris vises kun internt. Kunden ser salgspris, moms og total.</p>
        </div>
      </section>

      <aside className="inv-preview quote-preview">
        <p className="inv-preview-label no-print">Sådan ser kunden det</p>
        <QuoteDocument
          quoteNumber={nextQuoteNumber}
          title={title}
          description={description}
          validUntil={validUntil}
          customerName={customerName}
          address={address}
          lines={previewLines}
          companyName={companyName}
          logoUrl={logoUrl}
        />
      </aside>
    </form>
  );
}
