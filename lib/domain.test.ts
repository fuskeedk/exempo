import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canTransition, isTimeLocked } from "./fsm";
import { caseEconomics, quoteEconomics, rollupEconomics } from "./coverage";
import { minutesOnDay, overlapsDay, parseDayParam, shiftScheduleToDay, slotAtHour, startOfDay, timesheetHours } from "./dates";
import { danishPublicHolidays, easterSunday, holidayName } from "./holidays";

describe("FSM", () => {
  it("blocks skip from NY to faktura", () => {
    const result = canTransition("NY", "FAKTURERET");
    assert.equal(result.ok, false);
  });

  it("can close work without KLS", () => {
    const skip = canTransition("I_GANG", "KLAR_TIL_FAKTURA");
    assert.equal(skip.ok, true);
    const fromKls = canTransition("KLS", "KLAR_TIL_FAKTURA");
    assert.equal(fromKls.ok, true);
    const postpone = canTransition("I_GANG", "PLANLAGT");
    assert.equal(postpone.ok, true);
    const postponeKls = canTransition("KLS", "PLANLAGT");
    assert.equal(postponeKls.ok, true);
    const invoiceBlocked = canTransition("I_GANG", "FAKTURERET", { hasInvoice: false });
    assert.equal(invoiceBlocked.ok, false);
    const invoiced = canTransition("I_GANG", "FAKTURERET", { hasInvoice: true });
    assert.equal(invoiced.ok, true);
    const closeWork = canTransition("I_GANG", "AFSLUTTET", { allowCloseWithoutInvoice: true });
    assert.equal(closeWork.ok, true);
    const fromNew = canTransition("NY", "KLAR_TIL_FAKTURA");
    assert.equal(fromNew.ok, true);
    const reopen = canTransition("KLAR_TIL_FAKTURA", "I_GANG");
    assert.equal(reopen.ok, true);
    const reopenClosed = canTransition("AFSLUTTET", "I_GANG");
    assert.equal(reopenClosed.ok, true);
    assert.equal(isTimeLocked("KLAR_TIL_FAKTURA"), true);
    assert.equal(isTimeLocked("I_GANG"), false);
  });

  it("requires calendar assignment before PLANLAGT", () => {
    const blocked = canTransition("NY", "PLANLAGT", { isScheduled: false });
    assert.equal(blocked.ok, false);
  });
});

describe("dækningsgrad", () => {
  it("uses estimate until a sent invoice exists", () => {
    const economics = caseEconomics({
      estimatedRevenue: 100_000_00,
      invoices: [
        {
          status: "KLADDE",
          lines: [{ quantity: 1, unitPrice: 50_000_00 }],
        },
      ],
      timeEntries: [{ hours: 10, hourlyRate: 450_00 }],
      materials: [{ quantity: 1, unitPrice: 10_000_00 }],
    });
    assert.equal(economics.usingEstimate, true);
    assert.equal(economics.revenue, 100_000_00);
    assert.equal(economics.cost, 14_500_00);
    assert.equal(economics.coverage, (100_000_00 - 14_500_00) / 100_000_00);
  });

  it("uses material cost price when it is set", () => {
    const economics = caseEconomics({
      estimatedRevenue: 100_000_00,
      invoices: [],
      timeEntries: [],
      materials: [{ quantity: 2, unitPrice: 10_000_00, costPrice: 4_000_00 }],
    });
    assert.equal(economics.materialCost, 8_000_00);
    assert.equal(economics.cost, 8_000_00);
  });

  it("rolls up portfolio coverage", () => {
    const total = rollupEconomics([
      {
        revenue: 100,
        billed: 100,
        laborCost: 30,
        materialCost: 20,
        cost: 50,
        contribution: 50,
        coverage: 0.5,
        usingEstimate: false,
      },
      {
        revenue: 100,
        billed: 100,
        laborCost: 10,
        materialCost: 10,
        cost: 20,
        contribution: 80,
        coverage: 0.8,
        usingEstimate: false,
      },
    ]);
    assert.equal(total.coverage, 0.65);
  });
});

describe("tilbudskalkulation", () => {
  it("computes sale, cost and coverage from quote lines", () => {
    const totals = quoteEconomics([
      { quantity: 8, unitPrice: 595_00, costPrice: 280_00 },
      { quantity: 1, unitPrice: 4_200_00, costPrice: 2_100_00 },
    ]);
    assert.equal(totals.sale, 8_960_00);
    assert.equal(totals.cost, 4_340_00);
    assert.equal(totals.coverage, (8_960_00 - 4_340_00) / 8_960_00);
  });
});

describe("tilbudsmail", () => {
  it("builds a customer mail with approve link and no cost prices", async () => {
    const { buildQuoteEmail, isEmail } = await import("./quote-email");
    assert.equal(isEmail("kunde@bolig.dk"), true);
    assert.equal(isEmail("ikke-en-mail"), false);
    const mail = buildQuoteEmail({
      quoteNumber: "TIL-2026-0002",
      title: "Retablering",
      description: "Gulv og vægge",
      validUntil: new Date("2026-10-11"),
      customerName: "Hansen",
      address: { street: "Vesterbro 14", postal: "9000", city: "Aalborg" },
      lines: [{ description: "VVS-svend", quantity: 2, unitPrice: 595_00 }],
      companyName: "Nordbyg ApS",
      companyEmail: "tilbud@nordbyg.dk",
      approveUrl: "http://localhost:3000/t/exempo/abc",
    });
    assert.match(mail.subject, /TIL-2026-0002/);
    assert.match(mail.text, /http:\/\/localhost:3000\/t\/exempo\/abc/);
    assert.match(mail.html, /Se og godkend tilbud/);
    assert.match(mail.text, /Godkendt eller Nej tak/);
    assert.match(mail.html, /To måder at svare på/);
    assert.equal(mail.html.includes("kost"), false);
    const withLogo = buildQuoteEmail({
      ...{
        quoteNumber: "TIL-2026-0002",
        title: "Retablering",
        description: "Gulv og vægge",
        validUntil: new Date("2026-10-11"),
        customerName: "Hansen",
        address: { street: "Vesterbro 14", postal: "9000", city: "Aalborg" },
        lines: [{ description: "VVS-svend", quantity: 2, unitPrice: 595_00 }],
        companyName: "Nordbyg ApS",
        companyEmail: "tilbud@nordbyg.dk",
        approveUrl: "http://localhost:3000/t/exempo/abc",
      },
      logoUrl: "http://localhost:3000/api/firma-logo/exempo?v=1",
    });
    assert.match(withLogo.html, /api\/firma-logo\/exempo/);
  });
});

