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
  let folderId: string | undefined;
  if (folderIdRaw) {
    const folder = await prisma.documentFolder.findFirst({
      where: { id: folderIdRaw, caseId },
      select: { id: true },
    });
    folderId = folder?.id;
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${back}?besked=${encodeURIComponent("Vælg en fil.")}`);
  }
  if (file.size > 15 * 1024 * 1024) {
    redirect(`${back}?besked=${encodeURIComponent("Filen må højst være 15 MB.")}`);
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = path.extname(file.name).slice(0, 12) || (file.type.includes("png") ? ".png" : "");
  const filename = `${randomUUID()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  await prisma.document.create({
    data: {
      caseId,
      filename,
      originalName: signerName ? `Underskrift ${signerName}.png` : file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      category,
      folderId,
      uploadedById: user.id,
    },
  });

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
