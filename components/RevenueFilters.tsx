"use client";

import { useState } from "react";
import {
  REVENUE_PERIODS,
  parseRevenuePeriod,
  revenueRangeInputs,
  type RevenuePeriod,
} from "@/lib/revenue";

export function RevenueFilters({
  period,
  from,
  to,
  leaderId,
  leaders,
  showLeaders,
}: {
  period: RevenuePeriod;
  from: string;
  to: string;
  leaderId: string;
  leaders: { id: string; name: string }[];
  showLeaders: boolean;
}) {
  const [selected, setSelected] = useState(period);
  const [dates, setDates] = useState({ fra: from, til: to });

  function changePeriod(value: string) {
    const next = parseRevenuePeriod(value);
    setSelected(next);
    if (next !== "custom") setDates(revenueRangeInputs(next));
  }

  return (
    <form className="rev-toolbar" action="/okonomi">
      <label>
        Periode
        <select name="periode" value={selected} onChange={(event) => changePeriod(event.target.value)}>
          {REVENUE_PERIODS.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      {showLeaders ? (
        <label>
          Projektleder
          <select name="leder" defaultValue={leaderId}>
            <option value="">Alle (samlet)</option>
            {leaders.map((leader) => (
              <option key={leader.id} value={leader.id}>
                {leader.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        Fra
        <input
          type="date"
          name="fra"
          value={dates.fra}
          onChange={(event) => {
            setSelected("custom");
            setDates((current) => ({ ...current, fra: event.target.value }));
          }}
        />
      </label>
      <label>
        Til
        <input
          type="date"
          name="til"
          value={dates.til}
          onChange={(event) => {
            setSelected("custom");
            setDates((current) => ({ ...current, til: event.target.value }));
          }}
        />
      </label>
      <button type="submit">Opdater</button>
    </form>
  );
}
