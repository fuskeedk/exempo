import { KLS_STATUS_LABELS } from "@/lib/catalog";
import { STATE_LABELS, isCaseState } from "@/lib/fsm";
import { fieldTransitions, requireFieldCase, serializeJob } from "@/lib/mobile-field";
import { isSession, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";

export const OPTIONS = mobileOptions;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const { id } = await params;
  const sag = await requireFieldCase(user, id);
  if (sag instanceof Response) return sag;

  const report = sag.klsReports[0];
  return jsonOk({
    job: serializeJob(sag),
    nextStates: fieldTransitions(sag.state, user.role).map((state) => ({
      id: state,
      label: isCaseState(state) ? STATE_LABELS[state] : state,
    })),
    materials: sag.materials.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
    })),
    timeEntries: sag.timeEntries.map((entry) => ({
      id: entry.id,
      hours: entry.hours,
      kind: entry.kind,
      note: entry.note,
      date: entry.date,
      userName: entry.user.name,
    })),
    documents: sag.documents.map((doc) => ({
      id: doc.id,
      name: doc.originalName,
      category: doc.category,
      createdAt: doc.createdAt,
    })),
    extraWorks: sag.extraWorks,
    kls: report
      ? {
          id: report.id,
          name: report.template.name,
          signedAt: report.signedAt,
          notes: report.notes,
          checks: report.checks
            .slice()
            .sort((a, b) => a.item.sortOrder - b.item.sortOrder)
            .map((check) => ({
              id: check.id,
              label: check.item.label,
              status: check.status,
              statusLabel: KLS_STATUS_LABELS[check.status as keyof typeof KLS_STATUS_LABELS] ?? check.status,
              comment: check.comment,
            })),
          }
      : null,
  });
}
