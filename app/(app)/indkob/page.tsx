import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { createPurchaseAction, rejectPurchaseAction } from "@/app/actions/purchases";
import { AdminTabs } from "@/components/AdminTabs";
import { Flash } from "@/components/Flash";
import {
  PurchaseActionsMenu,
  PurchaseFilters,
  PurchaseFollowUp,
  PurchaseResponsible,
  SelectAllPurchases,
  WholesalerShop,
} from "@/components/PurchaseInboxClient";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Input, Label } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatNumericDate, formatNumericDateTime, parseDateInput } from "@/lib/dates";
import { formatKrAmount } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  PURCHASE_STATUS_LABELS,
  PURCHASE_TABS,
  parsePurchaseTab,
  purchaseInboxCopy,
  purchaseOrderReference,
  purchaseRoleTag,
  purchaseStatusWhere,
} from "@/lib/purchases";
import { imapReady } from "@/lib/mail";
import { getSettings } from "@/lib/settings";

function hrefFor(tab: string, extra: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  params.set("fane", tab);
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return `/indkob?${params.toString()}`;
}

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    besked?: string;
    fane?: string;
    q?: string;
    fra?: string;
    til?: string;
    rækker?: string;
    side?: string;
    ny?: string;
    sag?: string;
  }>;
}) {
  await requireRole(["ADMIN", "PL"]);
  const sp = await searchParams;
  const tab = parsePurchaseTab(sp.fane);
  const query = (sp.q ?? "").trim();
  const from = sp.fra ?? "";
  const to = sp.til ?? "";
  const rows = [10, 20, 50].includes(Number(sp.rækker)) ? Number(sp.rækker) : 10;
  const page = Math.max(1, Number(sp.side) || 1);
  const copy = purchaseInboxCopy(tab);
  const filterQuery = { q: query || undefined, fra: from || undefined, til: to || undefined, rækker: rows };

  const fromDate = parseDateInput(from);
  const toDate = parseDateInput(to);
  if (toDate) toDate.setHours(23, 59, 59, 999);

  const statusWhere = purchaseStatusWhere(tab);
  const caseId = (sp.sag ?? "").trim();
  const where: Prisma.PurchaseWhereInput = {
    ...(statusWhere ?? { id: "__none__" }),
    ...(caseId ? { caseId } : {}),
  };
  if (query) {
    where.OR = [
      { supplierName: { contains: query } },
      { invoiceNumber: { contains: query } },
      { orderReference: { contains: query } },
      { case: { caseNumber: { contains: query } } },
    ];
  }
  if (fromDate || toDate) {
    where.issuedAt = {
      ...(fromDate ? { gte: fromDate } : {}),
      ...(toDate ? { lte: toDate } : {}),
    };
  }

  const [settings, cases, wholesalers, total, purchases, mailAccounts, staff] = await Promise.all([
    getSettings(),
    prisma.case.findMany({
      select: { id: true, caseNumber: true, title: true },
      orderBy: { caseNumber: "desc" },
      take: 200,
    }),
    prisma.wholesalerAgreement.findMany({
      where: { excludedFromSearch: false },
      orderBy: { name: "asc" },
      select: { id: true, name: true, loginUrl: true },
    }),
    tab === "rekvisitioner" ? Promise.resolve(0) : prisma.purchase.count({ where }),
    tab === "rekvisitioner"
      ? Promise.resolve([])
      : prisma.purchase.findMany({
          where,
          include: {
            case: true,
            responsibleUser: { select: { id: true, name: true, role: true } },
          },
          orderBy: [{ issuedAt: "desc" }, { createdAt: "desc" }],
          skip: (page - 1) * rows,
          take: rows,
        }),
    prisma.mailAccount.findMany({
      select: { purpose: true, imapHost: true, smtpHost: true, imapPassword: true, smtpPassword: true },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "PL"] } },
      select: { id: true, name: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const invoiceMailReady = mailAccounts.some(
    (account) =>
      (account.purpose === "FAKTURA" || account.purpose === "GENEREL") && imapReady(account),
  );

  const pages = Math.max(1, Math.ceil(total / rows));
  const fromRow = total === 0 ? 0 : (page - 1) * rows + 1;
  const toRow = Math.min(total, page * rows);

  return (
    <>
      <AdminTabs />
      <Flash message={sp.besked} />

      <div className="purchase-app">
        <div className="purchase-subnav">
          <nav className="purchase-tabs">
            {PURCHASE_TABS.map((item) => (
              <Link
                key={item.id}
                href={hrefFor(item.id, filterQuery)}
                className={`purchase-tab${tab === item.id ? " purchase-tab--active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <PurchaseFilters tab={tab} query={query} from={from} to={to} rows={rows} />
        </div>

        <p className="purchase-banner">
          Fra denne sektion kan du handle direkte hos en række af dine tilføjede grossister. Angiv en
          arbejdsseddel og klik på &quot;Fortsæt til webshop&quot; for at komme i gang.
        </p>

        {sp.ny === "1" ? (
          <Card className="mx-5 mb-5">
            <h2 className="font-serif text-xl">Registrér indkøb</h2>
            <form action={createPurchaseAction} className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <input type="hidden" name="fane" value="indkomne" />
              {caseId ? <input type="hidden" name="caseId" value={caseId} /> : null}
              <label className="block">
                <Label>Leverandør</Label>
                <Input name="supplierName" required placeholder="Stark" />
              </label>
              <label className="block">
                <Label>CVR</Label>
                <Input name="supplierCvr" />
              </label>
              <label className="block">
                <Label>Fakturanr.</Label>
                <Input name="invoiceNumber" />
              </label>
              <label className="block">
                <Label>Dato</Label>
                <Input name="issuedAt" type="date" />
              </label>
              <label className="block">
                <Label>Beløb incl. moms</Label>
                <Input name="amount" required placeholder="1.250,00" />
              </label>
              <label className="block sm:col-span-2 lg:col-span-3">
                <Label>Beskrivelse</Label>
                <Input name="description" placeholder="Træ, skruer, beslag" />
              </label>
              <div>
                <SubmitButton>Tilføj til køen</SubmitButton>
              </div>
            </form>
          </Card>
        ) : null}

        <div className="purchase-head">
          <div>
            <h1>{copy.title}</h1>
            <p>{copy.description}</p>
          </div>
          <PurchaseActionsMenu
            tab={tab}
            sproomReady={Boolean(settings.sproom_api_token)}
            mailReady={invoiceMailReady}
          />
        </div>

        {tab === "rekvisitioner" ? (
          <div className="purchase-body">
            <WholesalerShop cases={cases} wholesalers={wholesalers} />
          </div>
        ) : (
          <>
            <div className="purchase-pager">
              {fromRow} til {toRow} af {total} elementer
              <Pager tab={tab} page={page} pages={pages} extra={filterQuery} />
            </div>
            <div className="purchase-table-wrap">
              <table className="purchase-table">
                <thead>
                  <tr>
                    <th>
                      <SelectAllPurchases />
                    </th>
                    <th>Status</th>
                    <th>Fakturadato</th>
                    <th>Modtaget</th>
                    <th>Fakturanummer</th>
                    <th>Ordrereference</th>
                    <th>Leverandør</th>
                    <th>Total ekskl. moms</th>
                    <th>Indkøbsfaktura ansvarlig</th>
                    <th>Opfølgning</th>
                    <th>Eksporteret</th>
                    <th>Handlinger</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={12}>Ingen indkøbsfakturaer i denne fane.</td>
                    </tr>
                  ) : (
                    purchases.map((purchase) => {
                      const responsible = purchase.responsibleUser;
                      const open = purchase.status === "MODTAGET" || purchase.status === "DELVIST" || purchase.status === "AFVENTER";
                      return (
                        <tr key={purchase.id}>
                          <td>
                            <input type="checkbox" name="purchaseId" value={purchase.id} />
                          </td>
                          <td>{PURCHASE_STATUS_LABELS[purchase.status] ?? purchase.status}</td>
                          <td>{purchase.issuedAt ? formatNumericDate(purchase.issuedAt) : "—"}</td>
                          <td>{formatNumericDateTime(purchase.createdAt)}</td>
                          <td>{purchase.invoiceNumber || "—"}</td>
                          <td className="purchase-ref">
                            {purchaseOrderReference(purchase) || "—"}
                          </td>
                          <td>{purchase.supplierName}</td>
                          <td>{formatKrAmount(purchase.netAmount)}</td>
                          <td>
                            <PurchaseResponsible
                              purchaseId={purchase.id}
                              tab={tab}
                              currentId={responsible?.id ?? ""}
                              currentLabel={
                                responsible ? `${responsible.name} (${purchaseRoleTag(responsible.role)})` : ""
                              }
                              staff={staff}
                            />
                          </td>
                          <td>
                            <PurchaseFollowUp
                              purchaseId={purchase.id}
                              tab={tab}
                              existing={purchase.followUpNote}
                            />
                          </td>
                          <td>{purchase.exportedAt ? formatNumericDate(purchase.exportedAt) : ">"}</td>
                          <td className="purchase-actions">
                            <Link className="purchase-link" href={`/indkob/${purchase.id}`}>
                              Vis
                            </Link>
                            {open ? (
                              <form action={rejectPurchaseAction}>
                                <input type="hidden" name="id" value={purchase.id} />
                                <input type="hidden" name="fane" value={tab} />
                                <button type="submit" className="purchase-link">
                                  Afvis
                                </button>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="purchase-pager purchase-pager--bottom">
              {fromRow} til {toRow} af {total} elementer
              <Pager tab={tab} page={page} pages={pages} extra={filterQuery} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

function Pager({
  tab,
  page,
  pages,
  extra,
}: {
  tab: string;
  page: number;
  pages: number;
  extra: Record<string, string | number | undefined>;
}) {
  const prev = Math.max(1, page - 1);
  const next = Math.min(pages, page + 1);
  return (
    <nav className="purchase-pages">
      <Link href={hrefFor(tab, { ...extra, side: 1 })} aria-label="Første side">
        «
      </Link>
      <Link href={hrefFor(tab, { ...extra, side: prev })} aria-label="Forrige">
        ‹
      </Link>
      <span>
        {page} af {pages}
      </span>
      <Link href={hrefFor(tab, { ...extra, side: next })} aria-label="Næste">
        ›
      </Link>
      <Link href={hrefFor(tab, { ...extra, side: pages })} aria-label="Sidste side">
        »
      </Link>
    </nav>
  );
}
