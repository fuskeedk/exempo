"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { parseDawaSuggestion, type ParsedAddress } from "@/lib/geo";

type Hit = ParsedAddress & { key: string };

export function AddressAutocomplete({
  streetName,
  postalName,
  cityName,
  defaultStreet = "",
  defaultPostal = "",
  defaultCity = "",
  streetRequired = false,
  streetPlaceholder = "Søg adresse, fx Strandvejen 214",
  variant = "app",
  resetKey,
}: {
  streetName: string;
  postalName: string;
  cityName: string;
  defaultStreet?: string;
  defaultPostal?: string;
  defaultCity?: string;
  streetRequired?: boolean;
  streetPlaceholder?: string;
  variant?: "app" | "wo";
  resetKey?: string;
}) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const skipFetch = useRef(false);
  const [street, setStreet] = useState(defaultStreet);
  const [postal, setPostal] = useState(defaultPostal);
  const [city, setCity] = useState(defaultCity);
  const [hits, setHits] = useState<Hit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    setStreet(defaultStreet);
    setPostal(defaultPostal);
    setCity(defaultCity);
    setHits([]);
    setOpen(false);
    setActive(-1);
  }, [resetKey, defaultStreet, defaultPostal, defaultCity]);

  useEffect(() => {
    if (skipFetch.current) {
      skipFetch.current = false;
      return;
    }
    const q = street.trim();
    if (q.length < 2) {
      setHits([]);
      setOpen(false);
      setActive(-1);
      return;
    }
    const ctrl = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const url = `https://api.dataforsyningen.dk/adresser/autocomplete?q=${encodeURIComponent(q)}&per_side=8`;
        const response = await fetch(url, { signal: ctrl.signal });
        if (!response.ok) return;
        const data = (await response.json()) as unknown;
        if (!Array.isArray(data)) return;
        const next = data.slice(0, 8).map((item, index) => {
          const parsed = parseDawaSuggestion(item as { tekst?: string; adresse?: Record<string, string> });
          return { ...parsed, key: `${parsed.label}-${index}` };
        });
        setHits(next);
        setOpen(next.length > 0);
        setActive(-1);
      } catch (error) {
        if ((error as { name?: string }).name !== "AbortError") {
          setHits([]);
          setOpen(false);
        }
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      ctrl.abort();
    };
  }, [street]);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(hit: Hit) {
    skipFetch.current = true;
    setStreet(hit.street);
    setPostal(hit.postal);
    setCity(hit.city);
    setHits([]);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!hits.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current + 1) % hits.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((current) => (current <= 0 ? hits.length - 1 : current - 1));
    } else if (event.key === "Enter" && open && active >= 0) {
      event.preventDefault();
      pick(hits[active]);
    }
  }

  const list =
    open && hits.length ? (
      <ul id={listId} role="listbox" className="address-ac-list">
        {hits.map((hit, index) => (
          <li key={hit.key} role="option" aria-selected={index === active}>
            <button
              type="button"
              className={index === active ? "is-active" : undefined}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActive(index)}
              onClick={() => pick(hit)}
            >
              {hit.label}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  if (variant === "wo") {
    return (
      <div ref={rootRef} className="contents">
        <label className="address-ac wo-span">
          Adresse
          <input
            name={streetName}
            required={streetRequired}
            autoComplete="off"
            placeholder={streetPlaceholder}
            value={street}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={listId}
            onChange={(event) => setStreet(event.target.value)}
            onFocus={() => hits.length && setOpen(true)}
            onKeyDown={onKeyDown}
          />
          {list}
        </label>
        <label>
          Postnr.
          <input name={postalName} inputMode="numeric" autoComplete="postal-code" value={postal} onChange={(event) => setPostal(event.target.value)} />
        </label>
        <label>
          By
          <input name={cityName} autoComplete="address-level2" value={city} onChange={(event) => setCity(event.target.value)} />
        </label>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="address-ac-block sm:col-span-2">
      <label className="address-ac block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Adresse</span>
        <input
          name={streetName}
          required={streetRequired}
          autoComplete="off"
          placeholder={streetPlaceholder}
          value={street}
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls={listId}
          onChange={(event) => setStreet(event.target.value)}
          onFocus={() => hits.length && setOpen(true)}
          onKeyDown={onKeyDown}
          className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink outline-none ring-pine/20 focus:ring-2"
        />
        {list}
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Postnr.</span>
          <input
            name={postalName}
            inputMode="numeric"
            autoComplete="postal-code"
            value={postal}
            onChange={(event) => setPostal(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink outline-none ring-pine/20 focus:ring-2"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">By</span>
          <input
            name={cityName}
            autoComplete="address-level2"
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink outline-none ring-pine/20 focus:ring-2"
          />
        </label>
      </div>
    </div>
  );
}
