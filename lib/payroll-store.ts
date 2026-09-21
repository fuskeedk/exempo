import {
  AGREEMENT_TEMPLATES,
  parseApprenticeJson,
  templateByCode,
  type AgreementRates,
} from "@/lib/agreements";
import { prisma } from "@/lib/prisma";

function ratesFromRow(row: {
  code: string;
  name: string;
  unionName: string;
  notes: string;
  pensionEmployerBps: number;
  pensionEmployeeBps: number;
  holidayPayBps: number;
  shBps: number;
  fritvalgBps: number;
  overtimeFirstHours: number;
  overtimeFirstPct: number;
  overtimeRestPct: number;
  overtimeFirstAddonOre: number;
  overtimeRestAddonOre: number;
  weekHours: number;
  sickPayPct?: number | null;
  childSickPayPct?: number | null;
  apprenticeJson: string;
}): AgreementRates {
  const fallback = templateByCode(row.code);
  return {
    code: row.code,
    name: row.name,
    unionName: row.unionName,
    notes: row.notes,
    pensionEmployerBps: row.pensionEmployerBps,
    pensionEmployeeBps: row.pensionEmployeeBps,
    holidayPayBps: row.holidayPayBps,
    shBps: row.shBps,
    fritvalgBps: row.fritvalgBps,
    overtimeFirstHours: row.overtimeFirstHours,
    overtimeFirstPct: row.overtimeFirstPct,
    overtimeRestPct: row.overtimeRestPct,
    overtimeFirstAddonOre: row.overtimeFirstAddonOre,
    overtimeRestAddonOre: row.overtimeRestAddonOre,
    weekHours: row.weekHours,
    sickPayPct: row.sickPayPct ?? fallback.sickPayPct,
    childSickPayPct: row.childSickPayPct ?? fallback.childSickPayPct,
    apprentices: parseApprenticeJson(row.apprenticeJson),
  };
}

function seedRow(row: AgreementRates) {
  return {
    code: row.code,
    name: row.name,
    unionName: row.unionName,
    notes: row.notes,
    pensionEmployerBps: row.pensionEmployerBps,
    pensionEmployeeBps: row.pensionEmployeeBps,
    holidayPayBps: row.holidayPayBps,
    shBps: row.shBps,
    fritvalgBps: row.fritvalgBps,
    overtimeFirstHours: row.overtimeFirstHours,
    overtimeFirstPct: row.overtimeFirstPct,
    overtimeRestPct: row.overtimeRestPct,
    overtimeFirstAddonOre: row.overtimeFirstAddonOre,
    overtimeRestAddonOre: row.overtimeRestAddonOre,
    weekHours: row.weekHours,
    sickPayPct: row.sickPayPct,
    childSickPayPct: row.childSickPayPct,
    apprenticeJson: JSON.stringify(row.apprentices),
  };
}

export async function seedAgreements(db: any) {
  if ((await db.collectiveAgreement.count()) > 0) return;
  await db.collectiveAgreement.createMany({
    data: AGREEMENT_TEMPLATES.map(seedRow),
  });
}

export async function ensureAgreements(db: any = prisma) {
  await seedAgreements(db);
}

export async function loadAgreement(code: string, db: any = prisma): Promise<AgreementRates> {
  await ensureAgreements(db);
  const row = await db.collectiveAgreement.findUnique({ where: { code } });
  if (!row) return templateByCode(code);
  return ratesFromRow(row);
}

export async function listAgreements(db: any = prisma): Promise<AgreementRates[]> {
  await ensureAgreements(db);
  const rows = await db.collectiveAgreement.findMany({ orderBy: { name: "asc" } });
  return rows.map((row: any) => ratesFromRow(row));
}
