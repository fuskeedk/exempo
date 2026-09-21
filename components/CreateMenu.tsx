"use client";

const items = [
  { href: "/tilbud/ny", label: "Tilbud" },
  { href: "/sager/ny", label: "Sag" },
  { href: "/kunder/ny", label: "Kunde" },
  { href: "/ekstra/ny", label: "Ekstra-arbejde" },
];

export function CreateMenu() {
  return (
    <details className="wo-create" data-tour="nav-opret">
      <summary>Opret</summary>
      <nav>
        {items.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>
    </details>
  );
}
