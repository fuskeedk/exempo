import { uploadDocumentAction } from "@/app/actions/documents";
import { SubmitButton } from "@/components/SubmitButton";

export function PhotoCapture({
  caseId,
  category,
  label,
}: {
  caseId: string;
  category: "FØR" | "EFTER" | "FOTO";
  label: string;
}) {
  return (
    <form action={uploadDocumentAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="category" value={category} />
      <label className="text-sm">
        {label}
        <input
          type="file"
          name="file"
          accept="image/*"
          required
          className="mt-1 block w-full text-sm"
        />
      </label>
      <SubmitButton variant="secondary">{label}</SubmitButton>
    </form>
  );
}
