"use client";

import { useState } from "react";
import { saveKlsAction, startKlsAction } from "@/app/actions/kls";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { KLS_STATUS_LABELS, KLS_STATUSES, type KlsStatus } from "@/lib/catalog";
import { klsTradeLabel, sortKlsTemplates } from "@/lib/kls-catalog";
import { formatDateTime } from "@/lib/dates";

type CheckRow = {
  id: string;
  status: string;
  comment: string;
  label: string;
  sortOrder: number;
};

type TemplateOption = {
  id: string;
  name: string;
  trade: string;
};

export function KlsStartForm({
  caseId,
  trade,
  templates,
}: {
  caseId: string;
  trade: string;
  templates: TemplateOption[];
}) {
  const [error, setError] = useState<string | null>(null);
  async function submit(formData: FormData) {
    setError(null);
    const result = await startKlsAction(formData);
    if (result?.error) setError(result.error);
  }
  const sorted = sortKlsTemplates(templates, trade);
  const preferred =
    sorted.find((template) => template.trade === trade)?.id ??
    sorted.find((template) => template.trade === "ANDET")?.id ??
    sorted[0]?.id;
  return (
    <Card>
      <h2 className="font-serif text-xl">KLS</h2>
      <p className="mt-1 text-sm text-muted">
        KLS er valgfrit. Tilføj kun en tjekliste, hvis sagen kræver kvalitetsledelse. Sagen kan lukkes og faktureres uden KLS.
      </p>
      {error ? <p className="mt-3 rounded-xl bg-[#f8e8e0] px-3 py-2 text-sm text-[var(--rust)]">{error}</p> : null}
      {sorted.length === 0 ? (
        <p className="mt-4 text-sm text-muted">
          Der er ingen KLS-skemaer endnu. Opret dem under{" "}
          <a className="text-pine-2 underline-offset-4 hover:underline" href="/indstillinger#kls">
            Indstillinger → KLS-skemaer
          </a>
          .
        </p>
      ) : (
      <form action={submit} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="caseId" value={caseId} />
        <label className="min-w-[18rem] flex-1">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted">Skema</span>
          <Select name="templateId" defaultValue={preferred} required className="text-ink">
            {sorted.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.trade !== trade ? ` · ${klsTradeLabel(template.trade)}` : ""}
              </option>
            ))}
          </Select>
        </label>
        <SubmitButton>Tilføj KLS</SubmitButton>
      </form>
      )}
    </Card>
  );
}

export function KlsForm({
  caseId,
  reportId,
  templateName,
  signedAt,
  signedByName,
  notes,
  checks,
}: {
  caseId: string;
  reportId: string;
  templateName: string;
  signedAt: string | null;
  signedByName: string | null;
  notes: string;
  checks: CheckRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const sorted = checks.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  async function submit(formData: FormData) {
    setError(null);
    const result = await saveKlsAction(formData);
    if (result?.error) setError(result.error);
  }
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-serif text-xl">KLS</h2>
          <p className="text-sm text-muted">{templateName}</p>
        </div>
        {signedAt ? (
          <span className="tone-green rounded-full px-3 py-1 text-xs font-semibold">
            Underskrevet {formatDateTime(new Date(signedAt))}
            {signedByName ? ` af ${signedByName}` : ""}
          </span>
        ) : (
          <span className="tone-amber rounded-full px-3 py-1 text-xs font-semibold">Kladde</span>
        )}
      </div>
      {error ? <p className="mt-3 rounded-xl bg-[#f8e8e0] px-3 py-2 text-sm text-[var(--rust)]">{error}</p> : null}
      {!signedAt ? (
        <p className="mt-3 text-sm text-muted">
          Sæt hvert punkt til OK, Afvigelse eller Ikke relevant, før du underskriver.
        </p>
      ) : null}
      <form action={submit} className="mt-4 space-y-4">
        <input type="hidden" name="reportId" value={reportId} />
        <input type="hidden" name="caseId" value={caseId} />
        {sorted.map((check) => (
          <div key={check.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1fr_160px]">
            <p className="text-sm font-medium">{check.label}</p>
            <Select name={`status-${check.id}`} defaultValue={check.status} disabled={Boolean(signedAt)}>
              {KLS_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {KLS_STATUS_LABELS[status as KlsStatus]}
                </option>
              ))}
            </Select>
            <Input
              name={`comment-${check.id}`}
              defaultValue={check.comment}
              placeholder="Kommentar / afvigelse"
              className="sm:col-span-2"
              disabled={Boolean(signedAt)}
            />
          </div>
        ))}
        <Field label="Noter">
          <Textarea name="notes" defaultValue={notes} rows={3} disabled={Boolean(signedAt)} />
        </Field>
        <div className="flex flex-wrap gap-3">
          {!signedAt ? (
            <>
              <SubmitButton>Gem KLS</SubmitButton>
              <button
                type="submit"
                name="sign"
                value="1"
                className="inline-flex items-center justify-center rounded-full border border-pine bg-pine px-4 py-2.5 text-sm font-semibold text-white"
              >
                Underskriv KLS
              </button>
            </>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
