"use client";

import { useMemo, useState } from "react";
import { createDocumentFolderAction, uploadDocumentAction } from "@/app/actions/documents";
import { WorkOrderDocTools } from "@/components/WorkOrderClient";
import { SubmitButton } from "@/components/SubmitButton";
import { Input, Select } from "@/components/ui";
import { DOCUMENT_LABELS, DOCUMENT_UPLOAD_CATEGORIES, type DocumentCategory } from "@/lib/catalog";
import { isNetworkFailure, queuePhotoForm, queuePhotoIfOffline } from "@/lib/offline-queue";

type DocRow = {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  category: string;
  folderId: string | null;
  createdAt: string;
  uploader: string;
};

export function DocumentationBoard({
  caseId,
  folders,
  documents,
}: {
  caseId: string;
  folders: Array<{ id: string; name: string }>;
  documents: DocRow[];
}) {
  const [folderId, setFolderId] = useState("");
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
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of documents) {
      if (!doc.folderId) continue;
      map.set(doc.folderId, (map.get(doc.folderId) ?? 0) + 1);
    }
    return map;
  }, [documents]);
  const visible = folderId ? documents.filter((doc) => doc.folderId === folderId) : documents;
  const listed = visible.map((doc) => ({
    ...doc,
    category: folders.find((folder) => folder.id === doc.folderId)?.name || doc.category,
  }));

  return (
    <>
      <form action={createDocumentFolderAction} className="wo-inline-form">
        <input type="hidden" name="caseId" value={caseId} />
        <Input name="name" required maxLength={60} aria-label="Mappe" placeholder="Mappe" />
        <SubmitButton>Ny mappe</SubmitButton>
      </form>
      <div className="wo-folders">
        <button type="button" className={`wo-folder ${folderId === "" ? "is-active" : ""}`} onClick={() => setFolderId("")}>
          Alle
          <small>{documents.length}</small>
        </button>
        {folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            className={`wo-folder ${folderId === folder.id ? "is-active" : ""}`}
            onClick={() => setFolderId(folder.id)}
          >
            {folder.name}
            <small>{counts.get(folder.id) ?? 0}</small>
          </button>
        ))}
      </div>
      {notice ? <p className="text-sm text-pine-2">{notice}</p> : null}
      <form action={upload} className="wo-inline-form" key={folderId}>
        <input type="hidden" name="caseId" value={caseId} />
        <Input type="file" name="file" required />
        <Select name="folderId" defaultValue={folderId}>
          <option value="">Mappe</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.name}
            </option>
          ))}
        </Select>
        <Select name="category" defaultValue="FOTO">
          {DOCUMENT_UPLOAD_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {DOCUMENT_LABELS[category as DocumentCategory]}
            </option>
          ))}
        </Select>
        <SubmitButton>Tilføj dokumentation</SubmitButton>
      </form>
      <WorkOrderDocTools documents={listed} />
    </>
  );
}
