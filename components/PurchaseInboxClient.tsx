"use client";

import { useRef, useState } from "react";
import {
  addPurchaseFollowUpAction,
  assignPurchaseResponsibleAction,
  exportPurchasesAction,
  syncInvoiceMailAction,
  syncSproomAction,
} from "@/app/actions/purchases";
import { purchaseRoleTag } from "@/lib/purchases";

export function PurchaseFilters({
  tab,
  query,
  from,
  to,
  rows,
}: {
  tab: string;
  query: string;
  from: string;
  to: string;
  rows: number;
}) {
  return (
    <form className="purchase-toolbar" action="/indkob" method="get">
      <input type="hidden" name="fane" value={tab} />
      <label className="purchase-filter">
        Rækker pr. tabel
        <select name="rækker" defaultValue={String(rows)} onChange={(event) => event.currentTarget.form?.requestSubmit()}>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
        </select>
      </label>
      <label className="purchase-filter">
        Fakturadato / indkøbsdato fra
        <input type="date" name="fra" defaultValue={from} onChange={(event) => event.currentTarget.form?.requestSubmit()} />
      </label>
      <span className="purchase-filter-sep">til</span>
      <input
        className="purchase-date"
        type="date"
        name="til"
        defaultValue={to}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      />
      <label className="purchase-search">
        <span className="sr-only">Søg</span>
        <input type="search" name="q" defaultValue={query} placeholder="Søg" />
        <button type="submit" aria-label="Søg">
          ⌕
        </button>
      </label>
    </form>
  );
}

export function PurchaseActionsMenu({
  tab,
  sproomReady,
  mailReady,
}: {
  tab: string;
  sproomReady: boolean;
  mailReady: boolean;
}) {
  return (
    <details className="purchase-menu">
      <summary>Handlinger</summary>
      <div className="purchase-menu-list">
        <a href={`/indkob?fane=${encodeURIComponent(tab)}&ny=1`}>Registrér indkøb</a>
        <form action={syncInvoiceMailAction}>
          <input type="hidden" name="fane" value={tab} />
          <button type="submit">{mailReady ? "Hent fra mail" : "Hent fra mail (ikke sat op)"}</button>
        </form>
        <form action={syncSproomAction}>
          <input type="hidden" name="fane" value={tab} />
          <button type="submit">{sproomReady ? "Hent fra Sproom" : "Hent fra Sproom (ikke sat op)"}</button>
        </form>
        <button type="button" onClick={() => exportSelected(tab)}>
          Eksportér valgte
        </button>
      </div>
    </details>
  );
}

function exportSelected(tab: string) {
  const ids = [...document.querySelectorAll<HTMLInputElement>('input[name="purchaseId"]:checked')].map(
    (input) => input.value,
  );
  if (ids.length === 0) {
    window.alert("Vælg mindst én indkøbsfaktura.");
    return;
  }
  const fd = new FormData();
  fd.set("fane", tab);
  for (const id of ids) fd.append("ids", id);
  void exportPurchasesAction(fd);
}