describe("testmail", () => {
  it("builds a test mail and refuses incomplete SMTP", async () => {
    const { buildMailTestMessage, mailProfileFromAccount } = await import("./mail");
    const mail = buildMailTestMessage({
      fromName: "Nordbyg ApS",
      fromEmail: "tilbud@nordbyg.dk",
      purposeLabel: "Tilbud",
    });
    assert.match(mail.subject, /Nordbyg ApS/);
    assert.match(mail.text, /tilbud@nordbyg\.dk/);
    assert.match(mail.html, /SMTP-opsætningen/);
    assert.equal(
      mailProfileFromAccount(
        {
          address: "tilbud@nordbyg.dk",
          name: "Tilbud",
          smtpHost: "",
          smtpPort: "587",
          smtpUser: "",
          smtpPassword: "",
          smtpEncryption: "tls",
          imapHost: "",
          imapPort: "993",
          imapUser: "",
          imapPassword: "",
          imapFolder: "INBOX",
        },
        "Nordbyg ApS",
      ),
      null,
    );
    const profile = mailProfileFromAccount(
      {
        address: "tilbud@nordbyg.dk",
        name: "Tilbud",
        smtpHost: "smtp.simply.com",
        smtpPort: "587",
        smtpUser: "tilbud@nordbyg.dk",
        smtpPassword: "secret",
        smtpEncryption: "tls",
        imapHost: "",
        imapPort: "993",
        imapUser: "",
        imapPassword: "",
        imapFolder: "INBOX",
      },
      "Nordbyg ApS",
    );
    assert.equal(profile?.fromEmail, "tilbud@nordbyg.dk");
    assert.equal(profile?.host, "smtp.simply.com");
  });

  it("keeps stored passwords when the edit form leaves them empty", async () => {
    const { parseMailAccountInput } = await import("./mail");
    const parsed = parseMailAccountInput(
      {
        name: "Faktura",
        address: "faktura@nordbyg.dk",
        purpose: "FAKTURA",
        smtpHost: "mail.nordbyg.dk",
        smtpPort: "587",
        smtpUser: "faktura@nordbyg.dk",
        smtpPassword: "",
        smtpEncryption: "tls",
        imapHost: "mail.nordbyg.dk",
        imapPort: "993",
        imapUser: "faktura@nordbyg.dk",
        imapPassword: "",
        imapFolder: "INBOX",
      },
      { smtpPassword: "keep-smtp", imapPassword: "keep-imap" },
    );
    if ("error" in parsed) throw new Error(parsed.error);
    assert.equal(parsed.data.smtpHost, "mail.nordbyg.dk");
    assert.equal(parsed.data.smtpPassword, "keep-smtp");
    assert.equal(parsed.data.imapPassword, "keep-imap");
  });

  it("sends via localhost when the public mail host is this server", async () => {
    const { shouldUseLocalMailSocket, isMailConnectRefused } = await import("./mail");
    assert.equal(shouldUseLocalMailSocket("127.0.0.1"), true);
    assert.equal(shouldUseLocalMailSocket("192.168.1.77", new Set(["127.0.0.1", "192.168.1.77"])), true);
    assert.equal(shouldUseLocalMailSocket("8.8.8.8", new Set(["127.0.0.1"])), false);
    assert.equal(isMailConnectRefused({ code: "ECONNREFUSED" }), true);
    assert.equal(isMailConnectRefused({ code: "EAUTH" }), false);
    assert.equal(isMailConnectRefused(new Error("connect ECONNREFUSED 87.61.246.41:587")), true);
  });
});

describe("firmalogo", () => {
  it("accepts png jpeg webp and rejects other types", async () => {
    const { logoExtension, companyLogoSrc } = await import("./logo");
    assert.equal(logoExtension("image/png", "a.PNG"), ".png");
    assert.equal(logoExtension("image/jpeg", "foto.jpg"), ".jpg");
    assert.equal(logoExtension("image/webp", "mark.webp"), ".webp");
    assert.equal(logoExtension("image/gif", "a.gif"), null);
    assert.equal(companyLogoSrc("exempo", ""), "");
    assert.equal(companyLogoSrc("exempo", "logo-1.png"), "/api/firma-logo/exempo?v=logo-1.png");
  });
});

describe("kalenderdage", () => {
  it("counts a job that spans midnight on both days", () => {
    const start = new Date("2026-09-14T08:00:00");
    const end = new Date("2026-09-15T15:00:00");
    assert.equal(overlapsDay(start, end, new Date("2026-09-14T12:00:00")), true);
    assert.equal(overlapsDay(start, end, new Date("2026-09-15T12:00:00")), true);
    assert.equal(overlapsDay(start, end, new Date("2026-09-16T12:00:00")), false);
    assert.equal(overlapsDay(start, end, new Date("2026-09-13T12:00:00")), false);
  });

  it("does not show unscheduled jobs on a day", () => {
    const start = new Date("2026-09-16T08:00:00");
    const end = new Date("2026-09-16T16:00:00");
    assert.equal(overlapsDay(start, end, startOfDay(new Date("2026-09-16T00:00:00"))), true);
    assert.equal(overlapsDay(start, end, startOfDay(new Date("2026-09-17T00:00:00"))), false);
  });

  it("parses dato-param as local calendar day", () => {
    const day = parseDayParam("2026-09-20");
    assert.equal(day.getFullYear(), 2026);
    assert.equal(day.getMonth(), 8);
    assert.equal(day.getDate(), 20);
    assert.equal(day.getHours(), 0);
  });

  it("shifts a booking to another day without changing duration", () => {
    const start = new Date("2026-09-21T08:00:00");
    const end = new Date("2026-09-22T15:00:00");
    const moved = shiftScheduleToDay(
      start,
      end,
      new Date("2026-09-21T12:00:00"),
      new Date("2026-09-23T12:00:00"),
    );
    assert.equal(moved.start.toISOString(), new Date("2026-09-23T08:00:00").toISOString());
    assert.equal(moved.end.toISOString(), new Date("2026-09-24T15:00:00").toISOString());
  });

  it("places a slot on a clock hour and stays inside 00:00–23:59", () => {
    const day = new Date("2026-09-20T12:00:00");
    const morning = slotAtHour(day, 0, 2 * 60 * 60 * 1000);
    assert.equal(morning.start.getHours(), 0);
    assert.equal(morning.start.getMinutes(), 0);
    assert.equal(morning.end.getHours(), 2);
    const late = slotAtHour(day, 23, 2 * 60 * 60 * 1000);
    assert.equal(late.start.getHours(), 23);
    assert.equal(late.end.getHours(), 23);
    assert.equal(late.end.getMinutes(), 59);
    assert.equal(minutesOnDay(new Date("2026-09-20T00:00:00"), day), 0);
    assert.equal(minutesOnDay(new Date("2026-09-20T23:59:00"), day), 23 * 60 + 59);
  });

  it("uses a 07:00–21:00 timesheet axis", () => {
    const hours = timesheetHours();
    assert.equal(hours[0], 7);
    assert.equal(hours[hours.length - 1], 21);
    assert.equal(hours.length, 15);
  });

  it("shows one day on a standing phone and the week when laid down", async () => {
    const { isMinDagSwipeLayout, shiftDayParam } = await import("./dates");
    assert.equal(isMinDagSwipeLayout(390, 844), true);
    assert.equal(isMinDagSwipeLayout(844, 390), false);
    assert.equal(isMinDagSwipeLayout(1280, 800), false);
    assert.equal(shiftDayParam("2026-09-21", 1), "2026-09-22");
    assert.equal(shiftDayParam("2026-09-21", -1), "2026-09-20");
  });

  it("counts a full workday as 7,5 hours after pause", async () => {
    const { looksLikeFullDay, FULL_DAY_HOURS, billedHours, fullDaySlot, parseDayParam } = await import("./dates");
    assert.equal(looksLikeFullDay(7, 0, 15, 0), true);
    assert.equal(looksLikeFullDay(7, 0, 14, 30), true);
    assert.equal(looksLikeFullDay(7, 15, 10, 0), false);
    assert.equal(FULL_DAY_HOURS, 7.5);
    const slot = fullDaySlot(parseDayParam("2026-09-14"));
    assert.equal(slot.start.getHours(), 7);
    assert.equal(slot.end.getHours(), 15);
    assert.equal((slot.end.getTime() - slot.start.getTime()) / 3_600_000, 8);
    assert.equal(billedHours(slot.start, slot.end), 7.5);
    const legacy = { start: new Date(slot.start), end: new Date(slot.start) };
    legacy.end.setHours(14, 30, 0, 0);
    assert.equal(billedHours(legacy.start, legacy.end), 7.5);
  });

  it("counts Friday Hel dag as 7 hours and a week as 37", async () => {
    const {
      billedHours,
      expectedHoursForDay,
      expectedHoursForDays,
      fullDaySlot,
      parseDayParam,
      WEEK_EXPECTED_HOURS,
      weekDays,
      weekStart,
    } = await import("./dates");
    const friday = parseDayParam("2026-09-18");
    assert.equal(friday.getDay(), 5);
    const slot = fullDaySlot(friday);
    assert.equal(slot.start.getHours(), 7);
    assert.equal(slot.end.getHours(), 14);
    assert.equal(slot.end.getMinutes(), 30);
    assert.equal(billedHours(slot.start, slot.end), 7);
    assert.equal(expectedHoursForDay(friday), 7);
    assert.equal(expectedHoursForDay(parseDayParam("2026-09-14")), 7.5);
    const week = weekDays(weekStart(parseDayParam("2026-09-14")));
    assert.equal(expectedHoursForDays(week), WEEK_EXPECTED_HOURS);
    assert.equal(WEEK_EXPECTED_HOURS, 37);
  });
});

