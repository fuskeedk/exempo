"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { addAoMaterialAction } from "@/app/actions/products";
import { ProductThumb } from "@/components/ProductThumb";
import { SubmitButton } from "@/components/SubmitButton";

type AoHit = {
  sku: string;
  barcode: string;
  name: string;
  unit: string;
  imageUrl?: string;
};

export function AoProductSearch({
  caseId,
  compact = false,
}: {
  caseId: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<AoHit[]>([]);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState("");
  const [pending, startTransition] = useTransition();
  const requestId = useRef(0);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setHits([]);
      setError("");
      setSearched("");
      return;
    }
    const id = ++requestId.current;
    const timer = window.setTimeout(() => {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/ao/search?q=${encodeURIComponent(term)}`);
          const payload = (await response.json()) as { items?: AoHit[]; error?: string; disabled?: boolean };
          if (id !== requestId.current) return;
          if (payload.disabled) {
            setHits([]);
            setSearched(term);
            setError("AO-varesøgning er slået fra under Grossistaftaler.");
            return;
          }
          setHits(Array.isArray(payload.items) ? payload.items : []);
          setSearched(term);
          setError(payload.error ?? "");
        } catch {
          if (id !== requestId.current) return;
          setHits([]);
          setSearched(term);
          setError("Kunne ikke søge hos AO.");
        }
      });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query]);

  return (
    <div className={compact ? "ao-search ao-search-compact" : "ao-search"}>
      <div className="ao-search-field">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Søg vare: navn, varenr. eller stregkode"
          aria-label="Søg vare"
          autoComplete="off"
          spellCheck={false}
        />
        {pending || (query.trim().length >= 2 && searched !== query.trim()) ? (
          <span className="ao-search-status">Søger…</span>
        ) : null}
      </div>
      {error ? <p className="ao-search-status">{error}</p> : null}
      {hits.length > 0 ? (
        <ul className="ao-search-list">
          {hits.map((hit) => (
            <li key={hit.sku}>
              <form
                action={addAoMaterialAction}
                className="ao-search-row"
              >
                <input type="hidden" name="caseId" value={caseId} />
                <input type="hidden" name="sku" value={hit.sku} />
                <ProductThumb src={hit.imageUrl} name={hit.name} size={52} />
                <div className="ao-search-hit">
                  <strong>{hit.name}</strong>
                  <span>
                    {hit.sku}
                    {hit.barcode ? ` · ${hit.barcode}` : ""}
                    {hit.unit ? ` · ${hit.unit}` : ""}
                  </span>
                </div>
                <input name="quantity" defaultValue="1" aria-label="Antal" />
                <SubmitButton variant="secondary" pendingLabel="Tilføjer…">
                  Tilføj
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      ) : query.trim().length >= 2 && searched === query.trim() && !pending ? (
        <p className="ao-search-status">Ingen varer matchede.</p>
      ) : query.trim().length === 1 ? (
        <p className="ao-search-status">Skriv mindst to tegn for at søge.</p>
      ) : null}
    </div>
  );
}
