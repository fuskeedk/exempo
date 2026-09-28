import { NextResponse } from "next/server";
import { saveTimesheetActivity } from "@/app/actions/field";
import { saveKlsAction } from "@/app/actions/kls";
import { persistCaseDocument } from "@/app/actions/documents";
import { getSession } from "@/lib/auth";

type SyncItem = {
  id?: string;
  kind?: string;
  payload?: Record<string, unknown>;
};

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { items?: SyncItem[] } | null;
  const items = Array.isArray(body?.items) ? body.items : [];
  const done: string[] = [];

  for (const item of items) {
    const id = typeof item.id === "string" ? item.id : "";
    if (!id) continue;
    try {
      if (item.kind === "time") {
        const payload = item.payload ?? {};
        await saveTimesheetActivity({
          intent: payload.intent === "register" ? "register" : "plan",
          kind: payload.kind === "FRAVAER" ? "FRAVAER" : "ARBEJDE",
          date: String(payload.date ?? ""),
          startHour: Number(payload.startHour ?? 0),
          startMinute: Number(payload.startMinute ?? 0),
          endHour: Number(payload.endHour ?? 0),
          endMinute: Number(payload.endMinute ?? 0),
          allDay: Boolean(payload.allDay),
          caseId: String(payload.caseId ?? ""),
          note: String(payload.note ?? ""),
          forUserId: payload.forUserId ? String(payload.forUserId) : undefined,
          absenceType: payload.absenceType ? String(payload.absenceType) : undefined,
          activityId: payload.activityId ? String(payload.activityId) : undefined,
          source: payload.source === "case" ? "case" : payload.source === "activity" ? "activity" : undefined,
          ...(payload.fromCaseId ? { fromCaseId: String(payload.fromCaseId) } : {}),
        });
      } else if (item.kind === "kls") {
        const fields = (item.payload?.fields ?? {}) as Record<string, unknown>;
        const form = new FormData();
        for (const [key, value] of Object.entries(fields)) form.set(key, String(value ?? ""));
        const result = await saveKlsAction(form);
        if (result?.error) throw new Error(result.error);
      } else if (item.kind === "photo") {
        const payload = item.payload ?? {};
        const raw = String(payload.data ?? "");
        const bytes = Buffer.from(raw, "base64");
        if (bytes.length === 0 || bytes.length > 8 * 1024 * 1024) {
          throw new Error("Billedet kan ikke gemmes.");
        }
        await persistCaseDocument({
          caseId: String(payload.caseId ?? ""),
          userId: session.id,
          originalName: String(payload.name ?? "foto.jpg"),
          mimeType: String(payload.mimeType ?? "image/jpeg"),
          bytes,
          category: String(payload.category ?? "FOTO"),
          folderId: String(payload.folderId ?? ""),
        });
      } else {
        throw new Error("Ukendt kø.");
      }
      done.push(id);
    } catch {
      // Keep the item so the next flush can retry.
    }
  }

  return NextResponse.json({ done });
}
