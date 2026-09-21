import { NextResponse } from "next/server";
import { canSeePayroll, getSession } from "@/lib/auth";
import { parseDayParam } from "@/lib/dates";
import { timesheetsExcelCsv, timesheetsPayrollCsv } from "@/lib/payroll-export";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !canSeePayroll(session.role)) {
    return NextResponse.json({ error: "Ikke tilladt." }, { status: 401 });
  }
  const url = new URL(request.url);
  const format = url.searchParams.get("format") || "excel";
  const status = url.searchParams.get("status");
  const fra = url.searchParams.get("fra");
  const til = url.searchParams.get("til");
  const from = fra ? parseDayParam(fra) : undefined;
  const to = til ? parseDayParam(til) : undefined;

  const sheets = await prisma.timesheet.findMany({
    where: {
      status: !status || status === "alle" ? { in: ["GODKENDT", "AFLEVERET"] } : status,
      start: from || to ? { gte: from, lt: to ? new Date(to.getTime() + 86400000) : undefined } : undefined,
      ...(session.role === "PL"
        ? { user: { OR: [{ managerId: session.id }, { managerId: null }, { id: session.id }] } }
        : {}),
    },
    include: { user: { select: { name: true, email: true, employeeNumber: true } } },
    orderBy: [{ start: "asc" }, { user: { name: "asc" } }],
  });

  const csv =
    format === "danlon"
      ? timesheetsPayrollCsv(sheets, "danlon")
      : format === "dataloen"
        ? timesheetsPayrollCsv(sheets, "dataloen")
        : timesheetsExcelCsv(sheets);
  const filename =
    format === "danlon" ? "danloen-timesedler.csv" : format === "dataloen" ? "dataloen-timesedler.csv" : "timesedler.csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
