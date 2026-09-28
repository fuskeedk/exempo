"use client";

import { useMemo, useState } from "react";
import { createDocumentFolderAction, uploadDocumentAction } from "@/app/actions/documents";
import { WorkOrderDocTools } from "@/components/WorkOrderClient";
import { SubmitButton } from "@/components/SubmitButton";
import { Input, Select } from "@/components/ui";
import { DOCUMENT_LABELS, DOCUMENT_UPLOAD_CATEGORIES, type DocumentCategory } from "@/lib/catalog";

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
        <Input name="name" required maxLength={60} />
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
      <form action={uploadDocumentAction} className="wo-inline-form" key={folderId}>
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
