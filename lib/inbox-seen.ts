import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dataDir } from "@/lib/platform";
import type { InboxItem } from "@/lib/inbox";

type SeenMap = Record<string, string>;
type SeenFile = Record<string, Record<string, SeenMap>>;

function seenPath() {
  return path.join(dataDir(), "inbox-seen.json");
}

function emptyFile(): SeenFile {
  return {};
}

export function readInboxSeenFile(): SeenFile {
  const file = seenPath();
  if (!existsSync(file)) return emptyFile();
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as SeenFile;
    return parsed && typeof parsed === "object" ? parsed : emptyFile();
  } catch {
    return emptyFile();
  }
}

export function readInboxSeen(tenantSlug: string, userId: string): SeenMap {
  return readInboxSeenFile()[tenantSlug]?.[userId] ?? {};
}

export function unreadInbox(items: InboxItem[], seen: SeenMap): InboxItem[] {
  return items.filter((item) => !seen[item.id] || seen[item.id] < item.at);
}

export function inboxKeysForCase(caseId: string, quoteIds: string[] = []): string[] {
  return [...new Set([`case:${caseId}`, ...quoteIds.filter(Boolean).map((id) => `quote:${id}`)])];
}

export function inboxKeysForQuote(quoteId: string): string[] {
  return [`quote:${quoteId}`];
}

export function markInboxSeen(
  tenantSlug: string,
  userId: string,
  keys: string[],
  at = new Date(),
): SeenMap {
  const stamp = at.toISOString();
  const unique = [...new Set(keys.filter(Boolean))];
  if (!tenantSlug || !userId || unique.length === 0) return readInboxSeen(tenantSlug, userId);
  const file = readInboxSeenFile();
  const tenant = file[tenantSlug] ?? {};
  const current = { ...(tenant[userId] ?? {}) };
  for (const key of unique) current[key] = stamp;
  file[tenantSlug] = { ...tenant, [userId]: current };
  mkdirSync(dataDir(), { recursive: true });
  writeFileSync(seenPath(), `${JSON.stringify(file)}\n`, "utf8");
  return current;
}
