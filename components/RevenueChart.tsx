"use client";

import type { RevenueMonth } from "@/lib/revenue";

const SERIES = [
  { key: "invoices", label: "Fakturaer", color: "#16382c" },
  { key: "cashflow", label: "Cashflow", color: "#3d6b54" },
  { key: "costs", label: "Omkostning (sager)", color: "#b85c38" },
] as const;

function niceMax(maxKr: number) {
  if (maxKr <= 0) return 1000;
  const padded = maxKr * 1.12;
  const pow = 10 ** Math.floor(Math.log10(padded));
  const n = padded / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

function formatTick(kr: number) {
  if (Math.abs(kr) >= 10_000) {
    return `${Math.round(kr / 1000).toLocaleString("da-DK")} tkr`;
  }
  return `${Math.round(kr).toLocaleString("da-DK")} kr`;
}

export function RevenueChart({ months }: { months: RevenueMonth[] }) {
  const width = 920;
  const height = 280;
  const pad = { top: 16, right: 12, bottom: 36, left: 58 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = months.flatMap((month) => [month.invoices, month.cashflow, month.costs, month.contribution]);
  const maxKr = niceMax(Math.max(0, ...values) / 100);
  const minRaw = Math.min(0, ...values) / 100;
  const minKr = minRaw === 0 ? 0 : -niceMax(Math.abs(minRaw));
  const span = maxKr - minKr || 1;
  const ticks = Array.from({ length: 5 }, (_, index) => minKr + (span * index) / 4);
  const slot = months.length ? innerW / months.length : innerW;
  const barW = Math.min(9, Math.max(4, slot / 6));

  function y(ore: number) {
    return pad.top + innerH - ((ore / 100 - minKr) / span) * innerH;
  }

  const line = months
    .map((month, index) => {
      const x = pad.left + slot * index + slot / 2;
      return `${index === 0 ? "M" : "L"} ${x} ${y(month.contribution)}`;
    })
    .join(" ");

  return (
    <div className="rev-chart">
      <div className="rev-legend">
        <span>
          <i className="rev-swatch rev-swatch--line" /> Dækningsbidrag
        </span>
        {SERIES.map((series) => (
          <span key={series.key}>
            <i className="rev-swatch" style={{ background: series.color }} /> {series.label}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Omsætning, omkostning og resultat pr. måned">
        {ticks.map((tick) => {
          const yy = y(tick * 100);
          return (
            <g key={tick}>
              <line x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} className="rev-grid" />
              <text x={pad.left - 8} y={yy + 4} className="rev-tick" textAnchor="end">
                {formatTick(tick)}
              </text>
            </g>
          );
        })}
        {months.map((month, index) => {
          const cx = pad.left + slot * index + slot / 2;
          const values = [month.invoices, month.cashflow, month.costs];
          return (
            <g key={month.key}>
              {values.map((value, bar) => {
                const x = cx + (bar - 1) * (barW + 2) - barW / 2;
                const top = y(Math.max(0, value));
                const h = Math.max(0, y(0) - top);
                return (
                  <rect
                    key={SERIES[bar].key}
                    x={x}
                    y={top}
                    width={barW}
                    height={h}
                    rx="1"
                    fill={SERIES[bar].color}
                  >
                    <title>
                      {SERIES[bar].label} {month.label}: {(value / 100).toLocaleString("da-DK", { minimumFractionDigits: 2 })} kr
                    </title>
                  </rect>
                );
              })}
              <text x={cx} y={height - 10} className="rev-month" textAnchor="middle">
                {month.label}
              </text>
            </g>
          );
        })}
        {months.length ? (
          <>
            <path d={line} fill="none" stroke="#c4a35a" strokeWidth="2.4" />
            {months.map((month, index) => {
              const x = pad.left + slot * index + slot / 2;
              return (
                <circle key={`${month.key}-dot`} cx={x} cy={y(month.contribution)} r="3.2" fill="#c4a35a">
                  <title>
                    Dækningsbidrag {month.label}: {(month.contribution / 100).toLocaleString("da-DK", { minimumFractionDigits: 2 })} kr
                  </title>
                </circle>
              );
            })}
          </>
        ) : null}
      </svg>
    </div>
  );
}
