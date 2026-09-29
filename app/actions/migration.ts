"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import {
  customerNote,
  mapMigration,
  markerKey,
  matchPerson,
  partyKey,
  sourceLabel,
  type MigrationSheet,
  type MigrationSource,
} from "@/lib/migration";
import { nextCaseNumber } from "@/lib/numbers";
import { prisma } from "@/lib/prisma";
import { rowsFromUpload } from "@/lib/spreadsheet";

const SOURCE_FROM_LABEL: Record<string, MigrationSource> = {
  Minuba: "minuba",
  Ordrestyring: "ordrestyring",
  Apacta: "apacta",
  fil: "andet",
};

function preferredSource(value: string): MigrationSource | "auto" {
  if (value === "minuba" || value === "ordrestyring" || value === "apacta" || value === "andet") return value;
  return "auto";
}

export async function importMigrationAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const files = formData.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length === 0) fail("Vælg en fil.");
  if (files.length > 6) fail("Højst 6 filer ad gangen.");
  const preferred = preferredSource(String(formData.get("source") ?? ""));
  const sheets: Array<{ name: string; sheet: MigrationSheet }> = [];
  for (const file of files) {
    if (file.size > 12 * 1024 * 1024) fail(`${file.name} er for stor.`);
    try {
      sheets.push({ name: file.name, sheet: mapMigration(await rowsFromUpload(file), preferred) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Filen kunne ikke læses.";
      fail(`${file.name}: ${message}`);
    }
  }

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, cvr: true, notes: true },
  });
  const byMarker = new Map<string, string>();
  const byCvr = new Map<string, string>();
  const byName = new Map<string, string>();
  for (const customer of customers) {
    const match = customer.notes.match(/Overført fra (Minuba|Ordrestyring|Apacta|fil) \(kundenr\. ([^)]+)\)/);
    const source = match ? SOURCE_FROM_LABEL[match[1]] : undefined;
    if (source && match) byMarker.set(markerKey(source, match[2]), customer.id);
    const cvr = customer.cvr.replace(/\D/g, "");
    if (cvr.length === 8) byCvr.set(cvr, customer.id);
    const key = partyKey(customer.name);
    if (key) byName.set(key, customer.id);
  }
  const existingCases = new Set(
    (await prisma.case.findMany({ select: { caseNumber: true } })).map((row) => row.caseNumber),
  );
  const people = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const parts: string[] = [];
  for (const { sheet } of sheets) {
    const label = sourceLabel(sheet.source);
    if (sheet.kind === "kunder") {
      let created = 0;
      let skipped = sheet.skipped;
      for (const row of sheet.customers) {
        const found = findCustomer(sheet.source, row.externalNumber, row.cvr, row.name, byMarker, byCvr, byName);
        if (found) {
          skipped += 1;
          continue;
        }
        await createCustomer(sheet.source, row, byMarker, byCvr, byName);
        created += 1;
      }
      parts.push(countLine(label, "kunder", created, skipped));
    } else if (sheet.kind === "varer") {
      let created = 0;
      let skipped = 0;
      for (const row of sheet.products) {
        const current = await prisma.product.findUnique({ where: { sku: row.sku }, select: { id: true } });
        if (current) {
          skipped += 1;
          continue;
        }
        await prisma.product.create({
          data: {
            sku: row.sku,
            name: row.name,
            barcode: row.barcode,
            unit: row.unit,
            group: "EGNE",
            costPrice: row.costPrice,
            salePrice: row.salePrice,
          },
        });
        created += 1;
      }
      parts.push(countLine(label, "varer", created, skipped));
    } else {
      let created = 0;
      let skipped = sheet.skipped;
      for (const row of sheet.orders) {
        if (row.externalNumber && existingCases.has(row.externalNumber)) {
          skipped += 1;
          continue;
        }
        const customerName = row.customerName || "Ukendt";
        let customerId = findCustomer(sheet.source, row.customerNumber, "", customerName, byMarker, byCvr, byName);
        if (!customerId && customerName !== "Ukendt") {
          customerId = await createCustomer(
            sheet.source,
            {
              externalNumber: row.customerNumber,
              name: customerName,
              cvr: "",
              email: row.email,
              phone: row.phone,
              street: row.street,
              postal: row.postal,
              city: row.city,
              notes: "",
            },
            byMarker,
            byCvr,
            byName,
          );
        }
        const caseNumber = row.externalNumber || (await nextCaseNumber());
        if (existingCases.has(caseNumber)) {
          skipped += 1;
          continue;
        }
        const assignedToId = matchPerson(row.responsible, people);
        const description = [row.description, !assignedToId && row.responsible ? `Ansvarlig: ${row.responsible}` : ""]
          .filter(Boolean)
          .join("\n");
        await prisma.case.create({
          data: {
            caseNumber,
            title: row.title,
            description,
            customerId,
            customerName,
            customerAddress: row.street,
            customerPostal: row.postal,
            customerCity: row.city,
            customerPhone: row.phone,
            customerEmail: row.email,
            requisition: row.requisition,
            referencePerson: row.reference,
            orderType: row.orderType,
            trade: row.trade,
            state: row.state,
            assignedToId: assignedToId || null,
            scheduledStart: row.start,
            scheduledEnd: row.end,
            estimatedRevenue: row.priceOre,
            events: {
              create: { toState: row.state, note: `Overført fra ${label}` },
            },
          },
        });
        existingCases.add(caseNumber);
        created += 1;
      }
      parts.push(countLine(label, "sager", created, skipped));
    }
  }

  revalidatePath("/overflytning");
  revalidatePath("/kunder");
  revalidatePath("/sager");
  revalidatePath("/varer");
  redirect(`/overflytning?besked=${encodeURIComponent(parts.join(" "))}`);
}

