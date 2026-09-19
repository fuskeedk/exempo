"use client";

export function PrintButton({ children = "Udskriv" }: { children?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold"
    >
      {children}
    </button>
  );
}
