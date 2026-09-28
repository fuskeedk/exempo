"use client";

import { useState } from "react";
import { uploadDocumentAction } from "@/app/actions/documents";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui";
import { isNetworkFailure, queuePhotoForm, queuePhotoIfOffline } from "@/lib/offline-queue";

export function FieldPhotoForm({ caseId }: { caseId: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  async function upload(formData: FormData) {
    setNotice(null);
    try {
      if (await queuePhotoIfOffline(formData)) {
        setNotice("Venter");
        return;
      }
      await uploadDocumentAction(formData);
    } catch (err) {
      if (isNetworkFailure(err)) {
        await queuePhotoForm(formData);
        setNotice("Venter");
        return;
      }
      setNotice(err instanceof Error ? err.message : "Filen kunne ikke gemmes.");
    }
  }
  return (
    <form action={upload} className="mt-3 grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="category" value="FOTO" />
      <Input type="file" name="file" accept="image/*" required />
      <SubmitButton variant="secondary">Foto</SubmitButton>
      {notice ? <p className="text-sm text-pine-2 sm:col-span-2">{notice}</p> : null}
    </form>
  );
}
