import Link from "next/link";
import {
  addCaseNoteAction,
  addMaterialAction,
  addTimeEntryAction,
  deleteMaterialAction,
} from "@/app/actions/cases";
import { addCatalogMaterialAction } from "@/app/actions/products";
import { AoProductSearch } from "@/components/AoProductSearch";
import { takeFromVanAction } from "@/app/actions/van";
import { uploadDocumentAction } from "@/app/actions/documents";
import { createInvoiceAction } from "@/app/actions/invoices";
import { createExtraWorkAction, setExtraWorkStatusAction } from "@/app/actions/field";
import { KlsPanel, StamdataForm, Timeline } from "@/components/CasePanels";
import { InvoiceBadge } from "@/components/StatusBadge";
import { PhotoCapture } from "@/components/PhotoCapture";
import { SignaturePad } from "@/components/SignaturePad";
import { MaterialPriceCells } from "@/components/MaterialPriceCells";
import { ProductThumb, materialImageUrl } from "@/components/ProductThumb";
import { SubmitButton } from "@/components/SubmitButton";
import { WorkOrderDonut } from "@/components/WorkOrderDonut";
import { WorkOrderDocTools, WorkOrderPipeline } from "@/components/WorkOrderClient";
import { DeleteCaseButton } from "@/components/DeleteCaseButton";
import { PrintButton } from "@/components/PrintButton";
import { ContactBlock } from "@/components/ContactActions";
import {
  DescriptionEditor,
  EditableSection,
  PriceEditor,
  StaffEditor,
} from "@/components/WorkOrderEditors";
import { Input, Select } from "@/components/ui";
import type { SessionUser } from "@/lib/auth";
import { canManageOffice, canSeeCaseCoverage } from "@/lib/auth";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_LABELS,
  EXTRA_STATUS_LABELS,
  PRICING_MODE_LABELS,
  TIME_KIND_LABELS,
  TIME_KINDS,
  TRADE_LABELS,
  canDeleteCase,
  isTrade,
} from "@/lib/catalog";
import type { CaseEconomics } from "@/lib/coverage";
import {
  formatCompactDate,
  formatHoursDa,
  formatNumericDate,
  formatNumericDateTime,
  formatTime,
  toDateInput,
} from "@/lib/dates";
import { formatPlace } from "@/lib/geo";
import { allowedTransitions, isCaseState, isTimeLocked, TIME_LOCKED_MESSAGE } from "@/lib/fsm";
import { formatKr, formatKrAmount, percent } from "@/lib/money";
import { PURCHASE_STATUS_LABELS } from "@/lib/purchases";
import {
  futurePlannedSlots,
  workOrderHours,
  workOrderNoteTitle,
  workOrderShortcuts,
  type PlannedSlot,
  type PlannedSlotSource,
} from "@/lib/workorder";
import type { Prisma } from "@prisma/client";

export type WorkOrderCase = Prisma.CaseGetPayload<{
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
type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  unit: string;
  salePrice: number;
  costPrice: number;
  imageUrl?: string;
};

type VanItem = {
  productId: string;
  quantity: number;
  name: string;
  sku: string;
};

