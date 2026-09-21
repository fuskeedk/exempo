import {
  addMaterialAction,
  addTimeEntryAction,
  assignCaseToCalendarAction,
  transitionCaseAction,
  updateCaseAction,
} from "@/app/actions/cases";
import { addCatalogMaterialAction } from "@/app/actions/products";
import { AoProductSearch } from "@/components/AoProductSearch";
import { ProductThumb, materialImageUrl } from "@/components/ProductThumb";
import { uploadDocumentAction } from "@/app/actions/documents";
import { createInvoiceAction } from "@/app/actions/invoices";
import { createExtraWorkAction, setExtraWorkStatusAction } from "@/app/actions/field";
import { CoverageBadge, InvoiceBadge, PipelineDots, StatusBadge } from "@/components/StatusBadge";
import { KlsForm, KlsStartForm } from "@/components/KlsForm";
import { SubmitButton } from "@/components/SubmitButton";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import type { SessionUser } from "@/lib/auth";
import { canManageOffice, canSeeCaseCoverage } from "@/lib/auth";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_LABELS,
  EXTRA_STATUS_LABELS,
  TIME_KIND_LABELS,
  TIME_KINDS,
  ORDER_TYPE_LABELS,
  PRICING_MODES,
  PRICING_MODE_LABELS,
  TRADE_LABELS,
  CASE_TRADES,
  isTrade,
} from "@/lib/catalog";
import type { CaseEconomics } from "@/lib/coverage";
import { formatDateTime, toDateInput, toDateTimeInput, atTimeOnDay, dayDateTimeBounds } from "@/lib/dates";
import {
  STATE_HELP,
  STATE_LABELS,
  TIME_LOCKED_MESSAGE,
  allowedTransitions,
  isCaseState,
  isTimeLocked,
  type CaseState,
} from "@/lib/fsm";
import { formatKr, oreToKrInput, percent } from "@/lib/money";
import type { Prisma } from "@prisma/client";

type CaseFull = Prisma.CaseGetPayload<{
  include: {
    assignedTo: true;
    projectLeader: true;
    events: { include: { user: true } };
    documents: { include: { uploadedBy: true } };
    timeEntries: { include: { user: true } };
    materials: { include: { product: true } };
    invoices: { include: { lines: true } };
    extraWorks: true;
    purchases: true;
    klsReports: {
      include: {
        template: true;
        signedBy: true;
        checks: { include: { item: true } };
      };
    };
  };
}>;

type Template = Prisma.KlsTemplateGetPayload<{ include: { items: true } }>;
type Employee = { id: string; name: string; trade: string; role: string };
type CatalogProduct = { id: string; sku: string; name: string; unit: string };

export function CaseHero({
  sag,
  economics,
  user,
}: {
  sag: CaseFull;
  economics: CaseEconomics;
  user: SessionUser;
}) {
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">{sag.caseNumber}</p>
          <h1 className="mt-1 font-serif text-3xl">{sag.title}</h1>
          <p className="mt-2 max-w-2xl text-muted">{sag.description || "Ingen beskrivelse."}</p>
          <p className="mt-2 text-sm text-muted">
            {ORDER_TYPE_LABELS[sag.orderType as keyof typeof ORDER_TYPE_LABELS] ?? sag.orderType}
            {" · "}
            {PRICING_MODE_LABELS[sag.pricingMode as keyof typeof PRICING_MODE_LABELS] ?? sag.pricingMode}
            {sag.requisition ? ` · Rek. ${sag.requisition}` : ""}
          </p>
        </div>
        <StatusBadge state={sag.state} />
      </div>
      <div className="mt-5">
        <PipelineDots state={isCaseState(sag.state) ? sag.state : "NY"} />
        <p className="mt-2 text-sm text-muted">
          {isCaseState(sag.state) ? STATE_HELP[sag.state] : ""}
        </p>
      </div>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">Kunde</dt>
          <dd className="mt-1 font-medium">{sag.customerName}</dd>
          <dd className="text-muted">
            {sag.customerAddress}
            {sag.customerCity ? `, ${sag.customerPostal} ${sag.customerCity}` : ""}
          </dd>
          {sag.customerPhone ? <dd className="text-muted">{sag.customerPhone}</dd> : null}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">Forsikring</dt>
          <dd className="mt-1 font-medium">{sag.insuranceCompany || "—"}</dd>
          <dd className="text-muted">{sag.claimNumber || "Intet skadenr."}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">Medarbejder</dt>
          <dd className="mt-1 font-medium">{sag.assignedTo?.name ?? "Ikke tildelt"}</dd>
          <dd className="text-muted">
            PL: {sag.projectLeader?.name ?? "—"}
          </dd>
        </div>
        {canSeeCaseCoverage(user, sag.projectLeaderId) ? (
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">Dækningsgrad</dt>
          <dd className="mt-1">
            <CoverageBadge value={economics.coverage} />
          </dd>
          <dd className="text-muted">
            {formatKr(economics.revenue)} − {formatKr(economics.cost)}
          </dd>
        </div>
        ) : null}
      </dl>
    </Card>
  );
}

