"use client";

import { deleteCaseAction } from "@/app/actions/cases";

export function DeleteCaseButton({
  caseId,
  caseNumber,
  locked,
}: {
  caseId: string;
  caseNumber: string;
  locked?: boolean;
}) {
  if (locked) {
    return (
      <button
        type="button"
        className="wo-delete-case"
        title="Sagen kan ikke slettes, fordi der er sendte fakturaer."
        aria-label="Slet sag"
        disabled
      >
        🗑
      </button>
    );
  }

  return (
    <form action={deleteCaseAction}>
      <input type="hidden" name="id" value={caseId} />
      <button
        type="submit"
        className="wo-delete-case"
        title="Slet sag"
        aria-label="Slet sag"
        onClick={(event) => {
          if (!window.confirm(`Slet sagen ${caseNumber}? Den kan ikke fortrydes.`)) {
            event.preventDefault();
          }
        }}
      >
        🗑
      </button>
    </form>
  );
}
