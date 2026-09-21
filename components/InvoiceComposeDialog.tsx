"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatKr, oreToKrInput, parseKrToOre } from "@/lib/money";
import type { ComposeInvoiceLine } from "@/lib/coverage";

export function InvoiceComposeDialog({
  label,
  remaining,
  lines,
  onCancel,
  onConfirm,
}: {
  label: string;
  remaining: number;
  lines: ComposeInvoiceLine[];
  onCancel: () => void;
  onConfirm: (result: {
    mode: "FAKTURA" | "ACONTO";
    merge: "none" | "one";
    skipZero: boolean;
    closeOrder: boolean;
    lines: ComposeInvoiceLine[];
  }) => void;
}) {
  const [mode, setMode] = useState<"FAKTURA" | "ACONTO">("FAKTURA");
  const [merge, setMerge] = useState<"none" | "one">("none");
  const [skipZero, setSkipZero] = useState(false);
  const [closeOrder, setCloseOrder] = useState(true);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== "ACONTO") return;
    amountRef.current?.focus();
    amountRef.current?.select();
  }, [mode]);

  const acontoOre = parseKrToOre(amount);
  const preview = useMemo(() => {
    if (mode === "ACONTO") {
      return [{ description: `Aconto · ${label}`, quantity: 1, unitPrice: acontoOre }];
    }
    let next = lines.map((line) => ({ ...line }));
    if (merge === "one") {
      next = [
        {
          description: label,
          quantity: 1,
          unitPrice: remaining,
        },
      ];
    }
    if (skipZero) next = next.filter((line) => line.unitPrice !== 0);
    if (!next.length) next = [{ description: label, quantity: 1, unitPrice: remaining }];
    return next;
  }, [mode, merge, skipZero, lines, label, remaining, acontoOre]);

  const total = preview.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPrice), 0);

  function confirm() {
    if (mode === "ACONTO" && acontoOre <= 0) {
      setError("Skriv acontobeløbet.");
      amountRef.current?.focus();
      return;
    }
    onConfirm({
      mode,
      merge,
      skipZero,
      closeOrder,
      lines: preview,
    });
  }

  return (
    <div className="inv-compose-scrim" onClick={onCancel}>
      <div
        className="inv-compose"
        role="dialog"
        aria-labelledby="inv-compose-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="inv-compose-head">
          <h2 id="inv-compose-title">Tilføj fakturalinjer</h2>
          <button type="button" className="inv-compose-x" onClick={onCancel} aria-label="Luk">
            ×
          </button>
        </div>
        <div className="inv-compose-body">
          <p className="inv-compose-lead">Hvad vil du fakturere? Alle beløb er ekskl. moms.</p>

          <div className="inv-compose-offer">
            <p className="inv-compose-label">{label}</p>
            <label className="inv-compose-choice">
              <input
                type="radio"
                name="inv-mode"
                checked={mode === "FAKTURA"}
                onChange={() => {
                  setMode("FAKTURA");
                  setCloseOrder(true);
                  setError(null);
                }}
              />
              Slutfaktura — {formatKr(remaining, true)}
            </label>
            <label className="inv-compose-choice">
              <input
                type="radio"
                name="inv-mode"
                checked={mode === "ACONTO"}
                onChange={() => {
                  setMode("ACONTO");
                  setCloseOrder(false);
                  setError(null);
                }}
              />
              Aconto
            </label>
            {mode === "ACONTO" ? (
              <label className="inv-compose-amount">
                <span>Acontobeløb, kr.</span>
                <input
                  ref={amountRef}
                  inputMode="decimal"
                  value={amount}
                  placeholder={remaining > 0 ? oreToKrInput(remaining) : "0,00"}
                  onChange={(event) => {
                    setAmount(event.target.value);
                    setError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      confirm();
                    }
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "inv-aconto-error" : undefined}
                />
              </label>
            ) : null}
          </div>

          {mode === "FAKTURA" ? (
            <label className="inv-compose-field">
              <span>Sammenlæg linjer</span>
              <select value={merge} onChange={(event) => setMerge(event.target.value as "none" | "one")}>
                <option value="none">Ingen sammenlægning af linjer</option>
                <option value="one">Saml til én linje</option>
              </select>
            </label>
          ) : null}

          <p className="inv-compose-total">Fakturebeløb {formatKr(total, true)}</p>
          {error ? (
            <p id="inv-aconto-error" className="inv-compose-error">
              {error}
            </p>
          ) : null}

          {mode === "FAKTURA" ? (
            <label className="inv-compose-check">
              <input type="checkbox" checked={skipZero} onChange={(event) => setSkipZero(event.target.checked)} />
              Udelad linjer med 0 i salgspris
            </label>
          ) : null}
          <label className="inv-compose-check">
            <input
              type="checkbox"
              checked={closeOrder}
              onChange={(event) => setCloseOrder(event.target.checked)}
            />
            Afslut hele ordren
          </label>
        </div>
        <div className="inv-compose-actions">
          <button type="button" className="inv-compose-ok" onClick={confirm}>
            OK
          </button>
          <button type="button" className="inv-compose-cancel" onClick={onCancel}>
            Annullér
          </button>
        </div>
      </div>
    </div>
  );
}
