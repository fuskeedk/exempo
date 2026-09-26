/** User-written case notes. Author comes from the signed-in user. */
export const WORK_ORDER_NOTE_MARK = "NOTE";

export function formatWorkOrderNote(text: string): string {
  return `${WORK_ORDER_NOTE_MARK}\n${text.trim()}`;
}

export function isWorkOrderUserNote(note?: string | null): boolean {
  if (!note) return false;
  return note === WORK_ORDER_NOTE_MARK || note.startsWith(`${WORK_ORDER_NOTE_MARK}\n`);
}

export function workOrderNoteText(note: string): string {
  if (!isWorkOrderUserNote(note)) return note.trim();
  return note.slice(WORK_ORDER_NOTE_MARK.length).replace(/^\n/, "").trim();
}

export function workOrderNoteTitle(note: string): { title: string; body: string } {
  return { title: workOrderNoteText(note) || "Note", body: "" };
}
