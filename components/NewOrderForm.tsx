"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { createCaseAction } from "@/app/actions/cases";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { PrintButton } from "@/components/PrintButton";
import {
  ORDER_TYPE_LABELS,
  ORDER_TYPES,
  PRICING_MODES,
  PRICING_MODE_LABELS,
  CASE_TRADES,
  TRADE_LABELS,
  type PricingMode,
} from "@/lib/catalog";
import { percent } from "@/lib/money";

type Address = { id: string; label: string; street: string; postal: string; city: string };
type Customer = {
  id: string;
  name: string;
  cvr: string;
  email: string;
  phone: string;
  addresses: Address[];
};
type Employee = { id: string; name: string; role: string; trade: string };

const SHORTCUTS = [
  ["#kunde", "Kunde"],
  ["#ordrebeskrivelse", "Ordrebeskrivelse"],
  ["#opfoelgning", "Opfølgning"],
  ["#noter", "Noter"],
  ["#pris", "Pris og tidsfrister"],
  ["#medarbejdere", "Medarbejdere"],
  ["#bekraeftelse", "Ordrebekræftelse"],
  ["#kalkulation", "Kalkulation"],
] as const;

export function NewOrderForm({
  customers,
  employees,
  currentUserId,
}: {
  customers: Customer[];
  employees: Employee[];
  currentUserId: string;
}) {
  const [customerId, setCustomerId] = useState("");
  const [description, setDescription] = useState("");
  const [sale, setSale] = useState("");
  const [cost, setCost] = useState("");
  const [pricingMode, setPricingMode] = useState<PricingMode>("FORBRUG");
  const [sameBilling, setSameBilling] = useState(true);
  const [sameInstall, setSameInstall] = useState(true);

  const selected = customers.find((row) => row.id === customerId);
  const coverage = useMemo(() => {
    const s = parseDa(sale);
    const c = parseDa(cost);
    if (s <= 0) return null;
    return (s - c) / s;
  }, [sale, cost]);

  function applyCustomer(id: string) {
    setCustomerId(id);
  }

  const picked = selected?.addresses[0];

  return (
    <form id="new-order" action={createCaseAction} className="wo wo-new">
      <div className="wo-top">
        <h1>Ny ordre</h1>
      </div>

      <div className="wo-layout">
        <div className="wo-main">
          <div className="wo-strip">
            <div className="wo-pipeline">
              <span className="wo-chevron wo-chevron--current">
                <span className="wo-chevron-static">Ordre ▾</span>
              </span>
              <span className="wo-chevron wo-chevron--todo">
                <span className="wo-chevron-static">Arbejde ▾</span>
              </span>
              <span className="wo-chevron wo-chevron--done">
                <span className="wo-chevron-static">Faktura</span>
              </span>
            </div>
            <div className="wo-kpis">
              <div className="wo-kpi">
                <strong>{coverage === null ? "— %" : percent(coverage)}</strong>
                <span>Dækningsgrad</span>
              </div>
              <div className="wo-kpi">
                <strong>kr {sale || "0,00"}</strong>
                <span>{pricingMode === "FAST_PRIS" ? "aftalt beløb" : "omsætning"}</span>
              </div>
              <div className="wo-kpi">
                <strong>0 timer</strong>
                <span>Timer forbrugt i alt</span>
              </div>
            </div>
          </div>

          <Section id="kunde" title="Kunde">
            <div className="wo-grid-2">
              <label>
                Kundenavn
                <input name="customerName" required key={`name-${customerId}`} defaultValue={selected?.name ?? ""} />
              </label>
              <label>
                Søg kunde
                <select value={customerId} name="customerId" onChange={(event) => applyCustomer(event.target.value)}>
                  <option value="">Kundenavn, kundeadresse, etc.</option>
                  {customers.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                      {row.addresses[0] ? ` · ${row.addresses[0].street}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kundenummer
                <input name="customerNumber" readOnly placeholder={selected ? selected.id.slice(-6).toUpperCase() : ""} />
              </label>
              <label>
                CVR nr.
                <input name="vatNumber" key={`cvr-${customerId}`} defaultValue={selected?.cvr ?? ""} />
              </label>
              <label>
                Policenr.
                <input name="claimNumber" />
              </label>
              <label>
                Deres ref.
                <input name="referencePerson" />
              </label>
              <label>
                Momsregistreringsnummer
                <input name="vatNumber2" />
              </label>
              <label>
                Land
                <input name="country" defaultValue="DK" />
              </label>
            </div>

            <h3 className="wo-sub">Kontaktadresse</h3>
            <div className="wo-grid-2">
              <label>
                Navn
                <input name="contactName" />
              </label>
              <label>
                Kontaktperson
                <input name="attn" />
              </label>
              <label>
                Att.
                <input name="attn2" />
              </label>
              <label>
                Telefon
                <input name="customerPhone" type="tel" inputMode="tel" key={`phone-${customerId}`} defaultValue={selected?.phone ?? ""} />
              </label>
              <label>
                Mobil
                <input name="customerMobile" type="tel" inputMode="tel" />
              </label>
              <label>
                Mail
                <input name="customerEmail" type="email" key={`email-${customerId}`} defaultValue={selected?.email ?? ""} />
              </label>
              <AddressAutocomplete
                variant="wo"
                streetName="customerAddress"
                postalName="customerPostal"
                cityName="customerCity"
                streetRequired
                resetKey={customerId}
                defaultStreet={picked?.street ?? ""}
                defaultPostal={picked?.postal ?? ""}
                defaultCity={picked?.city ?? ""}
              />
              <label>
                Adresse 2
                <input name="address2" />
              </label>
            </div>

            <h3 className="wo-sub">Faktureringsadresse</h3>
            <label className="wo-check">
              <input type="checkbox" checked={sameBilling} onChange={(event) => setSameBilling(event.target.checked)} />
              Faktureringsadressen er den samme som kontaktadressen
            </label>
            {sameBilling ? null : (
              <div className="wo-grid-2">
                <AddressAutocomplete
                  variant="wo"
                  streetName="billingAddress"
                  postalName="billingPostal"
                  cityName="billingCity"
                />
              </div>
            )}

            <h3 className="wo-sub">Installationsadresse</h3>
            <label className="wo-check">
              <input type="checkbox" checked={sameInstall} onChange={(event) => setSameInstall(event.target.checked)} />
              Installationsadressen er den samme som kontaktadressen
            </label>
            {sameInstall ? (
              <input type="hidden" name="sameInstall" value="1" />
            ) : (
              <div className="wo-grid-2">
                <AddressAutocomplete
                  variant="wo"
                  streetName="installAddress"
                  postalName="installPostal"
                  cityName="installCity"
                />
              </div>
            )}
          </Section>

          <Section id="ordrebeskrivelse" title="Ordrebeskrivelse">
            <div className="wo-grid-2">
              <label>
                Ordretype
                <select name="orderType" defaultValue="SKADE">
                  <option value="">Vælg ordretype</option>
                  {ORDER_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ORDER_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Ordreansvarlig afd.
                <select name="trade" defaultValue="ANDET">
                  {CASE_TRADES.map((trade) => (
                    <option key={trade} value={trade}>
                      {TRADE_LABELS[trade]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Rek.nr.
                <input name="requisition" />
              </label>
              <label>
                Deres ref.
                <input name="theirRef" />
              </label>
              <label className="wo-span">
                Arbejdsbeskrivelse
                <textarea
                  name="description"
                  rows={6}
                  maxLength={4000}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <span className="wo-count">{description.length} / 4000</span>
              </label>
            </div>
          </Section>

          <Section id="opfoelgning" title="Opfølgning">
            <div className="wo-grid-2">
              <label>
                Opfølgningsdato
                <input type="date" name="followUpAt" />
              </label>
              <label>
                Note
                <input name="followUpNote" />
              </label>
            </div>
          </Section>

          <Section id="noter" title="Noter">
            <label className="wo-span">
              Tilføj note
              <textarea name="note" rows={3} placeholder="Ingen tilgængelige noter" />
            </label>
          </Section>

          <Section id="pris" title="Pris og tidsfrister">
            <p className="wo-hint">Ordren faktureres efter</p>
            <div className="wo-radios">
              {PRICING_MODES.map((mode) => (
                <label key={mode}>
                  <input
                    type="radio"
                    name="pricingMode"
                    value={mode}
                    checked={pricingMode === mode}
                    onChange={() => setPricingMode(mode)}
                  />
                  {mode === "FORBRUG" ? "Forbrug" : PRICING_MODE_LABELS[mode]}
                </label>
              ))}
            </div>
            {pricingMode === "FAST_PRIS" ? (
              <p className="wo-hint">Skriv det beløb kunden har sagt ja til. Det er det, der kommer på fakturaen.</p>
            ) : null}
            <div className="wo-grid-2">
              {pricingMode === "FORBRUG" ? (
                <>
                  <input type="hidden" name="estimatedRevenue" value={sale} />
                  <input type="hidden" name="estimatedCost" value={cost} />
                </>
              ) : (
                <>
                  <label>
                    {pricingMode === "FAST_PRIS" ? "Aftalt beløb, kr." : "Beregnet salgspris, kr."}
                    <input
                      name="estimatedRevenue"
                      required={pricingMode === "FAST_PRIS"}
                      inputMode="decimal"
                      placeholder="fx 12.500,00"
                      value={sale}
                      onChange={(event) => setSale(event.target.value)}
                    />
                  </label>
                  <label>
                    {pricingMode === "FAST_PRIS" ? "Forventet omkostning, kr." : "Beregnet omkostning, kr."}
                    <input
                      name="estimatedCost"
                      inputMode="decimal"
                      placeholder="fx 8.000,00"
                      value={cost}
                      onChange={(event) => setCost(event.target.value)}
                    />
                  </label>
                  <label>
                    Dækningsgrad
                    <input readOnly value={coverage === null ? "—" : percent(coverage)} />
                  </label>
                </>
              )}
              <label>
                Arbejdet påbegyndes
                <input type="date" name="workStart" />
              </label>
              <label>
                Arbejdet afsluttes senest
                <input type="date" name="workEnd" />
              </label>
            </div>
            <label className="wo-check">
              <input type="checkbox" name="reverseCharge" value="1" />
              Omvendt betalingspligt er slået fra
            </label>
          </Section>

          <Section id="medarbejdere" title="Medarbejdere">
            <div className="wo-grid-2">
              <label>
                Ansvarlig
                <select name="projectLeaderId" defaultValue={currentUserId}>
                  <option value="">Ingen</option>
                  {employees
                    .filter((row) => row.role === "PL" || row.role === "ADMIN")
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Tilknyttede medarbejdere
                <select name="assignedToId" defaultValue="">
                  <option value="">Ingen</option>
                  {employees.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Section>

          <Section id="bekraeftelse" title="Ordrebekræftelse">
            <label className="wo-span">
              Ordrebekræftelsestekst
              <textarea name="confirmationText" rows={8} />
            </label>
          </Section>

          <Section id="kalkulation" title="Kalkulation">
            <p className="wo-empty">Ingen materialer registreret</p>
          </Section>
        </div>

        <aside className="wo-rail no-print">
          <h2>Handlinger</h2>
          <div className="wo-actions wo-actions--wide">
            <ApproveButton />
            <PrintButton>🖨</PrintButton>
          </div>
          <h2>Genveje</h2>
          <nav className="wo-shortcuts">
            {SHORTCUTS.map(([href, label]) => (
              <a key={href} href={href}>
                {label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </form>
  );
}

function ApproveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="wo-approve" disabled={pending}>
      {pending ? "Gemmer…" : "Godkend ordre"}
    </button>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="wo-section">
      <header>
        <h2>{title}</h2>
      </header>
      <div className="wo-section-body">{children}</div>
    </section>
  );
}

function parseDa(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number.parseFloat(normalized);
  return Number.isNaN(n) ? 0 : n;
}