export function WorkOrder({
  sag,
  economics,
  user,
  employees,
  templates,
  products,
  vanItems = [],
  catalogEnabled = false,
  vanEnabled = false,
  plannedActivities = [],
}: {
  sag: WorkOrderCase;
  economics: CaseEconomics;
  user: SessionUser;
  employees: Employee[];
  templates: Template[];
  products: CatalogProduct[];
  vanItems?: VanItem[];
  catalogEnabled?: boolean;
  vanEnabled?: boolean;
  plannedActivities?: PlannedSlotSource[];
}) {
  const office = canManageOffice(user.role);
  const showCoverage = canSeeCaseCoverage(user, sag.projectLeaderId);
  const hours = workOrderHours(sag.timeEntries);
  const plannedSlots: PlannedSlot[] = futurePlannedSlots({
    caseId: sag.id,
    assignedTo: sag.assignedTo,
    scheduledStart: sag.scheduledStart,
    scheduledEnd: sag.scheduledEnd,
    activities: plannedActivities,
  });
  const shortcuts = workOrderShortcuts(plannedSlots.length > 0);
  const nextPlanned = plannedSlots[0];
  const allowed = isCaseState(sag.state) ? allowedTransitions(sag.state) : [];
  const scheduled = Boolean(sag.assignedToId && sag.scheduledStart && sag.scheduledEnd);
  const notes = sag.events.filter((event) => event.note && event.fromState === event.toState);
  const place = formatPlace([sag.customerAddress, sag.customerPostal, sag.customerCity]);
  const laborShare = Math.max(0, economics.laborCost);
  const materialShare = Math.max(0, economics.materialCost);
  const profitShare = Math.max(0, economics.contribution);
  const billed = economics.billed;
  const unbilled = Math.max(0, economics.revenue - billed);

  return (
    <div className="wo">
      <div className="wo-top">
        <h1>Arbejdsseddel for ordre {sag.caseNumber}</h1>
        {office ? (
          <a className="wo-settings" href="#indstillinger">
            Indstillinger for ordre
          </a>
        ) : null}
      </div>

      <div className="wo-layout">
        <div className="wo-main">
          <div className="wo-strip">
            <WorkOrderPipeline
              caseId={sag.id}
              caseNumber={sag.caseNumber}
              state={sag.state}
              allowed={allowed}
              scheduled={scheduled}
              office={office}
              invoices={sag.invoices.map((invoice) => ({
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                status: invoice.status,
                kind: invoice.kind,
              }))}
              purchaseCount={sag.purchases.length}
            />
            <div className="wo-kpis">
              <div className="wo-kpi wo-kpi--chart">
                <WorkOrderDonut
                  slices={[
                    { value: laborShare, color: "#7aa0ae" },
                    { value: materialShare, color: "#215744" },
                    { value: profitShare, color: "#eadfce" },
                  ]}
                />
                <ul>
                  <li>
                    <i style={{ background: "#7aa0ae" }} /> Timer
                  </li>
                  <li>
                    <i style={{ background: "#215744" }} /> Materialer
                  </li>
                  <li>
                    <i style={{ background: "#eadfce" }} /> Overskud
                  </li>
                </ul>
              </div>
              {showCoverage ? (
                <div className="wo-kpi">
                  <strong>{economics.coverage === null ? "—" : percent(economics.coverage)}</strong>
                  <span>Dækningsgrad</span>
                </div>
              ) : null}
              <div className="wo-kpi">
                <strong>
                  {hours.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Timer
                </strong>
                <span>Timer forbrugt i alt</span>
              </div>
            </div>
          </div>

          <Section id="kunde" title="Kunde">
            <div className="wo-cols">
              <div className="wo-contact-wrap">
                <dl className="wo-kv wo-kv--tight">
                  <div>
                    <dt>Forsikring</dt>
                    <dd>{sag.insuranceCompany || "—"}</dd>
                  </div>
                  <div>
                    <dt>Kundenr.</dt>
                    <dd>—</dd>
                  </div>
                  <div>
                    <dt>Policenr.</dt>
                    <dd>—</dd>
                  </div>
                </dl>
                <ContactBlock
                  attn={sag.referencePerson}
                  name={sag.customerName}
                  street={sag.customerAddress}
                  postal={sag.customerPostal}
                  city={sag.customerCity}
                  country={sag.country}
                  email={sag.customerEmail}
                  phone={sag.customerPhone}
                />
              </div>
              <p className="wo-aside-note">
                Næste planlagte tid:{" "}
                {nextPlanned
                  ? `${formatCompactDate(nextPlanned.start)} ${formatTime(nextPlanned.start)}–${formatTime(nextPlanned.end)}`
                  : "Ikke planlagt"}
              </p>
            </div>
          </Section>

          <EditableSection
            id="ordrebeskrivelse"
            title="Ordrebeskrivelse"
            canEdit={office}
            view={
              <dl className="wo-dl">
                <div>
                  <dt>Forsikringsskade</dt>
                  <dd>
                    {sag.title}
                    {sag.claimNumber ? ` · ${sag.claimNumber}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Rek.nr.</dt>
                  <dd>{sag.requisition || "—"}</dd>
                </div>
                <div>
                  <dt>Arbejdet omfatter</dt>
                  <dd className="whitespace-pre-wrap">{sag.description || "—"}</dd>
                </div>
              </dl>
            }
          >
            <DescriptionEditor
              caseId={sag.id}
              title={sag.title}
              description={sag.description}
              requisition={sag.requisition}
              claimNumber={sag.claimNumber}
              orderType={sag.orderType}
            />
          </EditableSection>

          <Section id="anlaeg" title="Anlæg">
            {place ? (
              <ContactBlock
                kicker="Installationsadresse"
                name={sag.customerName}
                street={sag.customerAddress}
                postal={sag.customerPostal}
                city={sag.customerCity}
                country={sag.country}
              />
            ) : (
              <p>Ingen anlægsadresse angivet.</p>
            )}
          </Section>

          <Section id="opfoelgning" title="Opfølgning">
            <dl className="wo-kv">
              <div>
                <dt>Opfølgningsdato</dt>
                <dd>{sag.followUpAt ? formatNumericDate(sag.followUpAt) : "Ikke angivet"}</dd>
              </div>
              <div>
                <dt>Note</dt>
                <dd>{sag.followUpNote || "Ikke angivet"}</dd>
              </div>
            </dl>
            {sag.extraWorks.length === 0 ? (
              <p className="wo-empty">Ingen ekstraarbejder.</p>
            ) : (
              <ul className="wo-list">
                {sag.extraWorks.map((extra) => (
                  <li key={extra.id}>
                    {extra.title} · {formatKr(extra.amount)} ·{" "}
                    {EXTRA_STATUS_LABELS[extra.status as keyof typeof EXTRA_STATUS_LABELS] ?? extra.status}
                    {extra.signedName ? ` · underskrevet af ${extra.signedName}` : ""}
                  </li>
                ))}
              </ul>
            )}
            <form action={createExtraWorkAction} className="wo-inline-form">
              <input type="hidden" name="caseId" value={sag.id} />
              <Input name="title" placeholder="Opfølgning / ekstraarbejde" required />
              <Input name="amount" placeholder="Beløb, kr." />
              <SubmitButton variant="secondary">Tilføj</SubmitButton>
            </form>
            {sag.extraWorks.some((extra) => extra.status === "KLADDE" || extra.status === "SENDT") ? (
              <div className="mt-4 space-y-4">
                {sag.extraWorks
                  .filter((extra) => extra.status === "KLADDE" || extra.status === "SENDT")
                  .map((extra) => (
                    <div key={`act-${extra.id}`} className="rounded-xl border border-line p-3">
                      <p className="text-sm font-medium">{extra.title}</p>
                      <form action={setExtraWorkStatusAction} className="mt-2 flex gap-2">
                        <input type="hidden" name="extraWorkId" value={extra.id} />
                        {extra.status === "KLADDE" ? (
                          <button name="status" value="SENDT" className="wo-link">
                            Send
                          </button>
                        ) : null}
                        <button name="status" value="GODKENDT" className="wo-link">
                          Godkend
                        </button>
                        <button name="status" value="AFVIST" className="wo-link">
                          Afvis
                        </button>
                      </form>
                      <div className="mt-3">
                        <SignaturePad caseId={sag.id} extraWorkId={extra.id} />
                      </div>
                    </div>
                  ))}
              </div>
            ) : null}
          </Section>

          <Section
            id="noter"
            title="Noter"
            actions={
              <form action={addCaseNoteAction} className="wo-inline-form">
                <input type="hidden" name="caseId" value={sag.id} />
                <Input name="title" placeholder="Navn" required />
                <Input name="body" placeholder="Beskrivelse" />
                <SubmitButton variant="secondary">Tilføj note</SubmitButton>
              </form>
            }
          >
            <table className="wo-table">
              <thead>
                <tr>
                  <th>Navn</th>
                  <th>Beskrivelse</th>
                  <th>Dato</th>
                  <th>Oprettet af</th>
                </tr>
              </thead>
              <tbody>
                {notes.length === 0 ? (
                  <tr>
                    <td colSpan={4}>Ingen noter.</td>
                  </tr>
                ) : (
                  notes.map((event) => {
                    const parsed = workOrderNoteTitle(event.note);
                    return (
                      <tr key={event.id}>
                        <td>{parsed.title}</td>
                        <td>{parsed.body || "—"}</td>
                        <td>{formatNumericDateTime(event.createdAt)}</td>
                        <td>{event.user?.name ?? "—"}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Section>

          <EditableSection
            id="pris"
            title="Pris og tidsfrister"
            canEdit={office}
            view={
              <dl className="wo-kv wo-kv--split">
                <div>
                  <dt>Pris</dt>
                  <dd>
                    {PRICING_MODE_LABELS[sag.pricingMode as keyof typeof PRICING_MODE_LABELS] ?? sag.pricingMode}
                    {sag.estimatedRevenue ? `: ${formatKrAmount(sag.estimatedRevenue)}` : ""}
                  </dd>
                </div>
                <div>
                  <dt>Ordren skal påbegyndes senest</dt>
                  <dd>{sag.scheduledStart ? formatNumericDate(sag.scheduledStart) : "Ikke angivet"}</dd>
                </div>
                <div>
                  <dt>Ordren skal færdigmeldes senest</dt>
                  <dd>{sag.scheduledEnd ? formatNumericDate(sag.scheduledEnd) : "Ikke angivet"}</dd>
                </div>
              </dl>
            }
          >
            <PriceEditor
              caseId={sag.id}
              pricingMode={sag.pricingMode}
              estimatedRevenue={sag.estimatedRevenue}
              estimatedCost={sag.estimatedCost}
              workStart={sag.scheduledStart ? toDateInput(sag.scheduledStart) : ""}
              workEnd={sag.scheduledEnd ? toDateInput(sag.scheduledEnd) : ""}
            />
          </EditableSection>

          {showCoverage ? (
            <Section id="forbrug" title="Forbrugsoverblik">
              <div className="wo-charts">
                <ChartCard
                  title="Omsætning"
                  hint={`Faktureringsgrad: ${economics.revenue ? percent(billed / economics.revenue) : "—"}`}
                  slices={[
                    { value: billed, color: "#7aa0ae", label: "Faktureret" },
                    { value: unbilled, color: "#b85c38", label: "Ikke faktureret" },
                  ]}
                />
                <ChartCard
                  title="Omkostninger"
                  hint={`Færdiggørelse: ${economics.revenue ? percent(economics.cost / economics.revenue) : "—"}`}
                  slices={[
                    { value: laborShare, color: "#7aa0ae", label: "Timer brugt" },
                    { value: materialShare, color: "#215744", label: "Materiale brugt" },
                  ]}
                />
                <ChartCard
                  title="Dækning"
                  hint={`Realiseret dækningsgrad til dato: ${economics.coverage === null ? "—" : percent(economics.coverage)}`}
                  slices={[
                    { value: laborShare, color: "#7aa0ae", label: "Timer brugt" },
                    { value: materialShare, color: "#215744", label: "Materiale brugt" },
                    { value: profitShare, color: "#c4a35a", label: "Dækning" },
                  ]}
                />
              </div>
              {showCoverage ? (
                <p className="wo-money-row">
                  Dækningsbidrag total {formatKrAmount(economics.contribution)}
                  <span>{formatKrAmount(economics.cost)}</span>
                  <span>{formatKrAmount(economics.revenue)}</span>
                </p>
              ) : null}
            </Section>
          ) : (
            <div id="forbrug" />
          )}

          <EditableSection
            id="medarbejdere"
            title="Medarbejdere"
            canEdit={office}
            view={
              <dl className="wo-kv wo-kv--split">
                <div>
                  <dt>Afdeling</dt>
                  <dd>Projektledere</dd>
                </div>
                <div>
                  <dt>Ansvarlig</dt>
                  <dd>
                    {sag.projectLeader
                      ? `${sag.projectLeader.name} (${sag.projectLeader.role === "PL" ? "PL" : sag.projectLeader.role})`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Tilknyttede medarbejdere</dt>
                  <dd>
                    {sag.assignedTo
                      ? `${sag.assignedTo.name}${isTrade(sag.assignedTo.trade) ? ` (${TRADE_LABELS[sag.assignedTo.trade]})` : ""}`
                      : "Ingen"}
                  </dd>
                </div>
              </dl>
            }
          >
            <StaffEditor
              caseId={sag.id}
              assignedToId={sag.assignedToId ?? ""}
              projectLeaderId={sag.projectLeaderId ?? ""}
              employees={employees}
            />
          </EditableSection>

          <Section id="kvalitetssikring" title="Kvalitetssikring">
            <p className="wo-empty">
              Vedhæftede kvalitetssikringsdokumenter:{" "}
              {sag.documents.filter((doc) => doc.category === "KLS").length || "Ingen"}
            </p>
            <KlsPanel sag={sag} templates={templates} />
          </Section>

          <Section id="dokumentation" title="Dokumentation">
            <p className="wo-hint">Tag før- og efterfotos her på sagen.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <PhotoCapture caseId={sag.id} category="FØR" label="Før-foto" />
              <PhotoCapture caseId={sag.id} category="EFTER" label="Efter-foto" />
            </div>
            <form action={uploadDocumentAction} className="wo-inline-form mt-3">
              <input type="hidden" name="caseId" value={sag.id} />
              <Input type="file" name="file" required />
              <Select name="category" defaultValue="FOTO">
                {DOCUMENT_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {DOCUMENT_LABELS[category]}
                  </option>
                ))}
              </Select>
              <SubmitButton>Tilføj dokumentation</SubmitButton>
            </form>
            <WorkOrderDocTools
              documents={sag.documents.map((doc) => ({
                id: doc.id,
                originalName: doc.originalName,
                mimeType: doc.mimeType,
                size: doc.size,
                category: DOCUMENT_LABELS[doc.category as keyof typeof DOCUMENT_LABELS] ?? doc.category,
                createdAt: formatNumericDateTime(doc.createdAt),
                uploader: doc.uploadedBy?.name ?? "—",
              }))}
            />
          </Section>

          <Section id="grossist" title="Grossistindkøb">
            {sag.purchases.length === 0 ? (
              <p className="wo-empty">
                Ingen indkøbsfakturaer på sagen.{" "}
                {office ? (
                  <Link className="wo-link" href="/indkob">
                    Gå til Indkøb
                  </Link>
                ) : null}
              </p>
            ) : (
              <table className="wo-table">
                <thead>
                  <tr>
                    <th>Leverandør</th>
                    <th>Fakturanr.</th>
                    <th>Status</th>
                    <th>Beløb</th>
                  </tr>
                </thead>
                <tbody>
                  {sag.purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>
                        <Link className="wo-link" href={`/indkob/${purchase.id}`}>
                          {purchase.supplierName}
                        </Link>
                      </td>
                      <td>{purchase.invoiceNumber || "—"}</td>
                      <td>{PURCHASE_STATUS_LABELS[purchase.status] ?? purchase.status}</td>
                      <td>{formatKrAmount(purchase.netAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section id="materialer" title="Registrering af materialer">
            {vanEnabled && vanItems.length > 0 ? (
              <form action={takeFromVanAction} className="wo-inline-form">
                <input type="hidden" name="caseId" value={sag.id} />
                <Select name="productId" required>
                  {vanItems.map((item) => (
                    <option key={item.productId} value={item.productId}>
                      {item.sku} · {item.name} ({String(item.quantity).replace(".", ",")} på vogn)
                    </option>
                  ))}
                </Select>
                <Input name="quantity" defaultValue="1" />
                <SubmitButton>Fra vogn</SubmitButton>
              </form>
            ) : vanEnabled ? (
              <p className="wo-hint">
                Ingen varer på vognen. Læg op under <a className="wo-link" href="/vognlager">Vognlager</a>.
              </p>
            ) : null}
            <AoProductSearch caseId={sag.id} compact />
            {catalogEnabled && products.length > 0 ? (
              <div className="wo-suggest">
                <p>Foreslåede materialer</p>
                <div className="wo-suggest-row">
                  {products.slice(0, 5).map((product) => (
                    <form key={product.id} action={addCatalogMaterialAction} className="wo-suggest-card">
                      <input type="hidden" name="caseId" value={sag.id} />
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="quantity" value="1" />
                      <ProductThumb src={product.imageUrl} name={product.name} size={48} />
                      <strong>{product.name}</strong>
                      <span>{product.sku}</span>
                      <span>Indkøb: {formatKrAmount(product.costPrice)}</span>
                      <SubmitButton variant="ghost">Tilføj materiale</SubmitButton>
                    </form>
                  ))}
                </div>
              </div>
            ) : null}
            <form action={addMaterialAction} className="wo-inline-form">
              <input type="hidden" name="caseId" value={sag.id} />
              <Input name="name" placeholder="Beskrivelse" required />
              <Input name="quantity" placeholder="Antal" defaultValue="1" />
              <Input name="costPrice" placeholder="Indkøb kr." />
              <Input name="unitPrice" placeholder="Salgspris kr." required />
              <SubmitButton variant="secondary">Tilføj</SubmitButton>
            </form>
            <table className="wo-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Materialenr.</th>
                  <th>Antal</th>
                  <th>Beskrivelse</th>
                  <th>Indkøb</th>
                  <th>Avak</th>
                  <th>Moms%</th>
                  <th>Salgspris</th>
                  <th>Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sag.materials.length === 0 ? (
                  <tr>
                    <td colSpan={10}>Ingen materialer.</td>
                  </tr>
                ) : (
                  sag.materials.map((material) => (
                      <tr key={material.id}>
                        <td className="wo-material-thumb">
                          <ProductThumb src={materialImageUrl(material)} name={material.name} size={40} />
                        </td>
                        <td>{material.sku || material.product?.sku || "—"}</td>
                        <td>{String(material.quantity).replace(".", ",")}</td>
                        <td>{material.name}</td>
                        <MaterialPriceCells
                          id={material.id}
                          quantity={material.quantity}
                          costPrice={material.costPrice || 0}
                          unitPrice={material.unitPrice}
                        />
                        <td>
                          <form action={deleteMaterialAction}>
                            <input type="hidden" name="id" value={material.id} />
                            <button type="submit" className="wo-link" aria-label="Slet materiale">
                              🗑
                            </button>
                          </form>
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          </Section>

          <Section id="timesedler" title="Registrering fra timesedler">
            {isTimeLocked(sag.state) ? (
              <p className="wo-empty">{TIME_LOCKED_MESSAGE}</p>
            ) : (
              <form action={addTimeEntryAction} className="wo-inline-form">
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
                <SubmitButton>Registrér tid</SubmitButton>
              </form>
            )}
            <table className="wo-table">
              <thead>
                <tr>
                  <th>Medarbejder</th>
                  <th>Dato</th>
                  <th>Timer</th>
                  <th>Type</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {sag.timeEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5}>Ingen tid registreret.</td>
                  </tr>
                ) : (
                  sag.timeEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td>{entry.user.name}</td>
                      <td>{formatNumericDate(entry.date)}</td>
                      <td>{String(entry.hours).replace(".", ",")}</td>
                      <td>{TIME_KIND_LABELS[entry.kind as keyof typeof TIME_KIND_LABELS] ?? entry.kind}</td>
                      <td>{entry.note || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </Section>

          {plannedSlots.length > 0 ? (
            <Section id="planlagte-timer" title="Planlagte timer">
              <table className="wo-table">
                <thead>
                  <tr>
                    <th>Medarbejder</th>
                    <th>Dato</th>
                    <th>Tid</th>
                    <th>Timer</th>
                  </tr>
                </thead>
                <tbody>
                  {plannedSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td>{slot.userName}</td>
                      <td>{formatCompactDate(slot.start)}</td>
                      <td>
                        {slot.allDay
                          ? "Hele dagen"
                          : `${formatTime(slot.start)}–${formatTime(slot.end)}`}
                      </td>
                      <td>{formatHoursDa(slot.hours)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          ) : null}

          <Section id="laaste" title="Låste materialer og timer">
            <p className="wo-empty">Ingen låste poster.</p>
          </Section>

          <Section id="fakturaer" title="Fakturaer">
            {office ? (
              <form action={createInvoiceAction} className="mb-3">
                <input type="hidden" name="caseId" value={sag.id} />
                <SubmitButton>Dan faktura</SubmitButton>
              </form>
            ) : null}
            {sag.invoices.length === 0 ? (
              <p className="wo-empty">Ingen fakturaer.</p>
            ) : (
              <ul className="wo-list">
                {sag.invoices.map((invoice) => (
                  <li key={invoice.id} className="flex items-center justify-between gap-3">
                    <Link className="wo-link" href={`/fakturaer/${invoice.id}`}>
                      {invoice.invoiceNumber}
                    </Link>
                    <InvoiceBadge status={invoice.status} kind={invoice.kind} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {showCoverage ? (
            <Section id="kalkulation" title="Kalkulation">
              <dl className="wo-kv">
                <div>
                  <dt>Omsætning</dt>
                  <dd>{formatKrAmount(economics.revenue)}</dd>
                </div>
                <div>
                  <dt>Omkostninger</dt>
                  <dd>{formatKrAmount(economics.cost)}</dd>
                </div>
                <div>
                  <dt>Dækningsbidrag</dt>
                  <dd>{formatKrAmount(economics.contribution)}</dd>
                </div>
              </dl>
            </Section>
          ) : (
            <div id="kalkulation" />
          )}

          <Section id="haendelser" title="Hændelsesforløb">
            <Timeline sag={sag} />
          </Section>

          {office ? (
            <Section id="indstillinger" title="Indstillinger for ordre">
              <StamdataForm sag={sag} user={user} />
            </Section>
          ) : null}
        </div>

        <aside className="wo-rail no-print">
          <h2>Handlinger</h2>
          <div className="wo-actions">
            <Link href="/kalender" title="Kalender">
              📅
            </Link>
            <a href="#timesedler" title="Timeregistrering">
              ⏱
            </a>
            <PrintButton>🖨</PrintButton>
            {office ? (
              <DeleteCaseButton
                caseId={sag.id}
                caseNumber={sag.caseNumber}
                locked={!canDeleteCase(sag.invoices)}
              />
            ) : null}
          </div>
          <h2>Genveje</h2>
          <nav className="wo-shortcuts">
            {shortcuts.map((item) => (
              <a key={item.href} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
  actions,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <section id={id} className="wo-section">
      <header>
        <h2>{title}</h2>
        {actions}
      </header>
      <div className="wo-section-body">{children}</div>
    </section>
  );
}

function ChartCard({
  title,
  hint,
  slices,
}: {
  title: string;
  hint: string;
  slices: Array<{ value: number; color: string; label: string }>;
}) {
  return (
    <div className="wo-chart">
      <h3>{title}</h3>
      <p>{hint}</p>
      <WorkOrderDonut slices={slices} size={110} />
      <ul>
        {slices.map((slice) => (
          <li key={slice.label}>
            <i style={{ background: slice.color }} /> {slice.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
