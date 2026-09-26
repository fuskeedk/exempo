"use client";

import { useEffect, useState, type ReactNode } from "react";

const TABS = [
  { id: "opgave", label: "Opgave" },
  { id: "materialer", label: "Materialer" },
  { id: "timer", label: "Timer" },
  { id: "kvalitet", label: "Kvalitet" },
  { id: "faktura", label: "Faktura" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const HASH_TO_TAB: Record<string, TabId> = {
  kunde: "opgave",
  ordrebeskrivelse: "opgave",
  anlaeg: "opgave",
  opfoelgning: "opgave",
  noter: "opgave",
  pris: "opgave",
  forbrug: "opgave",
  medarbejdere: "opgave",
  haendelser: "opgave",
  indstillinger: "opgave",
  kvalitetssikring: "kvalitet",
  dokumentation: "kvalitet",
  grossist: "materialer",
  materialer: "materialer",
  timesedler: "timer",
  "planlagte-timer": "timer",
  laaste: "faktura",
  fakturaer: "faktura",
  kalkulation: "faktura",
};

function tabFromHash(): TabId {
  if (typeof window === "undefined") return "opgave";
  const id = window.location.hash.replace("#", "");
  return HASH_TO_TAB[id] ?? "opgave";
}

export function WorkOrderTabs({
  opgave,
  materialer,
  timer,
  kvalitet,
  faktura,
}: {
  opgave: ReactNode;
  materialer: ReactNode;
  timer: ReactNode;
  kvalitet: ReactNode;
  faktura: ReactNode;
}) {
  const [tab, setTab] = useState<TabId>("opgave");
  const panels: Record<TabId, ReactNode> = { opgave, materialer, timer, kvalitet, faktura };

  useEffect(() => {
    const apply = () => setTab(tabFromHash());
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  function openTab(next: TabId) {
    setTab(next);
    const panel = document.getElementById(`wo-tab-${next}`);
    panel?.scrollIntoView({ block: "start" });
  }

  return (
    <>
      <nav className="wo-tabs no-print" aria-label="Sagsfaner">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => openTab(item.id)}
            className={tab === item.id ? "is-active" : undefined}
            aria-current={tab === item.id ? "page" : undefined}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {TABS.map((item) => (
        <div
          key={item.id}
          id={`wo-tab-${item.id}`}
          className={`wo-tab-panel${tab === item.id ? " is-active" : ""}`}
        >
          {panels[item.id]}
        </div>
      ))}
    </>
  );
}
