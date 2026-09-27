"use client";

import { usePathname } from "next/navigation";
import { openInboxItemAction } from "@/app/actions/inbox";
import type { InboxItem } from "@/lib/inbox";

export function NotificationBell({
  items,
  variant = "bar",
}: {
  items: InboxItem[];
  variant?: "bar" | "header";
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => item.href !== pathname);
  const count = visible.length;
  const label = count === 0 ? "Ingen beskeder" : count === 1 ? "1 besked" : `${count} beskeder`;
  return (
    <details className={`notify notify--${variant}`}>
      <summary aria-label={label}>
        <span aria-hidden="true">🔔</span>
        {count > 0 ? <span className="notify-count">{count > 99 ? "99+" : count}</span> : null}
      </summary>
      <div className="notify-panel">
        {visible.length === 0 ? (
          <p className="notify-empty">Ingen nye beskeder</p>
        ) : (
          <ul>
            {visible.map((item) => (
              <li key={item.id}>
                <form action={openInboxItemAction}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="href" value={item.href} />
                  <button type="submit">
                    <strong>{item.title}</strong>
                    <span>{item.detail}</span>
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
