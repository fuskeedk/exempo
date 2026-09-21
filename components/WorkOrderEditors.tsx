"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { patchCaseAction } from "@/app/actions/cases";
import { SubmitButton } from "@/components/SubmitButton";
import {
  ORDER_TYPES,
  ORDER_TYPE_LABELS,
  PRICING_MODES,
  PRICING_MODE_LABELS,
  TRADE_LABELS,
  isTrade,
} from "@/lib/catalog";
import { oreToKrInput } from "@/lib/money";

const CloseEdit = createContext<() => void>(() => {});

export function EditableSection({
  id,
  title,
  canEdit,
  view,
  children,
}: {
  id: string;
  title: string;
  canEdit: boolean;
  view: ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <section id={id} className={`wo-section${editing ? " is-editing" : ""}`}>
      <header>
        <h2>{title}</h2>
        {canEdit && !editing ? (
          <button type="button" className="wo-edit-btn" onClick={() => setEditing(true)}>
            Rediger
          </button>
        ) : null}
      </header>
      <div className="wo-section-body">
        <CloseEdit.Provider value={() => setEditing(false)}>{editing ? children : view}</CloseEdit.Provider>
      </div>
    </section>
  );
}

function EditorForm({
  caseId,
  section,
  children,
}: {
  caseId: string;
  section: string;
  children: ReactNode;
}) {
  const onCancel = useContext(CloseEdit);
  const [error, setError] = useState("");
  return (
    <form
      className="wo-edit-form"
      action={async (formData) => {
        setError("");
        try {
          await patchCaseAction(formData);
          onCancel();
        } catch (err) {
          setError(err instanceof Error ? err.message : "Kunne ikke gemme.");
        }
      }}
    >
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="section" value={section} />
      {children}
      {error ? <p className="wo-edit-error">{error}</p> : null}
      <div className="wo-edit-actions">
        <SubmitButton>Gem</SubmitButton>
        <button type="button" className="wo-edit-cancel" onClick={onCancel}>
          Annuller
        </button>
      </div>
    </form>
  );
}

export function DescriptionEditor({
  caseId,
  title,
  description,
  requisition,
  claimNumber,
  orderType,
}: {
  caseId: string;
  title: string;
  description: string;
  requisition: string;
  claimNumber: string;
  orderType: string;
}) {
  return (
    <EditorForm caseId={caseId} section="description">
      <label>
        Titel / forsikringsskade
        <input name="title" defaultValue={title} required />
      </label>
      <label>
        Ordretype
        <select name="orderType" defaultValue={orderType}>
          {ORDER_TYPES.map((type) => (
            <option key={type} value={type}>
              {ORDER_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Rek.nr.
        <input name="requisition" defaultValue={requisition} />
      </label>
      <label>
        Skadenr.
        <input name="claimNumber" defaultValue={claimNumber} />
      </label>
      <label className="wo-span">
        Arbejdet omfatter
        <textarea name="description" rows={6} defaultValue={description} />
      </label>
    </EditorForm>
  );
}

export function StaffEditor({
  caseId,
  assignedToId,
  projectLeaderId,
  employees,
}: {
  caseId: string;
  assignedToId: string;
  projectLeaderId: string;
  employees: { id: string; name: string; role: string; trade: string }[];
}) {
  const leaders = employees.filter((row) => row.role === "PL" || row.role === "ADMIN");
  return (
    <EditorForm caseId={caseId} section="staff">
      <label>
        Ansvarlig
        <select name="projectLeaderId" defaultValue={projectLeaderId}>
          <option value="">Ingen</option>
          {leaders.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Tilknyttede medarbejdere
        <select name="assignedToId" defaultValue={assignedToId}>
          <option value="">Ingen</option>
          {employees.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
              {isTrade(row.trade) ? ` (${TRADE_LABELS[row.trade]})` : ""}
            </option>
          ))}
        </select>
      </label>
    </EditorForm>
  );
}

export function PriceEditor({
  caseId,
  pricingMode,
  estimatedRevenue,
  estimatedCost,
  workStart,
  workEnd,
}: {
  caseId: string;
  pricingMode: string;
  estimatedRevenue: number;
  estimatedCost: number;
  workStart: string;
  workEnd: string;
}) {
  return (
    <EditorForm caseId={caseId} section="price">
      <p className="wo-hint">Ordren faktureres efter</p>
      <div className="wo-radios">
        {PRICING_MODES.map((mode) => (
          <label key={mode}>
            <input type="radio" name="pricingMode" value={mode} defaultChecked={pricingMode === mode} />
            {mode === "FORBRUG" ? "Forbrug" : PRICING_MODE_LABELS[mode]}
          </label>
        ))}
      </div>
      <label>
        Aftalt beløb / omsætning, kr.
        <input name="estimatedRevenue" inputMode="decimal" defaultValue={oreToKrInput(estimatedRevenue)} />
      </label>
      <label>
        Forventet omkostning, kr.
        <input name="estimatedCost" inputMode="decimal" defaultValue={oreToKrInput(estimatedCost)} />
      </label>
      <label>
        Ordren skal påbegyndes senest
        <input type="date" name="workStart" defaultValue={workStart} />
      </label>
      <label>
        Ordren skal færdigmeldes senest
        <input type="date" name="workEnd" defaultValue={workEnd} />
      </label>
    </EditorForm>
  );
}

export function FollowUpEditor({
  caseId,
  followUpAt,
  followUpNote,
}: {
  caseId: string;
  followUpAt: string;
  followUpNote: string;
}) {
  return (
    <EditorForm caseId={caseId} section="followup">
      <label>
        Opfølgningsdato
        <input type="date" name="followUpAt" defaultValue={followUpAt} />
      </label>
      <label>
        Note
        <input name="followUpNote" defaultValue={followUpNote} />
      </label>
    </EditorForm>
  );
}
