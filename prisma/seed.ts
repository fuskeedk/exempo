import bcrypt from "bcryptjs";
import { addDays, addHours, setHours, startOfWeek } from "date-fns";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ensureDefaultTenant, registerLogin } from "../lib/platform";
import { seedWholesalerAgreements } from "../lib/wholesalers";
import { DEFAULT_KLS_TEMPLATES } from "../lib/kls-catalog";

const prisma = new PrismaClient();

async function main() {
  await prisma.purchaseLine.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.mailAccount.deleteMany();
  await prisma.wholesalerAgreement.deleteMany();
  await prisma.setting.deleteMany();
  await prisma.klsCheck.deleteMany();
  await prisma.klsReport.deleteMany();
  await prisma.klsItem.deleteMany();
  await prisma.klsTemplate.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.extraWork.deleteMany();
  await prisma.material.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.absence.deleteMany();
  await prisma.document.deleteMany();
  await prisma.caseEvent.deleteMany();
  await prisma.resourceBooking.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.quoteLine.deleteMany();
  await prisma.case.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.serviceAgreement.deleteMany();
  await prisma.address.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("exempo123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Alex Holm",
      email: "admin@exempo.dk",
      passwordHash,
      role: "ADMIN",
      trade: "ANDET",
      phone: "11 22 33 44",
      hourlyRate: 65000,
      color: "#1f4a3a",
    },
  });

  const pl = await prisma.user.create({
    data: {
      name: "Pia Larsen",
      email: "pl@exempo.dk",
      passwordHash,
      role: "PL",
      trade: "ANDET",
      phone: "51 44 88 12",
      hourlyRate: 57500,
      color: "#3d5a80",
    },
  });

  const lars = await prisma.user.create({
    data: {
      name: "Lars Holm",
      email: "lars@exempo.dk",
      passwordHash,
      role: "MEDARBEJDER",
      trade: "TOMRER",
      phone: "22 18 40 91",
      hourlyRate: 46500,
      color: "#2d6a52",
    },
  });

  const henrik = await prisma.user.create({
    data: {
      name: "Henrik Madsen",
      email: "henrik@exempo.dk",
      passwordHash,
      role: "MEDARBEJDER",
      trade: "MURER",
      phone: "28 73 11 04",
      hourlyRate: 48000,
      color: "#b85c38",
    },
  });

  const sofie = await prisma.user.create({
    data: {
      name: "Sofie Kjær",
      email: "sofie@exempo.dk",
      passwordHash,
      role: "MEDARBEJDER",
      trade: "ELEKTRIKER",
      phone: "30 55 19 77",
      hourlyRate: 51000,
      color: "#7b4b94",
    },
  });

  const anders = await prisma.user.create({
    data: {
      name: "Anders Berg",
      email: "anders@exempo.dk",
      passwordHash,
      role: "MEDARBEJDER",
      trade: "MALER",
      phone: "26 90 33 18",
      hourlyRate: 43000,
      color: "#8a6d3b",
    },
  });

  const moeller = await prisma.customer.create({
    data: {
      name: "Familie Møller",
      type: "PRIVAT",
      email: "moeller@example.dk",
      phone: "40 12 88 21",
      addresses: { create: { label: "Hjem", street: "Strandvejen 214", postal: "2900", city: "Hellerup" } },
    },
    include: { addresses: true },
  });
  const nadia = await prisma.customer.create({
    data: {
      name: "Nadia Hassan",
      type: "PRIVAT",
      phone: "61 20 44 09",
      addresses: { create: { label: "Lejlighed", street: "Nørrebrogade 88, 3. th", postal: "2200", city: "København N" } },
    },
    include: { addresses: true },
  });
  const dam = await prisma.customer.create({
    data: {
      name: "Ole og Kirsten Dam",
      type: "PRIVAT",
      phone: "23 88 10 55",
      addresses: { create: { label: "Villa", street: "Birkevej 7", postal: "5000", city: "Odense C" } },
    },
    include: { addresses: true },
  });
  const aalborg = await prisma.customer.create({
    data: {
      name: "Aalborg Boligselskab",
      type: "ERHVERV",
      cvr: "12345678",
      phone: "98 12 40 00",
      addresses: { create: { label: "Vesterbro", street: "Vesterbro 14, st. tv", postal: "9000", city: "Aalborg" } },
    },
    include: { addresses: true },
  });
  const kragh = await prisma.customer.create({
    data: {
      name: "Jens Kragh",
      type: "PRIVAT",
      addresses: { create: { label: "Rækkehus", street: "Amagerbrogade 152", postal: "2300", city: "København S" } },
    },
    include: { addresses: true },
  });
  const frost = await prisma.customer.create({
    data: {
      name: "Line Frost",
      type: "PRIVAT",
      addresses: { create: { label: "Hus", street: "Helligkorsvej 9", postal: "4000", city: "Roskilde" } },
    },
    include: { addresses: true },
  });
  const glostrup = await prisma.customer.create({
    data: {
      name: "Glostrup Ejendomme",
      type: "ERHVERV",
      cvr: "87654321",
      addresses: { create: { label: "Hovedvejen", street: "Hovedvejen 41", postal: "2600", city: "Glostrup" } },
    },
    include: { addresses: true },
  });

  await prisma.product.createMany({
    data: [
      { sku: "GIPS-13", barcode: "5701234560001", name: "Gipsplade 13 mm", unit: "stk", group: "EGNE", costPrice: 4500, salePrice: 8900, stock: 48 },
      { sku: "FUG-01", barcode: "5701234560002", name: "Fugemasse hvid", unit: "stk", group: "EGNE", costPrice: 2800, salePrice: 6500, stock: 36 },
      { sku: "KABEL-2.5", barcode: "5701234560003", name: "Installationskabel 2,5 mm", unit: "m", group: "GROSSIST", costPrice: 900, salePrice: 1850, stock: 200 },
      { sku: "MAL-10", barcode: "5701234560004", name: "Vægmaling 10 L", unit: "stk", group: "EGNE", costPrice: 22000, salePrice: 38900, stock: 12 },
      { sku: "TIME-SVEND", name: "Svendetime", unit: "t", group: "YDELSE", costPrice: 28000, salePrice: 59500, stock: 0 },
    ],
  });

  const van = await prisma.resource.create({
    data: { name: "Varebil 1", type: "KØRETØJ", dailyRate: 45000, color: "#3d5a80" },
  });
  const lift = await prisma.resource.create({
    data: { name: "Lift 12 m", type: "UDSTYR", dailyRate: 120000, color: "#8a6d3b" },
  });

  const quote = await prisma.quote.create({
    data: {
      quoteNumber: "TIL-2026-0001",
      customerId: aalborg.id,
      addressId: aalborg.addresses[0].id,
      title: "Badeværelses-retablering efter rørskade",
      description: "Åbning, tørring og retablering af gulv og vægge.",
      trade: "VVS",
      pricingMode: "KALKULATION",
      status: "SENDT",
      createdById: pl.id,
      validUntil: addDays(new Date(), 21),
      lines: {
        create: [
          { kind: "TIMER", description: "VVS-svend", quantity: 16, unit: "t", unitPrice: 59500, costPrice: 28000 },
          { kind: "MATERIALE", description: "Rør og fittings", quantity: 1, unitPrice: 420000, costPrice: 210000 },
        ],
      },
    },
  });

  await prisma.serviceAgreement.create({
    data: {
      customerId: glostrup.id,
      title: "Årligt facadesyn",
      description: "Eftersyn af puds og fuger.",
      trade: "MURER",
      intervalMonths: 12,
      nextVisit: addDays(new Date(), 14),
      estimatedRevenue: 1250000,
    },
  });

  await prisma.absence.create({
    data: { userId: lars.id, date: addDays(new Date(), 3), hours: 7.4, type: "FERIE", note: "Sommerferie rest" },
  });

  const templates = DEFAULT_KLS_TEMPLATES;

  const createdTemplates = [];
  for (const template of templates) {
    createdTemplates.push(
      await prisma.klsTemplate.create({
        data: {
          name: template.name,
          trade: template.trade,
          items: {
            create: template.items.map((label, sortOrder) => ({ label, sortOrder })),
          },
        },
        include: { items: true },
      }),
    );
  }

  const monday = startOfWeek(new Date(), { weekStartsOn: 1 });

  const sag1 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0001",
      title: "Vandskade i køkken — villa",
      description:
        "Utæt opvaskemaskine har givet skade i sokkel, gulv og bagvæg. Forsikring har godkendt genopbygning.",
      customerId: moeller.id,
      addressId: moeller.addresses[0].id,
      customerName: "Familie Møller",
      customerAddress: "Strandvejen 214",
      customerPostal: "2900",
      customerCity: "Hellerup",
      customerPhone: "40 12 88 21",
      customerEmail: "moeller@example.dk",
      insuranceCompany: "Tryg",
      claimNumber: "TRY-88421",
      state: "I_GANG",
      trade: "TOMRER",
      assignedToId: lars.id,
      projectLeaderId: pl.id,
      scheduledStart: setHours(addDays(monday, 0), 8),
      scheduledEnd: setHours(addDays(monday, 1), 15),
      estimatedRevenue: 12800000,
      estimatedCost: 7400000,
      events: {
        create: [
          { fromState: null, toState: "NY", note: "Sag oprettet fra skadesanmeldelse.", userId: pl.id },
          { fromState: "NY", toState: "BESIGTIGELSE", note: "Besigtiget 12. september.", userId: pl.id },
          { fromState: "BESIGTIGELSE", toState: "PLANLAGT", note: "Lagt i Lars' kalender.", userId: pl.id },
          { fromState: "PLANLAGT", toState: "I_GANG", note: "Arbejde startet.", userId: lars.id },
        ],
      },
      timeEntries: {
        create: [
          { userId: lars.id, hours: 8, hourlyRate: 46500, date: addDays(monday, -3), note: "Nedtagning" },
          { userId: lars.id, hours: 7.5, hourlyRate: 46500, date: addDays(monday, -2), note: "Opbygning sokkel" },
        ],
      },
      materials: {
        create: [
          { name: "Fugtspærre og underlag", quantity: 1, unitPrice: 420000, costPrice: 210000 },
          { name: "Køkkenplade, eg", quantity: 1, unitPrice: 680000, costPrice: 340000 },
        ],
      },
    },
  });

  await prisma.extraWork.create({
    data: {
      caseId: sag1.id,
      title: "Udskiftning af sokkelpanel",
      description: "Ikke omfattet af oprindeligt skøn.",
      amount: 450000,
      status: "SENDT",
      createdById: lars.id,
    },
  });

  const sag2 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0002",
      title: "Brandskade i køkken — lejlighed",
      description: "Fedtbrand i emhætte. Fliser, el og malerarbejde skal genopbygges.",
      customerId: nadia.id,
      addressId: nadia.addresses[0].id,
      customerName: "Nadia Hassan",
      customerAddress: "Nørrebrogade 88, 3. th",
      customerPostal: "2200",
      customerCity: "København N",
      customerPhone: "61 20 44 09",
      insuranceCompany: "Topdanmark",
      claimNumber: "TOP-10211",
      state: "KLS",
      trade: "ELEKTRIKER",
      assignedToId: sofie.id,
      projectLeaderId: pl.id,
      scheduledStart: setHours(addDays(monday, 2), 8),
      scheduledEnd: setHours(addDays(monday, 2), 16),
      estimatedRevenue: 9600000,
      estimatedCost: 5100000,
      events: {
        create: [
          { fromState: null, toState: "NY", userId: pl.id },
          { fromState: "NY", toState: "PLANLAGT", note: "Direkte planlagt efter taksator.", userId: pl.id },
          { fromState: "PLANLAGT", toState: "I_GANG", userId: sofie.id },
          { fromState: "I_GANG", toState: "KLS", note: "El færdig. KLS i gang.", userId: sofie.id },
        ],
      },
      timeEntries: {
        create: [{ userId: sofie.id, hours: 12, hourlyRate: 51000, date: addDays(monday, -1), note: "Ny gruppe og komfurkreds" }],
      },
      materials: {
        create: [{ name: "Kabel, dåser og afbrydere", quantity: 1, unitPrice: 210000 }],
      },
    },
  });

  const elTemplate = createdTemplates.find((template) => template.trade === "ELEKTRIKER")!;
  await prisma.klsReport.create({
    data: {
      caseId: sag2.id,
      templateId: elTemplate.id,
      notes: "Gruppe 3 udskiftet. Komfurkreds testet.",
      checks: {
        create: elTemplate.items.map((item, index) => ({
          itemId: item.id,
          status: index < 4 ? "OK" : "PENDING",
        })),
      },
    },
  });

  const sag3 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0003",
      title: "Stormskade på tag",
      description: "Løse tagsten og indtrængende vand på loft efter stormen.",
      customerId: dam.id,
      addressId: dam.addresses[0].id,
      customerName: "Ole og Kirsten Dam",
      customerAddress: "Birkevej 7",
      customerPostal: "5000",
      customerCity: "Odense C",
      customerPhone: "23 88 10 55",
      insuranceCompany: "Alm. Brand",
      claimNumber: "AB-44190",
      state: "PLANLAGT",
      trade: "TAG",
      assignedToId: henrik.id,
      projectLeaderId: pl.id,
      scheduledStart: setHours(addDays(monday, 3), 7),
      scheduledEnd: setHours(addDays(monday, 4), 15),
      estimatedRevenue: 18700000,
      estimatedCost: 11200000,
      events: {
        create: [
          { fromState: null, toState: "NY", userId: pl.id },
          { fromState: "NY", toState: "BESIGTIGELSE", userId: pl.id },
          { fromState: "BESIGTIGELSE", toState: "PLANLAGT", note: "To dage hos Henrik.", userId: pl.id },
        ],
      },
    },
  });

  const sag4 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0004",
      title: "Rørskade i badeværelse",
      description: "Sprunget rør bag toilet. Gulv og vægge skal åbnes og retableres.",
      customerId: aalborg.id,
      addressId: aalborg.addresses[0].id,
      customerName: "Aalborg Boligselskab",
      customerAddress: "Vesterbro 14, st. tv",
      customerPostal: "9000",
      customerCity: "Aalborg",
      customerPhone: "98 12 40 00",
      insuranceCompany: "If",
      claimNumber: "IF-77821",
      state: "NY",
      trade: "VVS",
      projectLeaderId: pl.id,
      estimatedRevenue: 6400000,
      estimatedCost: 3900000,
      events: {
        create: [{ fromState: null, toState: "NY", note: "Afventer besigtigelse.", userId: pl.id }],
      },
    },
  });

  const sag5 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0005",
      title: "Fugt i kælder — rækkehus",
      description: "Opstigende grundfugt. Kældervægge renset, spærret og malet.",
      customerId: kragh.id,
      addressId: kragh.addresses[0].id,
      customerName: "Jens Kragh",
      customerAddress: "Amagerbrogade 152",
      customerPostal: "2300",
      customerCity: "København S",
      insuranceCompany: "Codan",
      claimNumber: "COD-33018",
      state: "FAKTURERET",
      trade: "MALER",
      assignedToId: anders.id,
      projectLeaderId: pl.id,
      scheduledStart: setHours(addDays(monday, -10), 8),
      scheduledEnd: setHours(addDays(monday, -8), 15),
      estimatedRevenue: 5400000,
      estimatedCost: 2800000,
      events: {
        create: [
          { fromState: null, toState: "NY", userId: pl.id },
          { fromState: "NY", toState: "I_GANG", userId: anders.id },
          { fromState: "I_GANG", toState: "KLS", userId: anders.id },
          { fromState: "KLS", toState: "KLAR_TIL_FAKTURA", userId: pl.id },
          { fromState: "KLAR_TIL_FAKTURA", toState: "FAKTURERET", note: "Faktura sendt til Codan.", userId: pl.id },
        ],
      },
      timeEntries: {
        create: [
          { userId: anders.id, hours: 16, hourlyRate: 43000, date: addDays(monday, -9), note: "Behandling og maling" },
        ],
      },
      materials: {
        create: [{ name: "Fugtspærre og kældermaling", quantity: 1, unitPrice: 98000 }],
      },
    },
  });

  const malerTemplate = createdTemplates.find((template) => template.trade === "MALER")!;
  await prisma.klsReport.create({
    data: {
      caseId: sag5.id,
      templateId: malerTemplate.id,
      signedById: anders.id,
      signedAt: addDays(monday, -7),
      notes: "Ingen afvigelser.",
      checks: {
        create: malerTemplate.items.map((item) => ({ itemId: item.id, status: "OK" })),
      },
    },
  });

  await prisma.invoice.create({
    data: {
      invoiceNumber: "FAK-2026-0001",
      caseId: sag5.id,
      customerId: kragh.id,
      createdById: pl.id,
      status: "SENDT",
      notes: "Forsikringssag COD-33018",
      issuedAt: addDays(monday, -6),
      dueAt: addDays(monday, 8),
      lines: {
        create: [
          { description: "Fugtsanering og malerarbejde, kælder", quantity: 1, unitPrice: 4200000 },
          { description: "Materialer", quantity: 1, unitPrice: 98000 },
        ],
      },
    },
  });

  const sag6 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0006",
      title: "Hagelskade på carport",
      description: "Haglnedslag i tagplader. Udskiftning og maling.",
      customerId: frost.id,
      addressId: frost.addresses[0].id,
      customerName: "Line Frost",
      customerAddress: "Helligkorsvej 9",
      customerPostal: "4000",
      customerCity: "Roskilde",
      insuranceCompany: "Tryg",
      claimNumber: "TRY-99102",
      state: "KLAR_TIL_FAKTURA",
      trade: "TOMRER",
      assignedToId: lars.id,
      projectLeaderId: pl.id,
      scheduledStart: setHours(addDays(monday, -4), 8),
      scheduledEnd: setHours(addDays(monday, -4), 16),
      estimatedRevenue: 3200000,
      estimatedCost: 1700000,
      events: {
        create: [
          { fromState: null, toState: "NY", userId: pl.id },
          { fromState: "NY", toState: "PLANLAGT", userId: pl.id },
          { fromState: "PLANLAGT", toState: "I_GANG", userId: lars.id },
          { fromState: "I_GANG", toState: "KLS", userId: lars.id },
          { fromState: "KLS", toState: "KLAR_TIL_FAKTURA", userId: pl.id },
        ],
      },
      timeEntries: {
        create: [{ userId: lars.id, hours: 6, hourlyRate: 46500, date: addDays(monday, -4), note: "Udskiftning tagplader" }],
      },
      materials: {
        create: [{ name: "Tagplader", quantity: 12, unitPrice: 18500 }],
      },
    },
  });

  const tomrerTemplate = createdTemplates.find((template) => template.trade === "TOMRER")!;
  await prisma.klsReport.create({
    data: {
      caseId: sag6.id,
      templateId: tomrerTemplate.id,
      signedById: lars.id,
      signedAt: addDays(monday, -3),
      notes: "Arbejde færdigt. Klar til faktura.",
      checks: {
        create: tomrerTemplate.items.map((item) => ({ itemId: item.id, status: "OK" })),
      },
    },
  });

  await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0007",
      title: "Pudsreparation efter påkørsel",
      description: "Hjørne af facade påkørt. Puds og sokkel repareres.",
      customerId: glostrup.id,
      addressId: glostrup.addresses[0].id,
      customerName: "Glostrup Ejendomme",
      customerAddress: "Hovedvejen 41",
      customerPostal: "2600",
      customerCity: "Glostrup",
      insuranceCompany: "Topdanmark",
      claimNumber: "TOP-22901",
      state: "BESIGTIGELSE",
      trade: "MURER",
      assignedToId: henrik.id,
      projectLeaderId: pl.id,
      scheduledStart: setHours(addDays(monday, 4), 9),
      scheduledEnd: addHours(setHours(addDays(monday, 4), 9), 2),
      estimatedRevenue: 2800000,
      estimatedCost: 1500000,
      events: {
        create: [
          { fromState: null, toState: "NY", userId: pl.id },
          { fromState: "NY", toState: "BESIGTIGELSE", note: "Henrik kører forbi fredag.", userId: pl.id },
        ],
      },
    },
  });

  await prisma.resourceBooking.create({
    data: {
      resourceId: lift.id,
      caseId: sag3.id,
      start: setHours(addDays(monday, 3), 7),
      end: setHours(addDays(monday, 4), 15),
      note: "Stormskade tag",
    },
  });
  await prisma.resourceBooking.create({
    data: {
      resourceId: van.id,
      caseId: sag1.id,
      start: setHours(addDays(monday, 0), 8),
      end: setHours(addDays(monday, 1), 15),
      note: "Lars — villa Hellerup",
    },
  });

  await prisma.setting.createMany({
    data: [
      { key: "company_name", value: "Exempo" },
      { key: "company_email", value: admin.email },
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

  await prisma.mailAccount.create({
    data: {
      name: "Faktura",
      address: "faktura@exempo.dk",
      purpose: "FAKTURA",
      smtpHost: "smtp.exempo.dk",
      imapHost: "imap.exempo.dk",
    },
  });

  await seedWholesalerAgreements(prisma);

  await prisma.purchase.create({
    data: {
      source: "SPROOM",
      externalId: "demo-stark-1",
      supplierName: "Stark A/S",
      supplierCvr: "17233541",
      invoiceNumber: "SI-10482",
      issuedAt: addDays(monday, 1),
      netAmount: 640000,
      vatAmount: 160000,
      grossAmount: 800000,
      status: "MODTAGET",
      lines: {
        create: [
          { description: "Konstruktionstræ C24", quantity: 24, unitPrice: 18500, amount: 444000 },
          { description: "Skruer og beslag", quantity: 1, unitPrice: 196000, amount: 196000 },
        ],
      },
    },
  });

  await prisma.purchase.create({
    data: {
      source: "MANUEL",
      externalId: "demo-ao-1",
      supplierName: "AO Johansen",
      supplierCvr: "58218717",
      invoiceNumber: "452901",
      issuedAt: addDays(monday, 2),
      netAmount: 248000,
      vatAmount: 62000,
      grossAmount: 310000,
      status: "AFVENTER",
      caseId: sag1.id,
      lines: {
        create: [{ description: "Gipsplader og spartel", quantity: 1, unitPrice: 248000, amount: 248000 }],
      },
    },
  });

  ensureDefaultTenant("Exempo");
  const demoUsers = await prisma.user.findMany({ select: { email: true } });
  for (const demoUser of demoUsers) registerLogin(demoUser.email, "exempo");

  console.log("Seeded Exempo with", {
    users: 6,
    cases: 7,
    admin: admin.email,
    pl: pl.email,
    sag1: sag1.caseNumber,
    sag3: sag3.caseNumber,
    sag4: sag4.caseNumber,
    quote: quote.quoteNumber,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
