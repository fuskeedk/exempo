import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Ikke logget ind." }, { status: 401 });
  }

  const { id } = await context.params;
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document) {
    return NextResponse.json({ error: "Filen findes ikke." }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), "uploads", document.filename);
  try {
    const data = await readFile(filePath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(document.originalName)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Filen kunne ikke læses." }, { status: 404 });
  }
}
