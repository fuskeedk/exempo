"use client";

import { deleteInvoiceDraftAction } from "@/app/actions/invoices";
import { invoiceDocumentTitle } from "@/lib/catalog";

export function DeleteInvoiceDraftButton({
  invoiceId,
  invoiceNumber,
  kind,
  next,
  variant = "default",
}: {
  invoiceId: string;
  invoiceNumber: string;
  kind?: string;
  next?: string;
  variant?: "default" | "compact" | "menu";
}) {
  const title = invoiceDocumentTitle(kind ?? "FAKTURA").toLowerCase();
  const className =
    variant === "menu"
      ? undefined
      : variant === "compact"
        ? "inline-flex items-center justify-center rounded-full border border-line bg-white px-3 py-1 text-xs font-semibold text-[#7c2f2a] hover:bg-paper"
        : "rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-[#7c2f2a]";
  return (
    <form action={deleteInvoiceDraftAction}>
      <input type="hidden" name="invoiceId" value={invoiceId} />
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <button
        type="submit"
        className={className}
        onClick={(event) => {
          if (!window.confirm(`Slet ${title}-kladden ${invoiceNumber}? Den kan ikke fortrydes.`)) {
            event.preventDefault();
          }
        }}
      >
        {variant === "menu" ? `Slet ${title}-kladde` : "Slet"}
      </button>
    </form>
  );
}
