"use client";

function snapMinutes(total: number, min: number, max: number) {
  const snapped = Math.round(total / 15) * 15;
  return Math.min(max, Math.max(min, snapped));
}

export function BookingResizeHandle({
  fromHour,
  toHour,
  pxPerHour,
  minEndMinutes,
  onCommit,
}: {
  fromHour: number;
  toHour: number;
  pxPerHour: number;
  minEndMinutes: number;
  onCommit: (endHour: number, endMinute: number) => void;
}) {
  return (
    <span
      className="cal-resize"
      title="Træk nederste kant for at ændre sluttid"
      role="separator"
      aria-label="Ændr sluttid"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        const column = (event.currentTarget as HTMLElement).closest("[data-cal-col]");
        if (!column) return;
        const rect = column.getBoundingClientRect();
        const height = Math.max(1, (toHour - fromHour) * pxPerHour);
        const min = Math.max(fromHour * 60 + 15, minEndMinutes);
        const max = toHour * 60;

        function minutesAt(clientY: number) {
          const ratio = (clientY - rect.top) / height;
          return snapMinutes(fromHour * 60 + ratio * (toHour - fromHour) * 60, min, max);
        }

        function finish(clientY: number) {
          const total = minutesAt(clientY);
          onCommit(Math.floor(total / 60), total % 60);
        }

        function onMove(move: PointerEvent) {
          move.preventDefault();
        }

        function onUp(up: PointerEvent) {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          finish(up.clientY);
        }

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
      }}
      onClick={(event) => event.stopPropagation()}
      onDragStart={(event) => event.preventDefault()}
    />
  );
}
