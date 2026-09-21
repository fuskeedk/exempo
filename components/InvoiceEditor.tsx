"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInvoiceDraftAction } from "@/app/actions/invoices";
import { InvoiceComposeDialog } from "@/components/InvoiceComposeDialog";
import { InvoiceDocument, type InvoiceCompany, type InvoiceCustomer } from "@/components/InvoiceDocument";
import { InvoiceBadge } from "@/components/StatusBadge";
import { INVOICE_KIND_LABELS, type InvoiceKind } from "@/lib/catalog";
import type { ComposeInvoiceLine } from "@/lib/coverage";
import { oreToKrInput, parseKrToOre } from "@/lib/money";

type DraftLine = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

function newLine(partial?: Partial<DraftLine>): DraftLine {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: "",
    quantity: "1",
    unitPrice: "0,00",
    ...partial,
  };
}

export function InvoiceEditor({
  invoiceId,
  invoiceNumber,
  status,
  kind: initialKind,
  notes: initialNotes,
  issuedAt,
  dueAt,
  caseNumber,
  caseTitle,
  insuranceCompany,
  claimNumber,
  company,
  customer,
  lines,
  offer,
  showComposer = false,
}: {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  kind: string;
  notes: string;
  issuedAt: string;
  dueAt: string | null;
  caseNumber: string;
  caseTitle: string;
  insuranceCompany?: string;
  claimNumber?: string;
  company: InvoiceCompany;
  customer: InvoiceCustomer;
  lines: { id: string; description: string; quantity: number; unitPrice: number }[];
  offer: { remaining: number; label: string; lines: ComposeInvoiceLine[] };
  showComposer?: boolean;
}) {
  const router = useRouter();
  const editable = status === "KLADDE";
  const [composerOpen, setComposerOpen] = useState(
    Boolean(showComposer && editable && initialKind !== "KREDITNOTA"),
  );
  const [kind, setKind] = useState(initialKind);
  const [notes, setNotes] = useState(initialNotes);
  const [due, setDue] = useState(dueAt ?? "");
  const [rows, setRows] = useState<DraftLine[]>(
    lines.length
      ? lines.map((line) =>
          newLine({
            key: line.id,
            description: line.description,
            quantity: String(line.quantity).replace(".", ","),
            unitPrice: oreToKrInput(line.unitPrice),
          }),
        )
      : [newLine()],
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const skipFirst = useRef(true);

  const previewLines = useMemo(
    () =>
      rows.map((row) => ({
        id: row.key,
        description: row.description,
        quantity: Number.parseFloat(row.quantity.replace(",", ".")) || 0,
        unitPrice: parseKrToOre(row.unitPrice),
      })),
    [rows],
  );

  function persist(
    next: { kind: string; notes: string; due: string; rows: DraftLine[]; closeOrder?: boolean } = {
      kind,
      notes,
      due,
      rows,
    },
  ) {
    if (!editable) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateInvoiceDraftAction({
          invoiceId,
          kind: next.kind,
          notes: next.notes,
          dueAt: next.due,
          closeOrder: next.closeOrder,
          lines: next.rows.map((row) => ({
            description: row.description,
            quantity: Number.parseFloat(row.quantity.replace(",", ".")) || 0,
            unitPrice: parseKrToOre(row.unitPrice),
          })),
        });
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1600);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Kunne ikke gemme fakturaen.");
      }
    });
  }

  function closeComposer() {
    setComposerOpen(false);
    router.replace(`/fakturaer/${invoiceId}`);
  }

  useEffect(() => {
    if (!editable) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const timer = window.setTimeout(() => persist(), 650);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, notes, due, rows]);

  function updateRow(key: string, patch: Partial<DraftLine>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  const kindOptions = (Object.keys(INVOICE_KIND_LABELS) as InvoiceKind[]).filter(
    (item) => initialKind === "KREDITNOTA" || item !== "KREDITNOTA",
  );

  return (
    <div className="inv-layout">
      {composerOpen ? (
        <InvoiceComposeDialog
          label={offer.label}
          remaining={offer.remaining}
          lines={offer.lines}
          onCancel={closeComposer}
          onConfirm={(result) => {
            const nextRows = result.lines.map((line) =>
              newLine({
                description: line.description,
                quantity: String(line.quantity).replace(".", ","),
                unitPrice: oreToKrInput(line.unitPrice),
              }),
            );
            setKind(result.mode);
            setRows(nextRows.length ? nextRows : [newLine()]);
            persist({
              kind: result.mode,
              notes,
              due,
              rows: nextRows.length ? nextRows : [newLine()],
              closeOrder: result.closeOrder,
            });
            closeComposer();
          }}
        />
      ) : null}
      <section className="inv-editor no-print">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-serif text-xl">Rediger</h2>
          <InvoiceBadge status={status} kind={kind} />
        </div>
        {editable ? (
          <p className="mt-1 text-xs text-muted">
            Ændringer vises med det samme i visningen. Kladde gemmes automatisk.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted">Sæt fakturaen tilbage til kladde for at redigere linjer.</p>
        )}
        {error ? <p className="mt-3 rounded-md bg-[#f3d7d4] px-3 py-2 text-sm text-[#7c2f2a]">{error}</p> : null}

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Type</span>
          <select
            disabled={!editable || initialKind === "KREDITNOTA"}
            value={kind}
            onChange={(event) => setKind(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
          >
            {kindOptions.map((item) => (
              <option key={item} value={item}>
                {INVOICE_KIND_LABELS[item]}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Forfald</span>
          <input
            type="date"
            disabled={!editable}
            value={due}
            onChange={(event) => setDue(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
          />
        </label>

        <div className="inv-lines mt-4">
          <div className="inv-line inv-line-head">
            <span>Beskrivelse</span>
            <span>Antal</span>
            <span>Pris, kr.</span>
            <span />
          </div>
          {rows.map((row) => (
            <div key={row.key} className="inv-line">
              <input
                disabled={!editable}
                value={row.description}
                placeholder="Ydelse, materialer eller aconto"
                onChange={(event) => updateRow(row.key, { description: event.target.value })}
              />
              <input
                disabled={!editable}
                inputMode="decimal"
                value={row.quantity}
                onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
              />
              <input
                disabled={!editable}
                inputMode="decimal"
                value={row.unitPrice}
                onChange={(event) => updateRow(row.key, { unitPrice: event.target.value })}
              />
              <button
                type="button"
                disabled={!editable || rows.length === 1}
                className="inv-line-remove"
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                Fjern
              </button>
            </div>
          ))}
        </div>

        {editable ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="inv-chip" onClick={() => setRows((current) => [...current, newLine()])}>
              Tilføj linje
            </button>
            <button type="button" className="inv-chip" onClick={() => setComposerOpen(true)}>
              Tilføj fakturalinjer
            </button>
            <button
              type="button"
              className="inv-chip"
              onClick={() => {
                setKind("ACONTO");
                setRows((current) => [
                  ...current,
                  newLine({ description: "Aconto", quantity: "1", unitPrice: "0,00" }),
                ]);
              }}
            >
              Tilføj aconto
            </button>
            <button type="button" className="inv-chip inv-chip--solid" onClick={() => persist()} disabled={pending}>
              {pending ? "Gemmer…" : saved ? "Gemt" : "Gem"}
            </button>
          </div>
        ) : null}

        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Note på fakturaen</span>
          <textarea
            disabled={!editable}
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5"
            placeholder="Vises nederst på fakturaen til kunden"
          />
        </label>
      </section>

      <aside className="inv-preview">
        <p className="inv-preview-label no-print">Sådan ser kunden den</p>
        <InvoiceDocument
          invoiceNumber={invoiceNumber}
          kind={kind}
          status={status}
          issuedAt={issuedAt}
          dueAt={due || null}
          notes={notes}
          caseNumber={caseNumber}
          caseTitle={caseTitle}
          insuranceCompany={insuranceCompany}
          claimNumber={claimNumber}
          company={company}
          customer={customer}
          lines={previewLines}
        />
      </aside>
    </div>
  );
}
