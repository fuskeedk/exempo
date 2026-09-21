export function employeeStatusReason(input: {
  isSelf: boolean;
  isActiveAdmin: boolean;
  remainingActiveAdmins: number;
  timeEntries: number;
  invoices: number;
  timesheets: number;
  action: "deactivate" | "delete";
}): string | null {
  if (input.isSelf) return "Du kan ikke ændre din egen konto her.";
  if (input.isActiveAdmin && input.remainingActiveAdmins === 0) {
    return input.action === "delete"
      ? "Du kan ikke slette den sidste administrator."
      : "Du kan ikke deaktivere den sidste administrator.";
  }
  if (input.action === "delete" && (input.timeEntries > 0 || input.invoices > 0 || input.timesheets > 0)) {
    return "Medarbejderen har tid eller faktura på sig og kan ikke slettes. Deaktivér i stedet, så historikken bevares.";
  }
  return null;
}

export const PAY_TYPES = ["TIMER", "FUNKTIONAER"] as const;
export type PayType = (typeof PAY_TYPES)[number];
export const PAY_TYPE_LABELS: Record<PayType, string> = {
  TIMER: "Timelønnet",
  FUNKTIONAER: "Funktionær (månedsløn)",
};

export function isPayType(value: string): value is PayType {
  return (PAY_TYPES as readonly string[]).includes(value);
}

export function isSalaried(payType?: string | null) {
  return payType === "FUNKTIONAER";
}

export function monthlyHoursFromWeek(weekHours: number) {
  return ((weekHours || 37) * 52) / 12;
}

/** Prorate monthly salary by expected hours in the period versus a standard month. */
export function salariedPayOre(monthlySalaryOre: number, expectedHours: number, weekHours: number) {
  if (monthlySalaryOre <= 0) return 0;
  const monthlyHours = monthlyHoursFromWeek(weekHours);
  if (expectedHours <= 0 || monthlyHours <= 0) return monthlySalaryOre;
  return Math.round(monthlySalaryOre * (expectedHours / monthlyHours));
}
