"use client";

import { useEffect, useState } from "react";
import { listOutbox, removeOutbox } from "@/lib/offline-queue";

export function OfflineSync() {
  const [waiting, setWaiting] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    let stopped = false;
    async function flush() {
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const rows = await listOutbox().catch(() => []);
        if (!stopped) setWaiting(rows.length);
        return;
      }
      const rows = await listOutbox().catch(() => []);
      if (!stopped) setWaiting(rows.length);
      if (rows.length === 0) return;
      try {
        const response = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: rows }),
        });
        if (!response.ok) return;
        const body = (await response.json()) as { done?: string[] };
        const done = body.done ?? [];
        if (done.length > 0) await removeOutbox(done);
        const left = await listOutbox();
        if (!stopped) setWaiting(left.length);
      } catch {
        if (!stopped) setWaiting(rows.length);
      }
    }

    flush();
    window.addEventListener("online", flush);
    const timer = window.setInterval(flush, 30000);
    return () => {
      stopped = true;
      window.removeEventListener("online", flush);
      window.clearInterval(timer);
    };
  }, []);

  if (waiting === 0) return null;
  return (
    <p className="fixed bottom-3 right-3 z-40 rounded-full bg-pine px-3 py-1.5 text-xs font-semibold text-white">
      {waiting} venter
    </p>
  );
}
