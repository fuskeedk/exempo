"use client";

import { useMemo, useState } from "react";
import { formatSerial } from "@/lib/serial";
import { Input, Label, Select } from "@/components/ui";

export function NumberPreview({
  prefix,
  includeYear,
  digits,
  next,
}: {
  prefix: string;
  includeYear: boolean;
  digits: string;
  next: string;
}) {
  const [state, setState] = useState({ prefix, includeYear, digits, next });
  const preview = useMemo(
    () =>
      formatSerial({
        prefix: state.prefix,
        includeYear: state.includeYear,
        digits: Number.parseInt(state.digits, 10) || 5,
        n: Number.parseInt(state.next, 10) || 1,
        year: new Date().getFullYear(),
      }),
    [state],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <Label>Præfiks</Label>
        <Input
          name="case_number_prefix"
          value={state.prefix}
          onChange={(event) => setState((prev) => ({ ...prev, prefix: event.target.value }))}
          placeholder="Tomt = kun tal, fx 00001"
        />
      </label>
      <label className="block">
        <Label>Inkludér år</Label>
        <Select
          name="case_number_year"
          value={state.includeYear ? "1" : "0"}
          onChange={(event) => setState((prev) => ({ ...prev, includeYear: event.target.value === "1" }))}
        >
          <option value="0">Nej — 00001</option>
          <option value="1">Ja — 2026-00001</option>
        </Select>
      </label>
      <label className="block">
        <Label>Antal cifre</Label>
        <Input
          name="case_number_digits"
          type="number"
          min={1}
          max={8}
          value={state.digits}
          onChange={(event) => setState((prev) => ({ ...prev, digits: event.target.value }))}
        />
      </label>
      <label className="block">
        <Label>Næste nummer</Label>
        <Input
          name="case_number_next"
          type="number"
          min={1}
          value={state.next}
          onChange={(event) => setState((prev) => ({ ...prev, next: event.target.value }))}
        />
      </label>
      <p className="sm:col-span-2 rounded-xl bg-paper px-4 py-3 text-sm">
        Næste sagsnummer: <strong>{preview}</strong>
      </p>
    </div>
  );
}
