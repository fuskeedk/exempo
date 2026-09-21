"use client";

import { useState } from "react";

export function CopyLinkButton({ url, label = "Kopiér kundelink" }: { url: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setDone(true);
        window.setTimeout(() => setDone(false), 2000);
      }}
    >
      {done ? "Kopieret" : label}
    </button>
  );
}
