import bcrypt from "bcryptjs";
import { addDays, addHours, setHours, startOfWeek } from "date-fns";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.klsCheck.deleteMany();
  await prisma.klsReport.deleteMany();
  await prisma.klsItem.deleteMany();
  await prisma.klsTemplate.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.material.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.document.deleteMany();
  await prisma.caseEvent.deleteMany();
  await prisma.case.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash("exempo123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "Mads-Emil Admin",
      email: "admin@exempo.dk",
      passwordHash,
      role: "ADMIN",
      trade: "ANDET",
      phone: "20 11 22 33",
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

  const templates = [
    {
      name: "KLS — Tømrer, skadesudbedring",
      trade: "TOMRER",
      items: [
        "Foto af skade før arbejde",
        "Afdækning af tilstødende flader",
        "Fugt/underlag kontrolleret",
        "Konstruktion genopbygget efter anvisning",
        "Dampspærre/membran tæt",
        "Overflade klar til næste fag",
        "Oprydning og spild fjernet",
        "Foto efter arbejde",
      ],
    },
    {
      name: "KLS — Murer, skadesudbedring",
      trade: "MURER",
      items: [
        "Foto af skade før arbejde",
        "Underlag bæredygtigt og rent",
        "Puds/mørtel blandet korrekt",
        "Fuger og overgange tætte",
        "Flader i vater og lod",
        "Afdækning i hærdningsperiode",
        "Oprydning",
        "Foto efter arbejde",
      ],
    },
    {
      name: "KLS — El-installation",
      trade: "ELEKTRIKER",
      items: [
        "Spændingsløs før indgreb",
        "Eksisterende installation kortlagt",
        "Nye føringer fastgjort og mærket",
        "Isolationstest udført",
        "Funktionstest af kredse",
        "Kapsling og afdækning genetableret",
        "Foto efter arbejde",
      ],
    },
    {
      name: "KLS — Maler",
      trade: "MALER",
      items: [
        "Underlag slibet og støvsuget",
        "Pletspartling udført",
        "Grunder påført",
        "Færdigmaling i aftalt glans",
        "Kanter dækker uden overlap",
        "Afdækning fjernet uden skader",
        "Foto efter arbejde",
      ],
    },
    {
      name: "KLS — Generel skadesag",
      trade: "ANDET",
      items: [
        "Kunde informeret om arbejdets omfang",
        "Foto før",
        "Sikkerhed og afdækning",
        "Arbejde udført efter beskrivelse",
        "Afvigelser noteret",
        "Foto efter",
        "Kunden har fået gennemgang",
      ],
    },
  ];

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

  const monday = startOfWeek(new Date("2026-09-21T08:00:00"), { weekStartsOn: 1 });

  const sag1 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0001",
      title: "Vandskade i køkken — villa",
      description:
        "Utæt opvaskemaskine har givet skade i sokkel, gulv og bagvæg. Forsikring har godkendt genopbygning.",
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
          { name: "Fugtspærre og underlag", quantity: 1, unitPrice: 420000 },
          { name: "Køkkenplade, eg", quantity: 1, unitPrice: 680000 },
        ],
      },
    },
  });

  const sag2 = await prisma.case.create({
    data: {
      caseNumber: "EX-2026-0002",
      title: "Brandskade i køkken — lejlighed",
      description: "Fedtbrand i emhætte. Fliser, el og malerarbejde skal genopbygges.",
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

  console.log("Seeded Exempo with", {
    users: 6,
    cases: 7,
    admin: admin.email,
    pl: pl.email,
    sag1: sag1.caseNumber,
    sag3: sag3.caseNumber,
    sag4: sag4.caseNumber,
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