describe("planlægning", () => {
  it("defaults to a work week Monday-Friday", async () => {
    const { parseScheduleView, schedulingDays, scheduleStatus } = await import("./scheduling");
    assert.equal(parseScheduleView(undefined), "arbejdsdag");
    const days = schedulingDays(new Date("2026-09-21T12:00:00"), "arbejdsdag");
    assert.equal(days.length, 5);
    assert.equal(days[0].getDate(), 21);
    assert.equal(days[4].getDate(), 25);
    const three = schedulingDays(new Date("2026-09-21T12:00:00"), "3");
    assert.equal(three.length, 3);
    assert.deepEqual(scheduleStatus("I_GANG", true), { work: "Igang", plan: "Planlagt" });
    assert.deepEqual(scheduleStatus("NY", false), { work: "Ny", plan: "Andet" });
  });
});

describe("helligdage", () => {
  it("computes Easter Sunday 2026", () => {
    const easter = easterSunday(2026);
    assert.equal(easter.getFullYear(), 2026);
    assert.equal(easter.getMonth(), 3);
    assert.equal(easter.getDate(), 5);
  });

  it("marks Danish public holidays in 2026", () => {
    const holidays = danishPublicHolidays(2026);
    assert.equal(holidays["2026-01-01"], "Nytårsdag");
    assert.equal(holidays["2026-04-02"], "Skærtorsdag");
    assert.equal(holidays["2026-04-03"], "Langfredag");
    assert.equal(holidays["2026-04-05"], "Påskedag");
    assert.equal(holidays["2026-04-06"], "2. påskedag");
    assert.equal(holidays["2026-05-14"], "Kristi himmelfart");
    assert.equal(holidays["2026-05-24"], "Pinsedag");
    assert.equal(holidays["2026-05-25"], "2. pinsedag");
    assert.equal(holidays["2026-06-05"], "Grundlovsdag");
    assert.equal(holidays["2026-12-25"], "Juledag");
    assert.equal(holidayName("2026-09-20"), null);
  });
});

describe("arbejdsseddel", () => {
  it("maps FSM states onto Minuba chevrons", async () => {
    const { workOrderStage, workOrderStageIndex, workOrderStageTone, workOrderHours, workOrderMarkup } =
      await import("./workorder");
    assert.equal(workOrderStage("PLANLAGT"), "ordre");
    assert.equal(workOrderStage("I_GANG"), "igang");
    assert.equal(workOrderStage("KLAR_TIL_FAKTURA"), "faktura");
    assert.equal(workOrderStage("FAKTURERET"), "faktura");
    assert.equal(workOrderStageIndex("I_GANG"), 1);
    assert.equal(workOrderStageIndex("KLAR_TIL_FAKTURA"), 2);
    assert.equal(workOrderStageTone(0, 1), "done");
    assert.equal(workOrderStageTone(1, 1), "current");
    assert.equal(workOrderStageTone(2, 1), "todo");
    assert.equal(workOrderHours([{ hours: 8.25 }, { hours: 8.25 }]), 16.5);
    assert.equal(workOrderMarkup(100, 125), 0.25);
    const { parseMarkupInput, saleFromMarkup, markupInputValue, materialPricePatch } = await import("./workorder");
    assert.equal(parseMarkupInput("25"), 0.25);
    assert.equal(parseMarkupInput("25 %"), 0.25);
    assert.equal(parseMarkupInput("-100"), -1);
    assert.equal(saleFromMarkup(10120, 0.25), 12650);
    assert.equal(workOrderMarkup(10120, 0), -1);
    assert.equal(markupInputValue(-1), "-100");
    assert.equal(markupInputValue(0.25), "25");
    assert.deepEqual(materialPricePatch({ costPrice: 0, unitPrice: 0 }, { costPrice: "101,20" }), {
      costPrice: 10120,
      unitPrice: 0,
    });
    assert.deepEqual(materialPricePatch({ costPrice: 10120, unitPrice: 0 }, { markup: "25" }), {
      costPrice: 10120,
      unitPrice: 12650,
    });
    assert.deepEqual(materialPricePatch({ costPrice: 10120, unitPrice: 12650 }, { unitPrice: "150" }), {
      costPrice: 10120,
      unitPrice: 15000,
    });
  });

  it("uses Minuba Igang actions Udsæt, Færdigmeld and Afslut", async () => {
    const { workOrderIgangActions } = await import("./workorder");
    const { allowedTransitions } = await import("./fsm");
    assert.deepEqual(
      workOrderIgangActions("I_GANG", allowedTransitions("I_GANG")).map((action) => action.label),
      ["Udsæt", "Færdigmeld", "Afslut"],
    );
    assert.deepEqual(
      workOrderIgangActions("KLS", allowedTransitions("KLS")).map((action) => action.label),
      ["Udsæt", "Færdigmeld", "Afslut"],
    );
    assert.deepEqual(
      workOrderIgangActions("NY", allowedTransitions("NY")).map((action) => action.label),
      ["Færdigmeld", "Afslut"],
    );
  });

  it("only lists future planned hours for a case", async () => {
    const { futurePlannedSlots, workOrderShortcuts } = await import("./workorder");
    const { formatCompactDate } = await import("./dates");
    const now = new Date("2026-09-21T12:00:00");
    const lars = { id: "u1", name: "Lars Holm" };
    const none = futurePlannedSlots({
      now,
      caseId: "c1",
      assignedTo: lars,
      scheduledStart: new Date("2026-09-20T08:00:00"),
      scheduledEnd: new Date("2026-09-20T16:00:00"),
      activities: [],
    });
    assert.equal(none.length, 0);
    assert.equal(
      workOrderShortcuts(false).some((item) => item.href === "#planlagte-timer"),
      false,
    );

    const unassigned = futurePlannedSlots({
      now,
      caseId: "c1",
      assignedTo: null,
      scheduledStart: new Date("2026-09-23T08:00:00"),
      scheduledEnd: new Date("2026-09-23T16:00:00"),
      activities: [],
    });
    assert.equal(unassigned.length, 0);

    const slots = futurePlannedSlots({
      now,
      caseId: "c1",
      assignedTo: lars,
      scheduledStart: new Date("2026-09-23T08:00:00"),
      scheduledEnd: new Date("2026-09-23T16:00:00"),
      activities: [
        {
          id: "a1",
          userId: lars.id,
          userName: lars.name,
          start: new Date("2026-09-23T08:00:00"),
          end: new Date("2026-09-23T16:00:00"),
          status: "PLANLAGT",
          kind: "ARBEJDE",
          caseId: "c1",
        },
        {
          id: "a2",
          userId: lars.id,
          userName: lars.name,
          start: new Date("2026-09-25T08:00:00"),
          end: new Date("2026-09-25T16:00:00"),
          status: "PLANLAGT",
          kind: "ARBEJDE",
          caseId: "c1",
        },
        {
          id: "a3",
          userId: lars.id,
          userName: lars.name,
          start: new Date("2026-09-18T08:00:00"),
          end: new Date("2026-09-18T16:00:00"),
          status: "PLANLAGT",
          kind: "ARBEJDE",
          caseId: "c1",
        },
        {
          id: "a4",
          userId: lars.id,
          userName: lars.name,
          start: new Date("2026-09-26T08:00:00"),
          end: new Date("2026-09-26T16:00:00"),
          status: "REGISTRERET",
          kind: "ARBEJDE",
          caseId: "c1",
        },
      ],
    });
    assert.deepEqual(
      slots.map((slot) => formatCompactDate(slot.start)),
      ["23/9", "25/9"],
    );
    assert.equal(workOrderShortcuts(true).some((item) => item.href === "#planlagte-timer"), true);
  });
});

