"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function uploadDocumentAction(formData: FormData) {
  const user = await requireSession();
  const caseId = String(formData.get("caseId") ?? "");
  const categoryRaw = String(formData.get("category") ?? "ANDET");
  const category: DocumentCategory = DOCUMENT_CATEGORIES.includes(
    categoryRaw as DocumentCategory,
  )
    ? (categoryRaw as DocumentCategory)
    : "ANDET";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Vælg en fil.");
  }
  if (file.size > 15 * 1024 * 1024) {
    throw new Error("Filen må højst være 15 MB.");
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12);
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  await prisma.document.create({
    data: {
      caseId,
      filename,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      category,
      uploadedById: user.id,
    },
  });

  revalidatePath(`/sager/${caseId}`);
}
