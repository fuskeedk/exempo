"use client";

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react";
import { updateMaterialPriceAction } from "@/app/actions/cases";
import { formatKrAmount, oreToKrInput, parseKrToOre, percent } from "@/lib/money";
import { markupInputValue, parseMarkupInput, saleFromMarkup, workOrderMarkup } from "@/lib/workorder";

type Field = "cost" | "markup" | "sale";

export function MaterialPriceCells({
  id,
  quantity,
  costPrice,
  unitPrice,
}: {
  id: string;
  quantity: number;
  costPrice: number;
  unitPrice: number;
}) {
  const [field, setField] = useState<Field | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [cost, setCost] = useState(costPrice);
  const [sale, setSale] = useState(unitPrice);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlur = useRef(false);
  const costRef = useRef(costPrice);
  const priceRef = useRef(unitPrice);
  const saving = useRef(false);

  useEffect(() => {
    if (field || pending) return;
    setCost(costPrice);
    setSale(unitPrice);
    costRef.current = costPrice;
    priceRef.current = unitPrice;
  }, [costPrice, unitPrice, field, pending]);

  useEffect(() => {
    if (field) inputRef.current?.select();
  }, [field]);

  const liveCost = liveOre(field === "cost" ? draft : null, cost);
  const liveSale = liveUnitPrice(field, draft, liveCost, sale);
  const liveMarkup = workOrderMarkup(liveCost, liveSale);

  function open(next: Field) {
    setError("");
    if (next === "markup" && costRef.current <= 0) next = "cost";
    const currentSale = priceRef.current;
    const currentCost = costRef.current;
    setField(next);
    setDraft(
      next === "markup"
        ? markupInputValue(workOrderMarkup(currentCost, currentSale))
        : oreToKrInput(next === "cost" ? currentCost : currentSale),
    );
  }

  function cancel() {
    setField(null);
    setDraft("");
    setError("");
  }

  function save(nextField: Field, value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      cancel();
      return;
    }
    const data = new FormData();
    data.set("id", id);
    if (nextField === "cost") {
      const nextCost = parseKrToOre(trimmed);
      if (nextCost === costRef.current) {
        cancel();
        return;
      }
      costRef.current = nextCost;
      setCost(nextCost);
      data.set("costPrice", trimmed);
    } else if (nextField === "markup") {
      let nextSale: number;
      try {
        nextSale = saleFromMarkup(costRef.current, parseMarkupInput(trimmed));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ugyldig værdi.");
        return;
      }
      priceRef.current = nextSale;
      setSale(nextSale);
      data.set("markup", trimmed);
    } else {
      const nextSale = parseKrToOre(trimmed);
      if (nextSale === priceRef.current) {
        cancel();
        return;
      }
      priceRef.current = nextSale;
      setSale(nextSale);
      data.set("unitPrice", trimmed);
    }
    setField(null);
    setDraft("");
    setError("");
    if (saving.current) return;
    saving.current = true;
    startTransition(async () => {
      try {
        await updateMaterialPriceAction(data);
      } catch (err: unknown) {
        costRef.current = costPrice;
        priceRef.current = unitPrice;
        setCost(costPrice);
        setSale(unitPrice);
        setError(err instanceof Error ? err.message : "Kunne ikke gemme.");
      } finally {
        saving.current = false;
      }
    });
  }

  function onKeyDown(nextField: Field, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      skipBlur.current = true;
      save(nextField, draft);
    }
    if (event.key === "Escape") {
      event.preventDefault();
      skipBlur.current = true;
      cancel();
    }
  }

  function onBlur(nextField: Field) {
    if (skipBlur.current) {
      skipBlur.current = false;
      return;
    }
    save(nextField, draft);
  }

  function editor(nextField: Field, label: string) {
    return (
      <input
        ref={inputRef}
        className="wo-price-edit"
        value={draft}
        aria-label={label}
        inputMode="decimal"
        autoComplete="off"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => onBlur(nextField)}
        onKeyDown={(event) => onKeyDown(nextField, event)}
        disabled={pending}
      />
    );
  }

  function button(nextField: Field, title: string, children: string) {
    return (
      <button type="button" className="wo-price-btn" title={title} onClick={() => open(nextField)} disabled={pending}>
        {children}
      </button>
    );
  }

  return (
    <>
      <td>
        {field === "cost"
          ? editor("cost", "Indkøbspris")
          : button("cost", "Ret indkøbspris", formatKrAmount(liveCost))}
      </td>
      <td>
        {field === "markup"
          ? editor("markup", "Avance")
          : button("markup", liveCost <= 0 ? "Sæt indkøbspris først" : "Ret avance", liveMarkup === null ? "—" : percent(liveMarkup))}
      </td>
      <td>25%</td>
      <td>
        {field === "sale"
          ? editor("sale", "Salgspris")
          : button("sale", "Ret salgspris", formatKrAmount(liveSale))}
      </td>
      <td>
        {formatKrAmount(Math.round(quantity * liveSale))}
        {error ? <p className="wo-price-error">{error}</p> : null}
      </td>
    </>
  );
}

function liveOre(draft: string | null, fallback: number) {
  if (!draft?.trim()) return fallback;
  return parseKrToOre(draft);
}

function liveUnitPrice(field: Field | null, draft: string, costPrice: number, unitPrice: number) {
  if (!field || !draft.trim() || field === "cost") return unitPrice;
  try {
    if (field === "markup") return saleFromMarkup(costPrice, parseMarkupInput(draft));
    return parseKrToOre(draft);
  } catch {
    return unitPrice;
  }
}
