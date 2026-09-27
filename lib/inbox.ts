import { startOfDay } from "@/lib/dates";
import { readInboxSeen, unreadInbox } from "@/lib/inbox-seen";

export const STALE_CASE_DAYS = 8;
export const ACCEPTED_QUOTE_DAYS = 14;

const CLOSED_CASE_STATES = new Set(["AFSLUTTET", "ANNULLERET"]);

export type InboxKind = "quote_accepted" | "quote_rejected" | "case_stale";

export type InboxItem = {
  id: string;
  kind: InboxKind;
  href: string;
  title: string;
  detail: string;
  at: string;
};

export type InboxQuote = {
  id: string;
  quoteNumber: string;
  title: string;
  status: string;
  caseId: string | null;
  approvedAt: Date | null;
  updatedAt: Date;
  emailedAt: Date | null;
  rejectedNote?: string;
  customer: { name: string };
  cases: { id: string }[];
};

export type InboxCase = {
  id: string;
  caseNumber: string;
  title: string;
  state: string;
  customerName: string;
  assignedToId: string | null;
  projectLeaderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  events?: { createdAt: Date }[];
  timeEntries?: { createdAt: Date }[];
  materials?: { createdAt: Date }[];
  documents?: { createdAt: Date }[];
  extraWorks?: { createdAt: Date }[];
  invoices?: { issuedAt?: Date; createdAt?: Date }[];
};

export type InboxViewer = {
  id: string;
  office: boolean;
  tenantSlug?: string;
};

export function calendarDaysSince(from: Date, now: Date): number {
  const ms = startOfDay(now).getTime() - startOfDay(from).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

export function lastCaseActivity(sag: InboxCase): Date {
  const stamps = [
    sag.createdAt,
    sag.updatedAt,
    ...(sag.events ?? []).map((row) => row.createdAt),
    ...(sag.timeEntries ?? []).map((row) => row.createdAt),
    ...(sag.materials ?? []).map((row) => row.createdAt),
    ...(sag.documents ?? []).map((row) => row.createdAt),
    ...(sag.extraWorks ?? []).map((row) => row.createdAt),
    ...(sag.invoices ?? []).map((row) => row.issuedAt ?? row.createdAt).filter((stamp): stamp is Date => Boolean(stamp)),
  ];
  return new Date(Math.max(...stamps.map((stamp) => stamp.getTime())));
}

function dayWord(days: number) {
  return days === 1 ? "dag" : "dage";
}

export function acceptedQuoteItem(quote: InboxQuote, now: Date): InboxItem | null {
  if (quote.status !== "GODKENDT") return null;
  const caseId = quote.caseId || quote.cases[0]?.id || "";
  const approvedAt = quote.approvedAt ?? quote.updatedAt;
  const days = calendarDaysSince(approvedAt, now);
  const waiting = !caseId;
  const recent = days <= ACCEPTED_QUOTE_DAYS;
  if (!waiting && !recent) return null;
  return {
    id: `quote:${quote.id}`,
    kind: "quote_accepted",
    href: caseId ? `/sager/${caseId}` : `/tilbud/${quote.id}`,
    title: "Kunden har godkendt tilbuddet",
    detail: `${quote.customer.name} · ${quote.quoteNumber}`,
    at: approvedAt.toISOString(),
  };
}

export function rejectedQuoteItem(quote: InboxQuote, now: Date): InboxItem | null {
  if (quote.status !== "AFVIST") return null;
  const rejectedAt = quote.updatedAt;
  if (calendarDaysSince(rejectedAt, now) > ACCEPTED_QUOTE_DAYS) return null;
  const note = quote.rejectedNote?.trim();
  const detail = note && note !== "Afvist af kunden"
    ? `${quote.customer.name} · ${quote.quoteNumber} · ${note}`
    : `${quote.customer.name} · ${quote.quoteNumber}`;
  return {
    id: `quote:${quote.id}`,
    kind: "quote_rejected",
    href: `/tilbud/${quote.id}`,
    title: "Kunden har afvist tilbuddet",
    detail,
    at: rejectedAt.toISOString(),
  };
}

export function staleCaseItem(sag: InboxCase, now: Date): InboxItem | null {
  if (CLOSED_CASE_STATES.has(sag.state)) return null;
  const last = lastCaseActivity(sag);
  const days = calendarDaysSince(last, now);
  if (days < STALE_CASE_DAYS) return null;
  return {
    id: `case:${sag.id}`,
    kind: "case_stale",
    href: `/sager/${sag.id}`,
    title: `Sagen har stået stille i ${days} ${dayWord(days)}`,
    detail: `${sag.caseNumber} · ${sag.customerName}`,
    at: last.toISOString(),
  };
}

export function collectInbox(
  quotes: InboxQuote[],
  cases: InboxCase[],
  viewer: InboxViewer,
  now = new Date(),
): InboxItem[] {
  const quoteItems = viewer.office
    ? quotes
        .flatMap((quote) => [acceptedQuoteItem(quote, now), rejectedQuoteItem(quote, now)])
        .filter((item): item is InboxItem => Boolean(item))
    : [];
  const visibleCases = viewer.office
    ? cases
    : cases.filter((sag) => sag.assignedToId === viewer.id || sag.projectLeaderId === viewer.id);
  const caseItems = visibleCases
    .map((sag) => staleCaseItem(sag, now))
    .filter((item): item is InboxItem => Boolean(item));
  return [...quoteItems, ...caseItems].sort((a, b) => b.at.localeCompare(a.at));
}

type InboxStore = {
  quote: {
    findMany: (args: {
      where: { status: { in: string[] } };
      include: { customer: { select: { name: true } }; cases: { select: { id: true } } };
    }) => Promise<InboxQuote[]>;
  };
  case: {
    findMany: (args: {
      where: { state: { notIn: string[] } };
      include: {
        events: { select: { createdAt: true } };
        timeEntries: { select: { createdAt: true } };
        materials: { select: { createdAt: true } };
        documents: { select: { createdAt: true } };
        extraWorks: { select: { createdAt: true } };
        invoices: { select: { issuedAt: true } };
      };
    }) => Promise<InboxCase[]>;
  };
};

export async function loadInbox(db: InboxStore, viewer: InboxViewer, now = new Date()): Promise<InboxItem[]> {
  const [quotes, cases] = await Promise.all([
    viewer.office
      ? db.quote.findMany({
          where: { status: { in: ["GODKENDT", "AFVIST"] } },
          include: {
            customer: { select: { name: true } },
            cases: { select: { id: true } },
          },
        })
      : Promise.resolve([]),
    db.case.findMany({
      where: { state: { notIn: [...CLOSED_CASE_STATES] } },
      include: {
        events: { select: { createdAt: true } },
        timeEntries: { select: { createdAt: true } },
        materials: { select: { createdAt: true } },
        documents: { select: { createdAt: true } },
        extraWorks: { select: { createdAt: true } },
        invoices: { select: { issuedAt: true } },
      },
    }),
  ]);
  const items = collectInbox(quotes, cases, viewer, now);
  if (!viewer.tenantSlug) return items;
  return unreadInbox(items, readInboxSeen(viewer.tenantSlug, viewer.id));
}
