import { formatHoursDa, formatNumericDate, toDateInput } from "@/lib/dates";
import {
  TIMESHEET_PERIOD_LABELS,
  TIMESHEET_STATUS_LABELS,
  isTimesheetPeriod,
  isTimesheetStatus,
} from "@/lib/timesheets";

function csvCell(value: string | number) {
  const text = String(value).replaceAll('"', '""');
  return `"${text}"`;
}

function kr(ore: number) {
  return (ore / 100).toFixed(2).replace(".", ",");
}

export type PayrollExportRow = {
  user: { name: string; email: string; employeeNumber: string };
  period: string;
  start: Date;
  end: Date;
  status: string;
  agreementName: string;
  wageRate: number;
  apprenticeStep: number;
  payType?: string;
  monthlySalary?: number;
  normalHours: number;
  overtime50Hours: number;
  overtime100Hours: number;
  absenceHours: number;
  sickHours?: number;
  childSickHours?: number;
  normalOre: number;
  overtimeOre: number;
  sickOre?: number;
  holidayPayOre: number;
  shOre: number;
  fritvalgOre: number;
  pensionEmployerOre: number;
  pensionEmployeeOre: number;
  employerCostOre: number;
};

function periodLabel(period: string) {
  return isTimesheetPeriod(period) ? TIMESHEET_PERIOD_LABELS[period] : period;
}

function statusLabel(status: string) {
  return isTimesheetStatus(status) ? TIMESHEET_STATUS_LABELS[status] : status;
}

export function timesheetsExcelCsv(rows: PayrollExportRow[]) {
  const header = [
    "Medarbejder",
    "E-mail",
    "Mednr.",
    "Periode",
    "Fra",
    "Til",
    "Status",
    "Overenskomst",
    "Ansættelse",
    "Lærlingetrin",
    "Timeløn/månedsløn",
    "Normaltimer",
    "Overtid 50%",
    "Overtid 100%",
    "Sygetimer",
    "Barnsyg",
    "Fravær",
    "Normalløn",
    "Overtid",
    "Sygeløn",
    "Feriepenge",
    "SH-opsparing",
    "Fritvalg",
    "Pension AG",
    "Pension LN",
    "AG-omkostning",
  ];
  const lines = rows.map((row) =>
    [
      row.user.name,
      row.user.email,
      row.user.employeeNumber,
      periodLabel(row.period),
      formatNumericDate(row.start),
      formatNumericDate(row.end),
      statusLabel(row.status),
      row.agreementName,
      row.payType === "FUNKTIONAER" ? "Funktionær" : "Timelønnet",
      row.apprenticeStep || "",
      kr(row.payType === "FUNKTIONAER" ? row.monthlySalary || row.wageRate : row.wageRate),
      formatHoursDa(row.normalHours),
      formatHoursDa(row.overtime50Hours),
      formatHoursDa(row.overtime100Hours),
      formatHoursDa(row.sickHours ?? 0),
      formatHoursDa(row.childSickHours ?? 0),
      formatHoursDa(row.absenceHours),
      kr(row.normalOre),
      kr(row.overtimeOre),
      kr(row.sickOre ?? 0),
      kr(row.holidayPayOre),
      kr(row.shOre),
      kr(row.fritvalgOre),
      kr(row.pensionEmployerOre),
      kr(row.pensionEmployeeOre),
      kr(row.employerCostOre),
    ]
      .map(csvCell)
      .join(";"),
  );
  return `\uFEFF${[header.map(csvCell).join(";"), ...lines].join("\r\n")}\r\n`;
}

export function timesheetsPayrollCsv(rows: PayrollExportRow[], provider: "danlon" | "dataloen") {
  const header = ["Medarbejdernr", "Navn", "Dato", "Lønart", "Lønartnavn", "Enheder", "Sats", "Beløb", "Tekst"];
  const lines: string[] = [];
  for (const row of rows) {
    const number = row.user.employeeNumber || row.user.email;
    const date = toDateInput(row.start);
    const text = `${provider === "danlon" ? "Danløn" : "Dataløn"} ${periodLabel(row.period)} ${formatNumericDate(row.start)}`;
    const items: Array<[string, string, string, string, number]> = [
      row.payType === "FUNKTIONAER"
        ? ["10", "Månedsløn", "1", kr(row.monthlySalary || row.wageRate), row.normalOre]
        : ["10", "Normaltimer", formatHoursDa(row.normalHours), kr(row.wageRate), row.normalOre],
      ["20", "Overtid", formatHoursDa(row.overtime50Hours + row.overtime100Hours), "", row.overtimeOre],
      ["30", "Sygeløn", formatHoursDa((row.sickHours ?? 0) + (row.childSickHours ?? 0)), "", row.sickOre ?? 0],
      ["40", "Feriepenge", "", "", row.holidayPayOre],
      ["50", "SH-opsparing", "", "", row.shOre],
      ["60", "Fritvalg", "", "", row.fritvalgOre],
      ["70", "Pension AG", "", "", row.pensionEmployerOre],
      ["71", "Pension LN", "", "", row.pensionEmployeeOre],
    ];
    for (const item of items) {
      if (item[4] <= 0 && item[0] !== "10") continue;
      lines.push(
        [number, row.user.name, date, item[0], item[1], item[2], item[3], kr(item[4]), text].map(csvCell).join(";"),
      );
    }
  }
  return `\uFEFF${[header.map(csvCell).join(";"), ...lines].join("\r\n")}\r\n`;
}