export function FsmForm({ sag }: { sag: CaseFull }) {
  if (!isCaseState(sag.state)) return null;
  const next = allowedTransitions(sag.state).filter(
    (state) => !(state === "I_GANG" && isTimeLocked(sag.state)),
  );
  if (next.length === 0) {
    return (
      <Card>
        <h2 className="font-serif text-xl">FSM</h2>
        <p className="mt-2 text-sm text-muted">Ingen yderligere overgange fra {STATE_LABELS[sag.state]}.</p>
      </Card>
    );
  }
  return (
    <Card>
      <h2 className="font-serif text-xl">Flyt sag</h2>
      <p className="mt-1 text-sm text-muted">Tilladte overgange fra {STATE_LABELS[sag.state]}.</p>
      <form action={transitionCaseAction} className="mt-4 space-y-3">
        <input type="hidden" name="caseId" value={sag.id} />
        <Select name="toState" defaultValue={next[0]} key={sag.state}>
          {next.map((state) => (
            <option key={state} value={state}>
              {STATE_LABELS[state as CaseState]}
            </option>
          ))}
        </Select>
        <Textarea name="note" rows={2} placeholder="Note til tidslinjen" />
        <SubmitButton>Opdater status</SubmitButton>
      </form>
    </Card>
  );
}

