"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { transitionCaseAction } from "@/app/actions/cases";
import { createCaseCreditNoteAction, createInvoiceAction } from "@/app/actions/invoices";
import { DeleteInvoiceDraftButton } from "@/components/DeleteInvoiceDraftButton";
import { WORK_ORDER_STAGES, workOrderIgangActions, workOrderStageIndex, workOrderStageTone } from "@/lib/workorder";
import { STATE_LABELS, isTimeLocked, type CaseState } from "@/lib/fsm";

type InvoiceLite = { id: string; invoiceNumber: string; status: string; kind: string };

export function WorkOrderPipeline({
  caseId,
  caseNumber,
  state,
  allowed,
  scheduled,
  office,
  invoices,
  purchaseCount,
}: {
  caseId: string;
  caseNumber: string;
  state: string;
  allowed: string[];
  scheduled: boolean;
  office: boolean;
  invoices: InvoiceLite[];
  purchaseCount: number;
}) {
  const current = workOrderStageIndex(state);
  const drafts = invoices.filter((invoice) => invoice.status === "KLADDE");
  const locked = isTimeLocked(state);

  return (
    <div className="wo-pipeline">
      {WORK_ORDER_STAGES.map((stage, index) => {
        const tone = workOrderStageTone(index, current);
        if (stage.id === "igang") {
          const actions = workOrderIgangActions(state, allowed);
          const empty = actions.length === 0 && state !== "KLAR_TIL_FAKTURA" && !(office && locked);
          return (
            <details key={stage.id} className={`wo-chevron wo-chevron--${tone}`}>
              <summary>
                {stage.label}
                <span aria-hidden>▾</span>
              </summary>
              <div className="wo-chevron-menu">
                {empty ? <p>Ingen skift herfra.</p> : null}
                {state === "KLAR_TIL_FAKTURA" ? <p className="wo-chevron-current">Færdigmeldt</p> : null}
                {actions.map((action) => (
                  <ChevronAction
                    key={action.label}
                    caseId={caseId}
                    toState={action.toState}
                    note={action.note}
                  >
                    {action.label}
                  </ChevronAction>
                ))}
                {office && locked ? (
                  <ChevronAction caseId={caseId} toState="I_GANG" note="Sagen er genåbnet.">
                    Genåbn
                  </ChevronAction>
                ) : null}
              </div>
            </details>
          );
        }
        if (stage.id === "faktura") {
          return (
            <details key={stage.id} className={`wo-chevron wo-chevron--${tone}`}>
              <summary>
                {stage.label}
                <span aria-hidden>▾</span>
              </summary>
              <div className="wo-chevron-menu">
                {office ? (
                  <>
                    <form action={createInvoiceAction}>
                      <input type="hidden" name="caseId" value={caseId} />
                      <button type="submit">Opret faktura</button>
                    </form>
                    <form action={createInvoiceAction}>
                      <input type="hidden" name="caseId" value={caseId} />
                      <input type="hidden" name="kind" value="ACONTO" />
                      <button type="submit">Opret aconto</button>
                    </form>
                    <form action={createCaseCreditNoteAction}>
                      <input type="hidden" name="caseId" value={caseId} />
                      <button type="submit">Opret kreditnota</button>
                    </form>
                    <Link href={`/indkob?ny=1&sag=${encodeURIComponent(caseId)}`}>
                      Tilføj indkøbsfaktura (EDI)
                    </Link>
                    <Link href={`/indkob?q=${encodeURIComponent(caseNumber)}&sag=${encodeURIComponent(caseId)}`}>
                      Vis indkøbsfaktura (EDI){purchaseCount ? ` (${purchaseCount})` : ""}
                    </Link>
                    {drafts.flatMap((invoice, index) => [
                      <Link key={`${invoice.id}-vis`} href={`/fakturaer/${invoice.id}?linjer=1`}>
                        {invoice.kind === "KREDITNOTA"
                          ? `Vis kreditnota-kladde ${index + 1}`
                          : `Vis fakturakladde ${index + 1}`}
                      </Link>,
                      <DeleteInvoiceDraftButton
                        key={`${invoice.id}-slet`}
                        invoiceId={invoice.id}
                        invoiceNumber={invoice.invoiceNumber}
                        kind={invoice.kind}
                        next={`/sager/${caseId}`}
                        variant="menu"
                      />,
                    ])}
                  </>
                ) : (
                  <p>Kun kontoret kan oprette faktura og indkøb.</p>
                )}
              </div>
            </details>
          );
        }
        const options = stage.states.filter((item) => allowed.includes(item) || item === state);
        return (
          <details key={stage.id} className={`wo-chevron wo-chevron--${tone}`}>
            <summary>
              {stage.label}
              <span aria-hidden>▾</span>
            </summary>
            <div className="wo-chevron-menu">
              {options.length === 0 ? (
                <p>Ingen skift herfra.</p>
              ) : (
                options.map((item) => {
                  if (item === state) {
                    return (
                      <p key={item} className="wo-chevron-current">
                        {STATE_LABELS[item as CaseState]}
                      </p>
                    );
                  }
                  if (item === "PLANLAGT" && !scheduled) {
                    return (
                      <p key={item} className="wo-chevron-hint">
                        Læg sagen i kalenderen, før den kan sættes til Planlagt.{" "}
                        <Link href="/kalender">Åbn kalender</Link>
                      </p>
                    );
                  }
                  return (
                    <form key={item} action={transitionCaseAction}>
                      <input type="hidden" name="caseId" value={caseId} />
                      <input type="hidden" name="toState" value={item} />
                      <button type="submit">{STATE_LABELS[item as CaseState]}</button>
                    </form>
                  );
                })
              )}
            </div>
          </details>
        );
      })}
    </div>
  );
}

