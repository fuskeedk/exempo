import { NextResponse } from "next/server";
import { knownTenantSlug, readCompanyLogo } from "@/lib/logo";
import { getSettings } from "@/lib/settings";
import { enterTenant } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const tenant = knownTenantSlug(slug);
  if (!tenant) return NextResponse.json({ error: "Ukendt virksomhed." }, { status: 404 });
  enterTenant(tenant);
  const settings = await getSettings();
  const filename = settings.company_logo?.trim();
  if (!filename) return NextResponse.json({ error: "Intet logo." }, { status: 404 });
  const logo = await readCompanyLogo(tenant, filename);
  if (!logo) return NextResponse.json({ error: "Logoet findes ikke." }, { status: 404 });
  return new NextResponse(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.mime,
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="${encodeURIComponent(logo.filename)}"`,
    },
  });
}