export function CalendarAssignForm({
  sag,
  employees,
  user,
}: {
  sag: CaseFull;
  employees: Employee[];
  user: SessionUser;
}) {
  const office = canManageOffice(user.role);
  const own = !sag.assignedToId || sag.assignedToId === user.id;
  const day = sag.scheduledStart ?? new Date();
  const clock = dayDateTimeBounds(day);
  const defaultStart = sag.scheduledStart ?? atTimeOnDay(day, 8);
  const defaultEnd = sag.scheduledEnd ?? atTimeOnDay(day, 16);

  if (!office && !own) {
    return (
      <Card>
        <h2 className="font-serif text-xl">Kalender</h2>
        <p className="mt-2 text-sm text-muted">
          {sag.scheduledStart && sag.scheduledEnd
            ? `${formatDateTime(sag.scheduledStart)} → ${formatDateTime(sag.scheduledEnd)}`
            : "Ikke planlagt endnu."}
        </p>
      </Card>
    );
  }

  if (!office) {
    return (
      <Card>
        <h2 className="font-serif text-xl">Book på min kalender</h2>
        <p className="mt-1 text-sm text-muted">Sæt start og slut mellem 00:00 og 23:59, så sagen ligger på din dag.</p>
        <form action={assignCaseToCalendarAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="caseId" value={sag.id} />
          <input type="hidden" name="assignedToId" value={user.id} />
          <Field label="Start">
            <Input
              type="datetime-local"
              name="scheduledStart"
              required
              min={clock.min}
              max={clock.max}
              step={60}
              defaultValue={toDateTimeInput(defaultStart)}
            />
          </Field>
          <Field label="Slut">
            <Input
              type="datetime-local"
              name="scheduledEnd"
              required
              min={clock.min}
              max={clock.max}
              step={60}
              defaultValue={toDateTimeInput(defaultEnd)}
            />
          </Field>
          <SubmitButton>Book på mig</SubmitButton>
        </form>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-serif text-xl">Læg i kalender</h2>
      <p className="mt-1 text-sm text-muted">
        PL tildeler sagen til en medarbejder. Ny/besigtigelse bliver automatisk planlagt. Klokken går fra 00:00 til 23:59.
      </p>
      <form action={assignCaseToCalendarAction} className="mt-4 grid gap-3">
        <input type="hidden" name="caseId" value={sag.id} />
        <Field label="Medarbejder">
          <Select name="assignedToId" defaultValue={sag.assignedToId ?? ""} required key={sag.assignedToId ?? "none"}>
            <option value="">Vælg…</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
                {isTrade(employee.trade) ? ` · ${TRADE_LABELS[employee.trade]}` : ""}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Start">
            <Input
              type="datetime-local"
              name="scheduledStart"
              key={sag.scheduledStart?.toISOString() ?? "start"}
              defaultValue={sag.scheduledStart ? toDateTimeInput(sag.scheduledStart) : toDateTimeInput(defaultStart)}
              min={clock.min}
              max={clock.max}
              step={60}
              required
            />
          </Field>
          <Field label="Slut">
            <Input
              type="datetime-local"
              name="scheduledEnd"
              key={sag.scheduledEnd?.toISOString() ?? "end"}
              defaultValue={sag.scheduledEnd ? toDateTimeInput(sag.scheduledEnd) : toDateTimeInput(defaultEnd)}
              min={clock.min}
              max={clock.max}
              step={60}
              required
            />
          </Field>
        </div>
        <SubmitButton>Gem i kalender</SubmitButton>
      </form>
    </Card>
  );
}

export function DocumentsPanel({ sag }: { sag: CaseFull }) {
  return (
    <Card>
      <h2 className="font-serif text-xl">Dokumentation</h2>
      <form action={uploadDocumentAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]">
        <input type="hidden" name="caseId" value={sag.id} />
        <Input type="file" name="file" required />
        <Select name="category" defaultValue="FOTO">
          {DOCUMENT_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {DOCUMENT_LABELS[category]}
            </option>
          ))}
        </Select>
        <SubmitButton>Upload</SubmitButton>
      </form>
      <ul className="mt-5 divide-y divide-line">
        {sag.documents.map((doc) => (
          <li key={doc.id} className="flex items-center justify-between gap-3 py-3 text-sm">
            <div>
              <a className="font-medium hover:underline" href={`/api/files/${doc.id}`} target="_blank">
                {doc.originalName}
              </a>
              <p className="text-muted">
                {DOCUMENT_LABELS[doc.category as keyof typeof DOCUMENT_LABELS] ?? doc.category} ·{" "}
                {formatDateTime(doc.createdAt)}
                {doc.uploadedBy ? ` · ${doc.uploadedBy.name}` : ""}
              </p>
            </div>
            {doc.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/files/${doc.id}`}
                alt=""
                className="h-12 w-12 rounded-lg object-cover"
              />
            ) : null}
          </li>
        ))}
        {sag.documents.length === 0 ? (
          <li className="py-4 text-sm text-muted">Ingen filer endnu.</li>
        ) : null}
      </ul>
    </Card>
  );
}

export function KlsPanel({
  sag,
  templates,
}: {
  sag: CaseFull;
  templates: Template[];
}) {
  const report = sag.klsReports[0];
  if (!report) {
    return (
      <KlsStartForm
        caseId={sag.id}
        trade={sag.trade}
        templates={templates.map((template) => ({
          id: template.id,
          name: template.name,
          trade: template.trade,
        }))}
      />
    );
  }

  return (
    <KlsForm
      caseId={sag.id}
      reportId={report.id}
      templateName={report.template.name}
      signedAt={report.signedAt?.toISOString() ?? null}
      signedByName={report.signedBy?.name ?? null}
      notes={report.notes}
      checks={report.checks.map((check) => ({
        id: check.id,
        status: check.status,
        comment: check.comment,
        label: check.item.label,
        sortOrder: check.item.sortOrder,
      }))}
    />
  );
}

export function EconomyPanel({
  sag,
  economics,
  user,
  products,
}: {
  sag: CaseFull;
  economics: CaseEconomics;
  user: SessionUser;
  products: CatalogProduct[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {canSeeCaseCoverage(user, sag.projectLeaderId) ? (
      <Card>
        <h2 className="font-serif text-xl">Dækningsgrad</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Omsætning" value={formatKr(economics.revenue)} />
          <Row label="Arbejdsløn" value={formatKr(economics.laborCost)} />
          <Row label="Materialer" value={formatKr(economics.materialCost)} />
          <Row label="Direkte omkostninger" value={formatKr(economics.cost)} />
          <Row label="Dækningsbidrag" value={formatKr(economics.contribution)} />
          <Row
            label="Dækningsgrad"
            value={economics.coverage === null ? "—" : percent(economics.coverage)}
          />
        </dl>
        <p className="mt-3 text-xs text-muted">
          {economics.usingEstimate
            ? "Baseret på estimat, indtil en faktura er sendt."
            : "Baseret på sendte/betalte fakturaer."}
        </p>
      </Card>
      ) : null}
      <Card>
        <h2 className="font-serif text-xl">Tid og materialer</h2>
        {isTimeLocked(sag.state) ? (
          <p className="mt-4 text-sm text-muted">{TIME_LOCKED_MESSAGE}</p>
        ) : (
          <form action={addTimeEntryAction} className="mt-4 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="caseId" value={sag.id} />
            <Input name="hours" placeholder="Timer" required />
            <Input type="date" name="date" defaultValue={toDateInput(new Date())} required />
            <Select name="kind" defaultValue="ARBEJDE">
              {TIME_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {TIME_KIND_LABELS[kind]}
                </option>
              ))}
            </Select>
            <Input name="note" placeholder="Note" />
            <div className="sm:col-span-4">
              <SubmitButton>Registrér tid</SubmitButton>
            </div>
          </form>
        )}
        <AoProductSearch caseId={sag.id} />
        {products.length > 0 ? (
          <form action={addCatalogMaterialAction} className="mt-4 grid gap-3 sm:grid-cols-[1fr_100px_auto]">
            <input type="hidden" name="caseId" value={sag.id} />
            <Select name="productId" required>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.name}
                </option>
              ))}
            </Select>
            <Input name="quantity" defaultValue="1" />
            <SubmitButton variant="secondary">Fra katalog</SubmitButton>
          </form>
        ) : null}
        <form action={addMaterialAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          <input type="hidden" name="caseId" value={sag.id} />
          <Input name="name" placeholder="Materiale" required />
          <Input name="quantity" placeholder="Antal" defaultValue="1" />
          <Input name="unitPrice" placeholder="Salgspris kr." required />
          <Input name="costPrice" placeholder="Kostpris kr." />
          <div className="sm:col-span-4">
            <SubmitButton variant="secondary">Tilføj materiale</SubmitButton>
          </div>
        </form>
        <ul className="mt-4 space-y-1 text-sm">
          {sag.timeEntries.map((entry) => (
            <li key={entry.id} className="flex justify-between gap-3">
              <span>
                {entry.user.name}: {entry.hours} t {entry.note ? `· ${entry.note}` : ""}
              </span>
              <span>{formatKr(Math.round(entry.hours * entry.hourlyRate))}</span>
            </li>
          ))}
          {sag.materials.map((material) => (
            <li key={material.id} className="flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-2">
                <ProductThumb src={materialImageUrl(material)} name={material.name} size={32} />
                <span className="truncate">
                  {material.name} × {material.quantity}
                </span>
              </span>
              <span>{formatKr(Math.round(material.quantity * material.unitPrice))}</span>
            </li>
          ))}
        </ul>
        {canManageOffice(user.role) ? (
          <form action={createInvoiceAction} className="mt-5">
            <input type="hidden" name="caseId" value={sag.id} />
            <SubmitButton>Dan faktura</SubmitButton>
          </form>
        ) : null}
        {canManageOffice(user.role) && sag.invoices.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {sag.invoices.map((invoice) => (
              <li key={invoice.id} className="flex items-center justify-between">
                <a className="hover:underline" href={`/fakturaer/${invoice.id}`}>
                  {invoice.invoiceNumber}
                </a>
                <InvoiceBadge status={invoice.status} kind={invoice.kind} />
              </li>
            ))}
          </ul>
        ) : null}
      </Card>
      <Card className="lg:col-span-2">
        <h2 className="font-serif text-xl">Ekstraarbejde</h2>
        <form action={createExtraWorkAction} className="mt-4 grid gap-3 sm:grid-cols-3">
          <input type="hidden" name="caseId" value={sag.id} />
          <Input name="title" placeholder="Opgave" required />
          <Input name="amount" placeholder="Beløb, kr." />
          <SubmitButton variant="secondary">Opret ekstraarbejde</SubmitButton>
        </form>
        <ul className="mt-4 space-y-2 text-sm">
          {sag.extraWorks.map((extra) => (
            <li key={extra.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2">
              <span>
                {extra.title} · {formatKr(extra.amount)} ·{" "}
                {EXTRA_STATUS_LABELS[extra.status as keyof typeof EXTRA_STATUS_LABELS] ?? extra.status}
              </span>
              {extra.status === "KLADDE" || extra.status === "SENDT" ? (
                <form action={setExtraWorkStatusAction} className="flex gap-2">
                  <input type="hidden" name="extraWorkId" value={extra.id} />
                  {extra.status === "KLADDE" ? (
                    <button name="status" value="SENDT" className="text-sm font-semibold text-pine-2">
                      Send til kunden
                    </button>
                  ) : null}
                  <button name="status" value="GODKENDT" className="text-sm font-semibold text-pine-2">
                    Godkend
                  </button>
                  <button name="status" value="AFVIST" className="text-sm text-muted">
                    Afvis
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function Timeline({ sag }: { sag: CaseFull }) {
  return (
    <Card>
      <h2 className="font-serif text-xl">Tidslinje</h2>
      <ol className="mt-4 space-y-3">
        {sag.events.map((event) => (
          <li key={event.id} className="border-l-2 border-pine/30 pl-4 text-sm">
            <p className="font-medium">
              {event.fromState && isCaseState(event.fromState)
                ? STATE_LABELS[event.fromState]
                : "Start"}{" "}
              → {isCaseState(event.toState) ? STATE_LABELS[event.toState] : event.toState}
            </p>
            <p className="text-muted">
              {formatDateTime(event.createdAt)}
              {event.user ? ` · ${event.user.name}` : ""}
            </p>
            {event.note ? <p className="mt-1">{event.note}</p> : null}
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function StamdataForm({ sag, user }: { sag: CaseFull; user: SessionUser }) {
  if (!canManageOffice(user.role)) return null;
  return (
    <Card>
      <h2 className="font-serif text-xl">Stamdata</h2>
      <form action={updateCaseAction} className="mt-4 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="caseId" value={sag.id} />
        <Field label="Titel">
          <Input name="title" defaultValue={sag.title} className="sm:col-span-2" />
        </Field>
        <Field label="Kunde">
          <Input name="customerName" defaultValue={sag.customerName} />
        </Field>
        <AddressAutocomplete
          streetName="customerAddress"
          postalName="customerPostal"
          cityName="customerCity"
          streetRequired
          defaultStreet={sag.customerAddress}
          defaultPostal={sag.customerPostal}
          defaultCity={sag.customerCity}
        />
        <Field label="Telefon">
          <Input name="customerPhone" type="tel" inputMode="tel" defaultValue={sag.customerPhone} />
        </Field>
        <Field label="E-mail">
          <Input name="customerEmail" defaultValue={sag.customerEmail} />
        </Field>
        <Field label="Forsikring">
          <Input name="insuranceCompany" defaultValue={sag.insuranceCompany} />
        </Field>
        <Field label="Skadenr.">
          <Input name="claimNumber" defaultValue={sag.claimNumber} />
        </Field>
        <Field label="Fag">
          <Select name="trade" defaultValue={sag.trade}>
            {CASE_TRADES.map((trade) => (
              <option key={trade} value={trade}>
                {TRADE_LABELS[trade]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Prisform">
          <Select name="pricingMode" defaultValue={sag.pricingMode}>
            {PRICING_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {PRICING_MODE_LABELS[mode]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={sag.pricingMode === "FAST_PRIS" ? "Aftalt beløb, kr." : "Estimeret omsætning, kr."}>
          <Input name="estimatedRevenue" inputMode="decimal" defaultValue={oreToKrInput(sag.estimatedRevenue)} />
        </Field>
        <Field label="Estimeret omkostning, kr.">
          <Input name="estimatedCost" inputMode="decimal" defaultValue={oreToKrInput(sag.estimatedCost)} />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Beskrivelse">
            <Textarea name="description" defaultValue={sag.description} rows={3} />
          </Field>
        </div>
        <SubmitButton variant="secondary">Gem stamdata</SubmitButton>
      </form>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