function fail(message: string): never {
  redirect(`/overflytning?fejl=${encodeURIComponent(message)}`);
}

function countLine(label: string, noun: string, created: number, skipped: number) {
  const skippedText = skipped > 0 ? `, ${skipped} sprunget over` : "";
  return `${label}: ${created} ${noun}${skippedText}.`;
}

function findCustomer(
  source: MigrationSource,
  externalNumber: string,
  cvr: string,
  name: string,
  byMarker: Map<string, string>,
  byCvr: Map<string, string>,
  byName: Map<string, string>,
) {
  const marker = markerKey(source, externalNumber);
  if (marker && byMarker.has(marker)) return byMarker.get(marker) ?? "";
  if (cvr.length === 8 && byCvr.has(cvr)) return byCvr.get(cvr) ?? "";
  const key = partyKey(name);
  if (key && byName.has(key)) return byName.get(key) ?? "";
  return "";
}

async function createCustomer(
  source: MigrationSource,
  row: {
    externalNumber: string;
    name: string;
    cvr: string;
    email: string;
    phone: string;
    street: string;
    postal: string;
    city: string;
    notes: string;
  },
  byMarker: Map<string, string>,
  byCvr: Map<string, string>,
  byName: Map<string, string>,
) {
  const customer = await prisma.customer.create({
    data: {
      name: row.name,
      type: row.cvr.length === 8 ? "ERHVERV" : "PRIVAT",
      cvr: row.cvr,
      email: row.email,
      phone: row.phone,
      notes: customerNote(source, row.externalNumber, row.notes),
      addresses: row.street
        ? { create: { label: "Primær", street: row.street, postal: row.postal, city: row.city } }
        : undefined,
    },
  });
  const marker = markerKey(source, row.externalNumber);
  if (marker) byMarker.set(marker, customer.id);
  if (row.cvr.length === 8) byCvr.set(row.cvr, customer.id);
  const key = partyKey(row.name);
  if (key) byName.set(key, customer.id);
  return customer.id;
}
