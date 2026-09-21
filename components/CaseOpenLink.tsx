import Link from "next/link";

export function CaseOpenLink({
  caseId,
  label,
}: {
  caseId: string;
  label: string;
}) {
  return (
    <Link
      href={`/sager/${caseId}`}
      className="cal-job-open"
      aria-label={`Åbn ${label}`}
      title="Åbn arbejdsseddel"
      draggable={false}
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      ›
    </Link>
  );
}
