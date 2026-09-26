/** User-written case notes. Calendar and status events stay on the timeline. */
export const WORK_ORDER_NOTE_MARK = "NOTE";

export function formatWorkOrderNote(title: string, body = ""): string {
  const heading = title.trim() || "Note";
  const text = body.trim();
  return text ? `${WORK_ORDER_NOTE_MARK}\n${heading}\n${text}` : `${WORK_ORDER_NOTE_MARK}\n${heading}`;
}

export function isWorkOrderUserNote(note?: string | null): boolean {
  if (!note) return false;
  return note === WORK_ORDER_NOTE_MARK || note.startsWith(`${WORK_ORDER_NOTE_MARK}\n`);
}

export function workOrderNoteTitle(note: string): { title: string; body: string } {
  const lines = isWorkOrderUserNote(note) ? note.split("\n").slice(1) : note.split("\n");
  const [first, ...rest] = lines;
  return { title: first || "Note", body: rest.join("\n").trim() };
}
