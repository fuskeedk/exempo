import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { isSession, jsonError, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function POST(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const form = await request.formData();
  const caseId = String(form.get("caseId") ?? "");
  const file = form.get("file");
  if (!caseId) return jsonError("Sag mangler.");
  if (!(file instanceof File) || file.size === 0) return jsonError("Vælg et foto.");
  if (file.size > 15 * 1024 * 1024) return jsonError("Filen må højst være 15 MB.");

  const uploadDir = path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  const ext = path.extname(file.name || ".jpg").slice(0, 12) || ".jpg";
  const filename = `${randomUUID()}${ext}`;
  await writeFile(path.join(uploadDir, filename), Buffer.from(await file.arrayBuffer()));
  const document = await prisma.document.create({
    data: {
      caseId,
      filename,
      originalName: file.name || "foto.jpg",
      mimeType: file.type || "image/jpeg",
      size: file.size,
      category: "FOTO",
      uploadedById: user.id,
    },
  });
  return jsonOk({ ok: true, id: document.id });
}