describe("indkøb", () => {
  it("maps Minuba inbox tabs and order references", async () => {
    const {
      parsePurchaseTab,
      purchaseInboxCopy,
      purchaseOrderReference,
      purchaseRoleTag,
      purchaseStatusWhere,
    } = await import("./purchases");
    assert.equal(parsePurchaseTab(undefined), "indkomne");
    assert.equal(parsePurchaseTab("afventer"), "afventer");
    assert.deepEqual(purchaseStatusWhere("indkomne"), { status: "MODTAGET" });
    assert.equal(purchaseStatusWhere("rekvisitioner"), null);
    assert.equal(purchaseInboxCopy("indkomne").title, "Indkomne indkøbsfakturaer til godkendelse");
    assert.equal(purchaseRoleTag("PL"), "PL");
    assert.equal(
      purchaseOrderReference({
        case: { caseNumber: "44222", customerAddress: "RØRBJERG 30", customerCity: "" },
      }),
      "44222/RØRBJERG 30",
    );
  });

  it("parses PDF/XML invoices, lines and sag-match", async () => {
    const {
      extractOrderReference,
      matchPurchaseCase,
      mergeParsedInvoices,
      moneyToOre,
      parseInvoiceText,
      parseInvoiceXml,
    } = await import("./invoice-parse");
    const simple = parseInvoiceText(`
FAKTURANUMMER                2026-0002
FAKTURADATO                  24. maj 2026
BESKRIVELSE              ANTAL         PRIS           SUM
Fejlsøgning              1             DKK 5.000,00   DKK 5.000,00
SUBTOTAL                     DKK 5.000,00
MOMS (25%)                   DKK 1.250,00
TOTAL                        DKK 6.250,00
`);
    assert.equal(simple.invoiceNumber, "2026-0002");
    assert.equal(simple.grossAmount, 625000);
    assert.equal(simple.lines[0]?.description, "Fejlsøgning");
    assert.equal(simple.lines[0]?.amount, 500000);

    const ao = parseInvoiceText(`
FAKTURA 22433426
CVR-nr. 58210617
Kundens ordre 0042079/Bækkeskov stræde
SKRUE UNDERSÆNKET 4X60                                 1072       20           9,25               185,00 45,25                     101,29
STIKKONT +S 2-P U/JORD 1,5M HV                         6310        1          51,00 K              51,00                            51,00
Ordretotal 946,79                                                                                                    25,00             236,70                1.183,49
Forfaldsdato: 200626
`);
    assert.equal(ao.invoiceNumber, "22433426");
    assert.equal(ao.supplierName, "AO");
    assert.equal(ao.grossAmount, 118349);
    assert.equal(ao.netAmount, 94679);
    assert.equal(ao.lines[0]?.description, "SKRUE UNDERSÆNKET 4X60");
    assert.equal(ao.lines[0]?.quantity, 20);
    assert.equal(ao.lines[1]?.description, "STIKKONT +S 2-P U/JORD 1,5M HV");
    assert.equal(ao.lines[1]?.quantity, 1);
    assert.equal(ao.lines.length, 2);
    assert.ok(!ao.lines.some((line) => line.quantity === 185 || line.description.includes(",79")));
    assert.equal(extractOrderReference(ao.text), "0042079/Bækkeskov stræde");

    const mashed = parseInvoiceText(`
FAKTURA 22433426
CVR-nr. 58210617
SKRUE UNDERSÆNKET 4X60                                 1072       20           9,25               185,00 45,25                     101,29
AFSTANDSRING 6-26MM F/PL DÅSE                          1019       10          19,75               197,50  0,00                     197,50
SKRUE UNDERSÆNKET 4X60 1072 20 9,25 185 9,25 185,00
AFSTANDSRING 6-26MM F/PL DÅSE 1019 10 19,75 197,5 19,75 197,50
,79                                                                                                    25,00             236,70                1.183,49
Ordretotal 946,79                                                                                                    25,00             236,70                1.183,49
`);
    assert.equal(mashed.lines.length, 2);
    assert.equal(mashed.lines[0]?.quantity, 20);
    assert.equal(mashed.lines[1]?.quantity, 10);
    assert.ok(!mashed.lines.some((line) => line.quantity >= 185 || /^[,.\d\s]+$/.test(line.description)));

    const merged = mergeParsedInvoices([
      mashed,
      parseInvoiceText(`
SKRUE UNDERSÆNKET 4X60 1072 20 9,25 185 9,25 185,00
,79 25,00 236,70 1.183,49
`),
    ]);
    assert.equal(merged.lines.length, 2);
    assert.equal(merged.lines[0]?.quantity, 20);

    const pack = parseInvoiceText(`
Følgeseddel
Reference                0037348/Poppelvænget
50           Æske               1917990273        FORFRADÅSE 1,5 MODUL LYSGUL             14 STK    14 STK
`);
    assert.equal(pack.orderReference, "0037348/Poppelvænget");
    assert.equal(pack.lines[0]?.quantity, 14);
    assert.match(pack.lines[0]?.description ?? "", /FORFRADÅSE/);

    const xml = parseInvoiceXml(`<Invoice xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2">
      <cbc:ID>INV-9</cbc:ID>
      <cbc:IssueDate>2026-05-22</cbc:IssueDate>
      <cbc:BuyerReference>EX-2026-0009</cbc:BuyerReference>
      <cac:AccountingSupplierParty><cac:Party><cac:PartyLegalEntity>
        <cbc:RegistrationName>Solar A/S</cbc:RegistrationName>
        <cbc:CompanyID>12345678</cbc:CompanyID>
      </cac:PartyLegalEntity></cac:Party></cac:AccountingSupplierParty>
      <cac:LegalMonetaryTotal>
        <cbc:TaxExclusiveAmount>100.00</cbc:TaxExclusiveAmount>
        <cbc:TaxInclusiveAmount>125.00</cbc:TaxInclusiveAmount>
        <cbc:PayableAmount>125.00</cbc:PayableAmount>
      </cac:LegalMonetaryTotal>
      <cac:TaxTotal><cbc:TaxAmount>25.00</cbc:TaxAmount></cac:TaxTotal>
      <cac:InvoiceLine>
        <cbc:InvoicedQuantity>2</cbc:InvoicedQuantity>
        <cbc:LineExtensionAmount>100.00</cbc:LineExtensionAmount>
        <cac:Item><cbc:Name>Kabel</cbc:Name></cac:Item>
        <cac:Price><cbc:PriceAmount>50.00</cbc:PriceAmount></cac:Price>
      </cac:InvoiceLine>
    </Invoice>`);
    assert.equal(xml.supplierName, "Solar A/S");
    assert.equal(xml.grossAmount, 12500);
    assert.equal(xml.lines[0]?.quantity, 2);
    assert.equal(moneyToOre("1.183,49"), 118349);

    const cases = [
      { id: "a", caseNumber: "EX-2026-0009", title: "Ladeboks", customerAddress: "Poppelvænget 12", customerCity: "Næstved" },
      { id: "b", caseNumber: "00001", title: "Ladestander", customerAddress: "Bækkeskov stræde 3", customerCity: "Næstved" },
      { id: "c", caseNumber: "0037348", title: "Stik", customerAddress: "Poppelvænget 8", customerCity: "Køge" },
    ];
    assert.equal(matchPurchaseCase("Sag EX-2026-0009", cases)?.id, "a");
    assert.equal(matchPurchaseCase("Reference 0037348/Poppelvænget", cases)?.id, "c");
    assert.equal(matchPurchaseCase("Kundens ordre 00001/Bækkeskov stræde", cases)?.id, "b");
    assert.equal(matchPurchaseCase("Faktura 22433426 uden sag", cases, { invoiceNumber: "22433426" }), null);
    assert.equal(matchPurchaseCase("CVR-nr.: 0000001\nFAKTURANUMMER 2026-0002", cases, { invoiceNumber: "2026-0002" }), null);
  });
});

