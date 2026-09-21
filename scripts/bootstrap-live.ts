import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultTenant, registerLogin } from "../lib/platform";
import { ensureTemplateDb } from "../lib/provision";
import { seedWholesalerAgreements } from "../lib/wholesalers";

const prisma = new PrismaClient();

async function main() {
  ensureDefaultTenant("Exempo");
  ensureTemplateDb();
  const users = await prisma.user.findMany({ select: { email: true } });
  for (const user of users) registerLogin(user.email, "exempo");

  const settings = await prisma.setting.count();
  if (settings === 0) {
    await prisma.setting.createMany({
      data: [
        { key: "company_name", value: "Exempo" },
        { key: "company_domain", value: "exempo.dk" },
        { key: "case_number_prefix", value: "EX" },
        { key: "case_number_year", value: "1" },
        { key: "case_number_digits", value: "4" },
        { key: "case_number_next", value: "8" },
        { key: "quote_number_prefix", value: "TIL" },
        { key: "quote_number_year", value: "1" },
        { key: "quote_number_digits", value: "4" },
        { key: "quote_number_next", value: "2" },
        { key: "invoice_number_prefix", value: "FAK" },
        { key: "invoice_number_year", value: "1" },
        { key: "invoice_number_digits", value: "4" },
        { key: "invoice_number_next", value: "2" },
        { key: "sproom_webhook_secret", value: randomBytes(24).toString("hex") },
      ],
    });
  }

  if ((await prisma.purchase.count()) === 0) {
    const sag = await prisma.case.findFirst({ orderBy: { createdAt: "asc" } });
    await prisma.purchase.create({
      data: {
        source: "SPROOM",
        externalId: "demo-stark-1",
        supplierName: "Stark A/S",
        supplierCvr: "17233541",
        invoiceNumber: "SI-10482",
        issuedAt: new Date(),
        netAmount: 640000,
        vatAmount: 160000,
        grossAmount: 800000,
        status: "MODTAGET",
        lines: {
          create: [{ description: "Konstruktionstræ C24", quantity: 24, unitPrice: 18500, amount: 444000 }],
        },
      },
    });
    if (sag) {
      await prisma.purchase.create({
        data: {
          source: "MANUEL",
          externalId: "demo-ao-1",
          supplierName: "AO Johansen",
          invoiceNumber: "452901",
          issuedAt: new Date(),
          netAmount: 248000,
          vatAmount: 62000,
          grossAmount: 310000,
          status: "AFVENTER",
          caseId: sag.id,
          lines: {
            create: [{ description: "Gipsplader", quantity: 1, unitPrice: 248000, amount: 248000 }],
          },
        },
      });
    }
  }

  if ((await prisma.mailAccount.count()) === 0) {
    await prisma.mailAccount.create({
      data: {
        name: "Faktura",
        address: "faktura@exempo.dk",
        purpose: "FAKTURA",
      },
    });
  }

  await seedWholesalerAgreements(prisma);

  console.log("Live tenant bootstrapped", { users: users.length });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
