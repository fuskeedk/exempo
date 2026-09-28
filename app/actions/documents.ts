"use server";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { DOCUMENT_CATEGORIES, type DocumentCategory } from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function persistCaseDocument(input: {
  caseId: string;
  userId: string;
  originalName: string;
  mimeType: string;
  bytes: Buffer;
  category: string;
  folderId?: string;
}) {
  const category: DocumentCategory = DOCUMENT_CATEGORIES.includes(input.category as DocumentCategory)
    ? (input.category as DocumentCategory)
    : "ANDET";
  if (!input.caseId) throw new Error("Sagen mangler.");
  if (input.bytes.length === 0) throw new Error("Vælg en fil.");
  if (input.bytes.length > 15 * 1024 * 1024) throw new Error("Filen må højst være 15 MB.");
  const sag = await prisma.case.findUnique({ where: { id: input.caseId }, select: { id: true } });
  if (!sag) throw new Error("Sagen findes ikke.");
  let folderId: string | undefined;
  if (input.folderId) {
    const folder = await prisma.documentFolder.findFirst({
      where: { id: input.folderId, caseId: input.caseId },
      select: { id: true },
    });
    folderId = folder?.id;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(input.originalName).slice(0, 12) || (input.mimeType.includes("png") ? ".png" : "");
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOAD_DIR, filename), input.bytes);
  await prisma.document.create({
    data: {
      caseId: input.caseId,
      filename,
      originalName: input.originalName.slice(0, 180) || "dokument",
      mimeType: input.mimeType || "application/octet-stream",
      size: input.bytes.length,
      category,
      folderId,
      uploadedById: input.userId,
    },
  });
  revalidatePath(`/sager/${input.caseId}`);
  revalidatePath("/min-dag");
}

export async function uploadDocumentAction(formData: FormData) {
  const user = await requireSession();
  const caseId = String(formData.get("caseId") ?? "");
  const categoryRaw = String(formData.get("category") ?? "ANDET");
  const category: DocumentCategory = DOCUMENT_CATEGORIES.includes(
    categoryRaw as DocumentCategory,
  )
    ? (categoryRaw as DocumentCategory)
    : "ANDET";
  const extraWorkId = String(formData.get("extraWorkId") ?? "").trim();
  const signerName = String(formData.get("signerName") ?? "").trim();
  const folderIdRaw = String(formData.get("folderId") ?? "").trim();
  const back = caseId ? `/sager/${caseId}` : "/min-dag";
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${back}?besked=${encodeURIComponent("Vælg en fil.")}`);
  }
  try {
    await persistCaseDocument({
      caseId,
      userId: user.id,
      originalName: signerName ? `Underskrift ${signerName}.png` : file.name,
      mimeType: file.type || "application/octet-stream",
      bytes: Buffer.from(await file.arrayBuffer()),
      category,
      folderId: folderIdRaw,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Filen kunne ikke gemmes.";
    redirect(`${back}?besked=${encodeURIComponent(message)}`);
  }

  if (extraWorkId && signerName) {
    const extra = await prisma.extraWork.findFirst({ where: { id: extraWorkId, caseId } });
    if (extra) {
      await prisma.extraWork.update({
        where: { id: extraWorkId },
        data: { status: "GODKENDT", signedName: signerName, signedAt: new Date() },
      });
    }
  }

  revalidatePath(`/sager/${caseId}`);
  revalidatePath("/min-dag");
}

export async function createDocumentFolderAction(formData: FormData) {
  await requireSession();
  const caseId = String(formData.get("caseId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!caseId) return;
  if (!name) {
    redirect(`/sager/${caseId}?besked=${encodeURIComponent("Angiv et mappenavn.")}`);
  }
  const sag = await prisma.case.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!sag) {
    redirect(`/sager/${caseId}?besked=${encodeURIComponent("Sagen findes ikke.")}`);
  }
  await prisma.documentFolder.create({ data: { caseId, name } });
  revalidatePath(`/sager/${caseId}`);
}