describe("AO-katalog", () => {
  it("maps QuickSearch and exact item lookups and ignores excluded wholesalers", async () => {
    const { aoSearchEnabled, isAoWholesaler, lookupAoProduct, searchAoCatalog } = await import("./ao-catalog");
    assert.equal(isAoWholesaler({ name: "AO Johansen" }), true);
    assert.equal(isAoWholesaler({ name: "AO Johansen", excludedFromSearch: true }), false);
    assert.equal(isAoWholesaler({ name: "STARK" }), false);
    assert.equal(aoSearchEnabled([{ name: "AO Johansen", excludedFromSearch: false }]), true);

    const fetchImpl = async (input: string | URL) => {
      const url = String(input);
      if (url.includes("GetSingleItemData") && url.includes("1039003679")) {
        return new Response(
          JSON.stringify({
            Varenr: "1039003679",
            Name: "SKRUE UNDERSÆNKET 4X60",
            EAN: "5703302001779",
            MeasuringUnit: "STK",
            Url: "/skrue-undersaenket-4x60-1039003679",
            ImageUrlMedium: "https://cdn.example/skrue.jpg",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.includes("QuickSearch") && url.includes("FUGA")) {
        assert.match(url, /[?&]a=/);
        return new Response(
          JSON.stringify({
            Count: 1,
            Produkter: [
              {
                Varenr: "1017060498",
                Name: "Fuga Stikkontakt med sidejord, 1,5M, hvid",
                EAN: "5703302166478|15703302166477",
                Maalingsenhed: "STK",
                Url: "/fuga-stikk-sidejord-15m-hv-1017060498",
                ImageUrlMedium: "https://cdn.example/fuga.jpg",
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ Produkter: [] }), { status: 200 });
    };

    const exact = await lookupAoProduct("1039003679", { fetch: fetchImpl });
    assert.equal(exact?.name, "SKRUE UNDERSÆNKET 4X60");
    assert.equal(exact?.barcode, "5703302001779");
    assert.equal(exact?.imageUrl, "https://cdn.example/skrue.jpg");

    const hits = await searchAoCatalog("FUGA", { fetch: fetchImpl });
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.sku, "1017060498");
    assert.equal(hits[0]?.barcode, "5703302166478");
    assert.equal(hits[0]?.imageUrl, "https://cdn.example/fuga.jpg");

    const bySku = await searchAoCatalog("1039003679", { fetch: fetchImpl });
    assert.equal(bySku[0]?.sku, "1039003679");
  });
});

describe("omsætning", () => {
  it("uses the first of the month 11 months back for seneste 12 mdr.", async () => {
    const { revenueRange, revenueMonths, aggregateRevenue } = await import("./revenue");
    const range = revenueRange("12m", undefined, undefined, new Date(2026, 8, 20));
    assert.equal(range.start.getFullYear(), 2025);
    assert.equal(range.start.getMonth(), 9);
    assert.equal(range.start.getDate(), 1);
    assert.equal(revenueMonths(range.start, range.end).length, 12);
  });

  it("splits billed, cashflow and costs by month and treats credit notes as negative", async () => {
    const { aggregateRevenue } = await import("./revenue");
    const start = new Date(2026, 8, 1);
    const end = new Date(2026, 8, 30, 23, 59, 59, 999);
    const totals = aggregateRevenue({
      start,
      end,
      invoices: [
        {
          status: "SENDT",
          kind: "FAKTURA",
          issuedAt: new Date(2026, 8, 8),
          paidAt: null,
          net: 42_980_00,
        },
        {
          status: "BETALT",
          kind: "FAKTURA",
          issuedAt: new Date(2026, 8, 10),
          paidAt: new Date(2026, 8, 18),
          net: 8_000_00,
        },
        {
          status: "SENDT",
          kind: "KREDITNOTA",
          issuedAt: new Date(2026, 8, 12),
          paidAt: null,
          net: -1_000_00,
        },
        {
          status: "KLADDE",
          kind: "FAKTURA",
          issuedAt: new Date(2026, 8, 12),
          paidAt: null,
          net: 99_000_00,
        },
      ],
      costs: [{ date: new Date(2026, 8, 9), amount: 5_000_00 }],
      unrelated: [{ date: new Date(2026, 8, 11), amount: 640_00 }],
    });
    assert.equal(totals.invoiced, 49_980_00);
    assert.equal(totals.cashflow, 8_000_00);
    assert.equal(totals.costs, 5_000_00);
    assert.equal(totals.contribution, 44_980_00);
    assert.equal(totals.unrelated, 640_00);
    assert.equal(totals.months[0].invoices, 49_980_00);
    assert.equal(totals.months[0].cashflow, 8_000_00);
  });
});

describe("faktura", () => {
  it("labels aconto and credit notes for the customer document", async () => {
    const { invoiceDocumentTitle, isInvoiceKind } = await import("./catalog");
    assert.equal(invoiceDocumentTitle("FAKTURA"), "Faktura");
    assert.equal(invoiceDocumentTitle("ACONTO"), "Acontofaktura");
    assert.equal(invoiceDocumentTitle("KREDITNOTA"), "Kreditnota");
    assert.equal(isInvoiceKind("ACONTO"), true);
  });

  it("only lets drafts be deleted", async () => {
    const { canDeleteInvoice } = await import("./catalog");
    assert.equal(canDeleteInvoice("KLADDE"), true);
    assert.equal(canDeleteInvoice("SENDT"), false);
    assert.equal(canDeleteInvoice("BETALT"), false);
  });

  it("only lets cases without sent invoices be deleted", async () => {
    const { canDeleteCase } = await import("./catalog");
    assert.equal(canDeleteCase([]), true);
    assert.equal(canDeleteCase([{ status: "KLADDE" }]), true);
    assert.equal(canDeleteCase([{ status: "SENDT" }]), false);
    assert.equal(canDeleteCase([{ status: "KLADDE" }, { status: "BETALT" }]), false);
  });

  it("offers remaining order amount as slutfaktura", async () => {
    const { composeInvoiceOffer } = await import("./coverage");
    const offer = composeInvoiceOffer({
      caseNumber: "EX-2026-0009",
      title: "Montering af Ladeboks",
      estimatedRevenue: 28_100_00,
      pricingMode: "FAST_PRIS",
      invoices: [{ status: "SENDT", lines: [{ quantity: 1, unitPrice: 8_100_00 }] }],
      timeEntries: [],
      materials: [],
      extras: [],
    });
    assert.equal(offer.remaining, 20_000_00);
    assert.equal(offer.label, "EX-2026-0009: Montering af Ladeboks");
    assert.equal(offer.lines[0].unitPrice, 20_000_00);
  });
});

describe("sagsnumre", () => {
  it("can be digits only", async () => {
    const { formatSerial, slugifyCompany, isValidSlug } = await import("./serial");
    assert.equal(
      formatSerial({ prefix: "", includeYear: false, digits: 5, n: 1, year: 2026 }),
      "00001",
    );
    assert.equal(
      formatSerial({ prefix: "EX", includeYear: true, digits: 4, n: 7, year: 2026 }),
      "EX-2026-0007",
    );
    assert.equal(slugifyCompany("Blåbyg ApS"), "blaabyg-aps");
    assert.equal(slugifyCompany("Nordjyllands El Teknik"), "nordjyllands-el-teknik");
    assert.equal(isValidSlug("nordbyg"), true);
    assert.equal(isValidSlug("EX 1"), false);
  });
});

describe("timeseddel dubletter", () => {
  it("counts identical registered slots once", async () => {
    const { uniqueTimesheetJobs, uniqueTimeEntries, hoursFromActivities } = await import("./timesheets");
    const start = "2026-09-28T05:15:00.000Z";
    const end = "2026-09-28T13:45:00.000Z";
    assert.equal(
      uniqueTimesheetJobs([
        { id: "a", scheduledStart: start, scheduledEnd: end, source: "activity" },
        { id: "b", scheduledStart: start, scheduledEnd: end, source: "activity" },
      ]).length,
      1,
    );
    assert.equal(
      uniqueTimeEntries([
        { date: new Date(2026, 8, 28), hours: 8.5, caseId: null },
        { date: new Date(2026, 8, 28), hours: 8.5, caseId: null },
      ]).length,
      1,
    );
    const days = hoursFromActivities([
      { start: new Date(2026, 8, 28, 7, 15), end: new Date(2026, 8, 28, 15, 45), allDay: false, caseId: null },
      { start: new Date(2026, 8, 28, 7, 15), end: new Date(2026, 8, 28, 15, 45), allDay: false, caseId: null },
    ]);
    assert.equal(days[0]?.hours, 8.5);
  });
});

describe("planlagt vs registreret tid", () => {
  it("hides planned case hours once the same day is registered", async () => {
    const { isPlannedCoveredByRegistered, registeredCaseDays, isPlannedSlotCovered } = await import("./calendar-query");
    const tuesday = startOfDay(new Date(2026, 8, 15));
    const registered = registeredCaseDays([
      { caseId: "ex-0008", status: "REGISTRERET", start: new Date(2026, 8, 15, 7, 0) },
    ]);
    assert.equal(isPlannedCoveredByRegistered("ex-0008", tuesday, registered), true);
    assert.equal(isPlannedCoveredByRegistered("ex-0008", startOfDay(new Date(2026, 8, 14)), registered), false);
    assert.equal(isPlannedCoveredByRegistered("other", tuesday, registered), false);
    assert.equal(
      isPlannedSlotCovered(
        {
          status: "PLANLAGT",
          caseId: null,
          kind: "ARBEJDE",
          start: new Date(2026, 8, 28, 7, 15),
          end: new Date(2026, 8, 28, 15, 45),
        },
        [
          {
            status: "REGISTRERET",
            caseId: null,
            kind: "ARBEJDE",
            start: new Date(2026, 8, 28, 7, 15),
            end: new Date(2026, 8, 28, 15, 45),
          },
        ],
      ),
      true,
    );
  });
});

describe("medarbejdere", () => {
  it("deactivates leavers and only deletes accounts without payroll history", async () => {
    const { employeeStatusReason } = await import("./employees");
    assert.equal(
      employeeStatusReason({
        isSelf: true,
        isActiveAdmin: false,
        remainingActiveAdmins: 1,
        timeEntries: 0,
        invoices: 0,
        timesheets: 0,
        action: "deactivate",
      }),
      "Du kan ikke ændre din egen konto her.",
    );
    assert.equal(
      employeeStatusReason({
        isSelf: false,
        isActiveAdmin: true,
        remainingActiveAdmins: 0,
        timeEntries: 0,
        invoices: 0,
        timesheets: 0,
        action: "deactivate",
      }),
      "Du kan ikke deaktivere den sidste administrator.",
    );
    assert.equal(
      employeeStatusReason({
        isSelf: false,
        isActiveAdmin: false,
        remainingActiveAdmins: 1,
        timeEntries: 4,
        invoices: 0,
        timesheets: 1,
        action: "delete",
      }),
      "Medarbejderen har tid eller faktura på sig og kan ikke slettes. Deaktivér i stedet, så historikken bevares.",
    );
    assert.equal(
      employeeStatusReason({
        isSelf: false,
        isActiveAdmin: false,
        remainingActiveAdmins: 1,
        timeEntries: 0,
        invoices: 0,
        timesheets: 0,
        action: "delete",
      }),
      null,
    );
  });
});

describe("rundvisning", () => {
  it("walks office users through the full order flow", async () => {
    const { tourSteps, tourSettingKey, isTourCompleted, pathMatchesTour } = await import("./tour");
    const office = tourSteps("ADMIN", "Nordbyg ApS", "Alex");
    assert.equal(office[0].id, "welcome");
    assert.ok(office.some((step) => step.href === "/kalender"));
    assert.ok(office.some((step) => step.href === "/fakturaer"));
    assert.ok(office.some((step) => step.openCreate));
    const field = tourSteps("MEDARBEJDER", "Nordbyg ApS", "Lars");
    assert.equal(
      field.some((step) => step.href === "/kalender" || step.href === "/fakturaer"),
      false,
    );
    assert.equal(tourSettingKey("user-1"), "tour_seen_user-1");
    assert.equal(isTourCompleted({ tour_seen_user_1: "1" }, "user-1"), false);
    assert.equal(isTourCompleted({ "tour_seen_user-1": "1" }, "user-1"), true);
    assert.equal(pathMatchesTour("/", "/", true), true);
    assert.equal(pathMatchesTour("/sager/abc", "/sager"), true);
    assert.equal(pathMatchesTour("/min-dag", "/sager"), false);
  });
});

describe("fag", () => {
  it("lists Administration for employees but not for cases", async () => {
    const { TRADE_LABELS, CASE_TRADES, isTrade } = await import("./catalog");
    assert.equal(TRADE_LABELS.ADMINISTRATION, "Administration");
    assert.equal(isTrade("ADMINISTRATION"), true);
    assert.equal(
      (CASE_TRADES as readonly string[]).includes("ADMINISTRATION"),
      false,
    );
    assert.equal(CASE_TRADES.includes("ANDET"), true);
  });
});

describe("løn og overenskomst", () => {
  it("splits overtime after the expected workday and pays apprentice steps", async () => {
    const { splitOvertime, resolveWageOre, calculatePayroll, templateByCode, apprenticeStepFromStart, sickPayOre, splitPaidAbsence } =
      await import("./agreements");
    const { expectedHoursForDay } = await import("./dates");
    const monday = new Date(2026, 8, 21);
    const friday = new Date(2026, 8, 25);
    const saturday = new Date(2026, 8, 26);
    const split = splitOvertime(
      [
        { date: monday, hours: 10 },
        { date: friday, hours: 9 },
        { date: saturday, hours: 4 },
      ],
      expectedHoursForDay,
      3,
    );
    assert.equal(split.normalHours, 14.5);
    assert.equal(split.overtime50Hours, 4.5);
    assert.equal(split.overtime100Hours, 4);
    const el = templateByCode("EL");
    assert.equal(resolveWageOre({ wageRate: 0, hourlyRate: 25000, apprenticeStep: 3, apprentices: el.apprentices }), 10645);
    assert.equal(resolveWageOre({ wageRate: 22000, hourlyRate: 25000, apprenticeStep: 3, apprentices: el.apprentices }), 22000);
    const start = new Date(2024, 7, 1);
    assert.equal(apprenticeStepFromStart(start, new Date(2026, 8, 21), 5), 3);
    const pay = calculatePayroll({
      rates: templateByCode("NONE"),
      wageOre: 20000,
      normalHours: 7.5,
      overtime50Hours: 0,
      overtime100Hours: 0,
    });
    assert.equal(pay.normalOre, 150000);
    assert.equal(pay.holidayPayOre, 18750);
    assert.equal(pay.pensionEmployerOre, 0);
    assert.equal(sickPayOre(7.5, 20000, 100), 150000);
    assert.equal(sickPayOre(7.5, 20000, 90), 135000);
    assert.equal(sickPayOre(7.5, 20000, 0), 0);
    const absence = splitPaidAbsence([
      { type: "SYG", hours: 7.5 },
      { type: "BARNSYG", hours: 7.4 },
      { type: "FERIE", hours: 7.4 },
    ]);
    assert.equal(absence.sickHours, 7.5);
    assert.equal(absence.childSickHours, 7.4);
    assert.equal(absence.unpaidHours, 7.4);
    assert.equal(el.sickPayPct, 100);
    const sickPay = calculatePayroll({
      rates: { ...el, sickPayPct: 90, childSickPayPct: 100 },
      wageOre: 20000,
      normalHours: 0,
      overtime50Hours: 0,
      overtime100Hours: 0,
      sickHours: 7.5,
      childSickHours: 7.4,
    });
    assert.equal(sickPay.normalOre, 0);
    assert.equal(sickPay.sickOre, 135000 + 148000);
    assert.equal(sickPay.grossOre, 283000);
    const salaried = calculatePayroll({
      rates: el,
      wageOre: 3800000,
      normalHours: 0,
      overtime50Hours: 8,
      overtime100Hours: 4,
      sickHours: 7.5,
      payType: "FUNKTIONAER",
      salariedOre: 3800000,
    });
    assert.equal(salaried.normalOre, 3800000);
    assert.equal(salaried.overtimeOre, 0);
    assert.equal(salaried.sickOre, 0);
    assert.equal(salaried.holidayPayOre, 0);
    assert.equal(salaried.pensionEmployerOre, Math.round(3800000 * 0.11));
    assert.equal(salaried.grossOre, 3800000);
  });
});

describe("funktionær månedsløn", () => {
  it("prorates salary on short periods and lets salaried timesheets submit without hours", async () => {
    const { monthlyHoursFromWeek, salariedPayOre, isSalaried } = await import("./employees");
    const { timesheetBillableHours } = await import("./timesheet-preview");
    assert.equal(isSalaried("FUNKTIONAER"), true);
    assert.equal(isSalaried("TIMER"), false);
    assert.equal(Math.round(monthlyHoursFromWeek(37) * 100) / 100, 160.33);
    assert.equal(salariedPayOre(3_800_000, 37, 37), Math.round(3_800_000 * (12 / 52)));
    assert.equal(salariedPayOre(3_800_000, 0, 37), 3_800_000);
    assert.equal(
      timesheetBillableHours({
        payType: "FUNKTIONAER",
        normalOre: 3_800_000,
        normalHours: 0,
        overtime50Hours: 0,
        overtime100Hours: 0,
        paidAbsenceHours: 0,
      }),
      1,
    );
    assert.equal(
      timesheetBillableHours({
        payType: "TIMER",
        normalOre: 0,
        normalHours: 0,
        overtime50Hours: 0,
        overtime100Hours: 0,
        paidAbsenceHours: 0,
      }),
      0,
    );
  });
});

describe("lønperiode", () => {
  it("defaults from the 20th to the 21st next month", async () => {
    const { payPeriodBounds, payPeriodFromSettings, shiftPeriod } = await import("./timesheets");
    const { startOfDay, toDateInput } = await import("./dates");
    const around = startOfDay(new Date(2026, 8, 21));
    const bounds = payPeriodBounds(around);
    assert.equal(toDateInput(bounds.start), "2026-09-20");
    assert.equal(toDateInput(bounds.end), "2026-10-21");
    const beforeStart = payPeriodBounds(startOfDay(new Date(2026, 8, 19)));
    assert.equal(toDateInput(beforeStart.start), "2026-08-20");
    assert.equal(toDateInput(beforeStart.end), "2026-09-21");
    assert.equal(toDateInput(shiftPeriod("LONPERIODE", around, -1)), "2026-08-20");
    assert.equal(toDateInput(shiftPeriod("LONPERIODE", around, 1)), "2026-10-20");
    const spec = payPeriodFromSettings({ payroll_period_start_day: "21", payroll_period_end_day: "20" });
    const custom = payPeriodBounds(around, spec);
    assert.equal(toDateInput(custom.start), "2026-09-21");
    assert.equal(toDateInput(custom.end), "2026-10-20");
  });
});

describe("tilbudsvar på mail", () => {
  it("strips quoted original so CTA does not count as godkend", async () => {
    const { customerReplyText, quoteReplyDecision } = await import("./quote-replies");
    const body = [
      "Ja tak",
      "",
      "Fra: Exempo <tilbud@exempo.dk>",
      "Sendt: 21. september 2026",
      "",
      "Se og godkend tilbud",
      "Svar med Godkendt eller Nej tak",
    ].join("\n");
    const text = customerReplyText(body, "Re: Tilbud TIL-2026-0002 — Exempo");
    assert.equal(text.toLowerCase().includes("ja tak"), true);
    assert.equal(text.toLowerCase().includes("nej tak"), false);
    assert.equal(quoteReplyDecision(text), "godkend");
  });

  it("treats reject phrases before approve", async () => {
    const { quoteReplyDecision, extractQuoteNumber, extractQuoteIdFromHeaders } = await import("./quote-replies");
    assert.equal(quoteReplyDecision("jeg godkender ikke"), "afvis");
    assert.equal(quoteReplyDecision("Nej tak"), "afvis");
    assert.equal(quoteReplyDecision("Godkendt"), "godkend");
    assert.equal(quoteReplyDecision("Se og godkend tilbud"), null);
    assert.equal(extractQuoteNumber("Angående TIL-2026-0002"), "TIL-2026-0002");
    assert.equal(extractQuoteIdFromHeaders("<exempo-quote-cmub5igs60001ay6rydog8e6g.1@exempo.dk>"), "cmub5igs60001ay6rydog8e6g");
  });
});

describe("geo", () => {
  it("builds tel and maps links from messy danish contact data", async () => {
    const { telHref, mailHref, googleMapsSearchUrl, appleMapsUrl, formatPlace, countryLabel } = await import("./geo");
    assert.equal(telHref("40 12 88 21"), "tel:40128821");
    assert.equal(telHref("+45 40 12 88 21"), "tel:+4540128821");
    assert.equal(telHref("12 34"), "");
    assert.equal(mailHref(" pl@exempo.dk "), "mailto:pl@exempo.dk");
    assert.equal(mailHref("ikke-en-mail"), "");
    assert.equal(
      googleMapsSearchUrl("Strandvejen 214, 2900 Hellerup"),
      "https://www.google.com/maps/search/?api=1&query=Strandvejen%20214%2C%202900%20Hellerup",
    );
    assert.equal(appleMapsUrl("Strandvejen 214"), "maps://?q=Strandvejen%20214");
    assert.equal(formatPlace(["Strandvejen 214", "2900", "Hellerup"]), "Strandvejen 214, 2900, Hellerup");
    assert.equal(countryLabel("DK"), "Danmark");
    assert.equal(countryLabel(""), "Danmark");
  });

  it("fills street, postnr and by from a DAWA suggestion", async () => {
    const { parseDawaSuggestion } = await import("./geo");
    const parsed = parseDawaSuggestion({
      tekst: "Nørrebrogade 88, 3. th, 2200 København N",
      adresse: {
        vejnavn: "Nørrebrogade",
        husnr: "88",
        etage: "3",
        dør: "th",
        postnr: "2200",
        postnrnavn: "København N",
      },
    });
    assert.equal(parsed.street, "Nørrebrogade 88, 3. th");
    assert.equal(parsed.postal, "2200");
    assert.equal(parsed.city, "København N");
  });
});

describe("lager-moduler", () => {
  it("defaults catalog and van stock off, and van implies catalog", async () => {
    const { SETTING_DEFAULTS, formFlag, productCatalogEnabled, vanStockEnabled } = await import("./settings");
    assert.equal(SETTING_DEFAULTS.feature_product_catalog, "0");
    assert.equal(SETTING_DEFAULTS.feature_van_stock, "0");
    assert.equal(productCatalogEnabled({}), false);
    assert.equal(vanStockEnabled({}), false);
    assert.equal(productCatalogEnabled({ feature_product_catalog: "1" }), true);
    assert.equal(vanStockEnabled({ feature_van_stock: "1" }), false);
    assert.equal(vanStockEnabled({ feature_product_catalog: "1", feature_van_stock: "1" }), true);

    const checked = new FormData();
    checked.append("feature_product_catalog", "0");
    checked.append("feature_product_catalog", "1");
    assert.equal(formFlag(checked, "feature_product_catalog"), true);

    const unchecked = new FormData();
    unchecked.append("feature_van_stock", "0");
    assert.equal(formFlag(unchecked, "feature_van_stock"), false);
  });
});

describe("KLS-skemaer", () => {
  it("covers every case trade and prefers matching fag then general", async () => {
    const { CASE_TRADES } = await import("./catalog");
    const { DEFAULT_KLS_TEMPLATES, sortKlsTemplates } = await import("./kls-catalog");
    const trades = new Set(DEFAULT_KLS_TEMPLATES.map((row) => row.trade));
    for (const trade of CASE_TRADES) {
      assert.equal(trades.has(trade), true, `missing KLS for ${trade}`);
    }
    const sorted = sortKlsTemplates(
      [
        { name: "Maler", trade: "MALER" },
        { name: "Generel", trade: "ANDET" },
        { name: "VVS", trade: "VVS" },
      ],
      "VVS",
    );
    assert.deepEqual(
      sorted.map((row) => row.name),
      ["VVS", "Generel", "Maler"],
    );
  });
});