export function PurchaseResponsible({
  purchaseId,
  tab,
  currentId,
  currentLabel,
  staff,
}: {
  purchaseId: string;
  tab: string;
  currentId: string;
  currentLabel: string;
  staff: Array<{ id: string; name: string; role: string }>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const hay = query.trim().toLowerCase();
  const filtered = staff.filter((person) => {
    if (!hay) return true;
    const blob = `${person.name} ${person.role} ${purchaseRoleTag(person.role)}`.toLowerCase();
    return blob.includes(hay);
  });

  return (
    <>
      <button type="button" className="purchase-link" onClick={() => setOpen(true)}>
        {currentLabel || "—"}
      </button>
      {open ? (
        <div className="purchase-dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="purchase-dialog" onClick={(event) => event.stopPropagation()}>
            <header>Indkøbsfaktura ansvarlig</header>
            <div className="purchase-dialog-body">
              <label>
                Søg
                <input
                  className="purchase-picker-search"
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Navn eller rolle…"
                  autoFocus
                />
              </label>
              <div className="purchase-picker-list">
                <form action={assignPurchaseResponsibleAction}>
                  <input type="hidden" name="id" value={purchaseId} />
                  <input type="hidden" name="fane" value={tab} />
                  <input type="hidden" name="responsibleUserId" value="" />
                  <button type="submit" aria-current={!currentId ? "true" : undefined}>
                    Ingen ansvarlig
                  </button>
                </form>
                {filtered.map((person) => (
                  <form key={person.id} action={assignPurchaseResponsibleAction}>
                    <input type="hidden" name="id" value={purchaseId} />
                    <input type="hidden" name="fane" value={tab} />
                    <input type="hidden" name="responsibleUserId" value={person.id} />
                    <button type="submit" aria-current={person.id === currentId ? "true" : undefined}>
                      {person.name} ({purchaseRoleTag(person.role)})
                    </button>
                  </form>
                ))}
                {filtered.length === 0 ? <p className="purchase-picker-empty">Ingen medarbejdere matcher.</p> : null}
              </div>
              <div className="purchase-dialog-actions">
                <button type="button" className="purchase-btn purchase-btn--ghost" onClick={() => setOpen(false)}>
                  Annullér
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function PurchaseFollowUp({
  purchaseId,
  tab,
  existing,
}: {
  purchaseId: string;
  tab: string;
  existing: string;
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <button type="button" className="purchase-link" onClick={() => setOpen(true)}>
        {existing ? existing : "Tilføj opfølgning"}
      </button>
      {open ? (
        <div className="purchase-dialog-backdrop" onClick={() => setOpen(false)}>
          <div className="purchase-dialog" onClick={(event) => event.stopPropagation()}>
            <header>Opfølgning</header>
            <form ref={formRef} action={addPurchaseFollowUpAction} className="purchase-dialog-body">
              <input type="hidden" name="id" value={purchaseId} />
              <input type="hidden" name="fane" value={tab} />
              <label>
                Note
                <textarea name="note" rows={4} defaultValue={existing} placeholder="Skriv en opfølgning…" />
              </label>
              <div className="purchase-dialog-actions">
                <button type="submit" className="purchase-btn">
                  Gem
                </button>
                <button type="button" className="purchase-btn purchase-btn--ghost" onClick={() => setOpen(false)}>
                  Annullér
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function WholesalerShop({
  cases,
  wholesalers,
}: {
  cases: Array<{ id: string; caseNumber: string; title: string }>;
  wholesalers: Array<{ id: string; name: string; loginUrl: string }>;
}) {
  const [caseId, setCaseId] = useState("");
  const selected = cases.find((row) => row.id === caseId);

  function openShop(url: string) {
    if (!caseId) {
      window.alert("Angiv en arbejdsseddel og klik på Fortsæt til webshop.");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="purchase-shop">
      <label>
        Arbejdsseddel
        <select value={caseId} onChange={(event) => setCaseId(event.target.value)}>
          <option value="">Vælg arbejdsseddel…</option>
          {cases.map((row) => (
            <option key={row.id} value={row.id}>
              {row.caseNumber} · {row.title}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <p className="purchase-shop-hint">
          Valgt: {selected.caseNumber} · {selected.title}
        </p>
      ) : (
        <p className="purchase-shop-hint">Angiv en arbejdsseddel før du åbner grossistens webshop.</p>
      )}
      <div className="purchase-shop-list">
        {wholesalers.length === 0 ? (
          <p>Ingen grossistaftaler endnu. Tilføj dem under Indstillinger.</p>
        ) : (
          wholesalers.map((row) => (
            <div key={row.id} className="purchase-shop-row">
              <span>{row.name}</span>
              {row.loginUrl ? (
                <button type="button" className="purchase-link" onClick={() => openShop(row.loginUrl)}>
                  Fortsæt til webshop
                </button>
              ) : (
                <span className="text-muted">Mangler login-link</span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function SelectAllPurchases() {
  return (
    <input
      type="checkbox"
      aria-label="Vælg alle"
      onChange={(event) => {
        const checked = event.currentTarget.checked;
        document.querySelectorAll<HTMLInputElement>('input[name="purchaseId"]').forEach((input) => {
          input.checked = checked;
        });
      }}
    />
  );
}