export function WorkOrderDocTools({
  documents,
}: {
  documents: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    category: string;
    createdAt: string;
    uploader: string;
  }>;
}) {
  const [mode, setMode] = useState<"list" | "gallery">("list");
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => doc.originalName.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q));
  }, [documents, query]);

  return (
    <>
      <div className="wo-doc-tools">
        <div className="wo-doc-modes">
          <button type="button" className={mode === "list" ? "is-active" : ""} onClick={() => setMode("list")}>
            Listevisning
          </button>
          <button type="button" className={mode === "gallery" ? "is-active" : ""} onClick={() => setMode("gallery")}>
            Gallerivisning
          </button>
        </div>
        <label className="wo-search">
          <span className="sr-only">Søg i dokumentation</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Søg i dokumentation" />
        </label>
      </div>
      {mode === "gallery" ? (
        <div className="wo-gallery">
          {filtered.length === 0 ? <p className="wo-empty">Ingen dokumentation.</p> : null}
          {filtered.map((doc) => (
            <a key={doc.id} href={`/api/files/${doc.id}`} target="_blank" className="wo-gallery-item">
              {doc.mimeType.startsWith("image/") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`/api/files/${doc.id}`} alt={doc.originalName} />
              ) : (
                <span>{doc.originalName}</span>
              )}
            </a>
          ))}
        </div>
      ) : (
        <table className="wo-table">
          <thead>
            <tr>
              <th></th>
              <th>Detaljer</th>
              <th>Beskrivelse</th>
              <th>Størrelse</th>
              <th>Dato</th>
              <th>Uploadet af</th>
              <th>Oprindelse</th>
              <th>Handlinger</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8}>Ingen dokumentation.</td>
              </tr>
            ) : (
              filtered.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <input type="checkbox" />
                  </td>
                  <td>
                    {doc.mimeType.startsWith("image/") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="wo-thumb" src={`/api/files/${doc.id}`} alt="" />
                    ) : (
                      "📄"
                    )}
                  </td>
                  <td>{doc.originalName}</td>
                  <td>{formatBytes(doc.size)}</td>
                  <td>{doc.createdAt}</td>
                  <td>{doc.uploader}</td>
                  <td>{doc.category}</td>
                  <td>
                    <a className="wo-link" href={`/api/files/${doc.id}`} target="_blank">
                      Åbn
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </>
  );
}

function ChevronAction({
  caseId,
  toState,
  note,
  children,
}: {
  caseId: string;
  toState: string;
  note: string;
  children: string;
}) {
  return (
    <form action={transitionCaseAction}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="toState" value={toState} />
      <input type="hidden" name="note" value={note} />
      <button type="submit">{children}</button>
    </form>
  );
}

function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace(".", ",")} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
