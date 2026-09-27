import type { InboxItem } from "@/lib/inbox";

export function NotificationBell({
  items,
  variant = "bar",
}: {
  items: InboxItem[];
  variant?: "bar" | "header";
}) {
  const count = items.length;
  const label = count === 0 ? "Ingen beskeder" : count === 1 ? "1 besked" : `${count} beskeder`;
  return (
    <details className={`notify notify--${variant}`}>
      <summary aria-label={label}>
        <span aria-hidden="true">🔔</span>
        {count > 0 ? <span className="notify-count">{count > 99 ? "99+" : count}</span> : null}
      </summary>
      <div className="notify-panel">
        {items.length === 0 ? (
          <p className="notify-empty">Ingen nye beskeder</p>
        ) : (
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                <a href={item.href}>
                  <strong>{item.title}</strong>
                  <span>{item.detail}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}
