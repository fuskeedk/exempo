"use client";

import { useState } from "react";
import { createEmployeeAction, updateEmployeeAction } from "@/app/actions/employees";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Input, Select } from "@/components/ui";
import { EMPLOYEE_COLORS, ROLE_LABELS, ROLES, TRADE_LABELS, TRADES } from "@/lib/catalog";
import { toDateInput } from "@/lib/dates";
import { isPayType, PAY_TYPE_LABELS, PAY_TYPES, type PayType } from "@/lib/employees";

export type EmployeeFormValues = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  trade: string;
  hourlyRate: number;
  wageRate: number;
  payType: string;
  monthlySalary: number;
  employeeNumber: string;
  agreementCode: string;
  apprenticeStep: number;
  apprenticeStart: Date | null;
  managerId: string | null;
  color: string;
};

export function EmployeeForm({
  employee,
  agreements = [],
  managers = [],
}: {
  employee?: EmployeeFormValues;
  agreements?: { code: string; name: string }[];
  managers?: { id: string; name: string }[];
}) {
  const edit = Boolean(employee);
  const hourlyDefault = employee ? String(Math.round(employee.hourlyRate / 100)) : "450";
  const wageDefault = employee?.wageRate ? String(Math.round(employee.wageRate / 100)) : "";
  const monthlyDefault = employee?.monthlySalary ? String(Math.round(employee.monthlySalary / 100)) : "";
  const payTypeRaw = employee?.payType ?? "TIMER";
  const [payType, setPayType] = useState<PayType>(isPayType(payTypeRaw) ? payTypeRaw : "TIMER");
  const salaried = payType === "FUNKTIONAER";

  return (
    <form action={edit ? updateEmployeeAction : createEmployeeAction} className="grid max-w-xl gap-4">
      {employee ? (
        <>
          <input type="hidden" name="id" value={employee.id} />
          <input type="hidden" name="employeeId" value={employee.id} />
        </>
      ) : null}
      <Field label="Navn">
        <Input name="name" required defaultValue={employee?.name} />
      </Field>
      <Field label="E-mail">
        <Input name="email" type="email" required defaultValue={employee?.email} />
      </Field>
      <Field label={edit ? "Ny adgangskode" : "Adgangskode"}>
        <Input
          name="password"
          type="text"
          defaultValue={edit ? "" : "exempo123"}
          placeholder={edit ? "Lad stå tom for at beholde den nuværende" : undefined}
        />
      </Field>
      <Field label="Telefon">
        <Input name="phone" defaultValue={employee?.phone} />
      </Field>
      <Field label="Medarbejdernr. (Danløn/Dataløn)">
        <Input name="employeeNumber" defaultValue={employee?.employeeNumber} />
      </Field>
      <Field label="Rolle">
        <Select name="role" defaultValue={employee?.role ?? "MEDARBEJDER"}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fag">
        <Select name="trade" defaultValue={employee?.trade ?? "ANDET"}>
          {TRADES.map((trade) => (
            <option key={trade} value={trade}>
              {TRADE_LABELS[trade]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Projektleder">
        <Select name="managerId" defaultValue={employee?.managerId ?? ""}>
          <option value="">Ingen</option>
          {managers
            .filter((row) => row.id !== employee?.id)
            .map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Ansættelse">
        <Select
          name="payType"
          value={payType}
          onChange={(event) => setPayType(isPayType(event.target.value) ? event.target.value : "TIMER")}
        >
          {PAY_TYPES.map((type) => (
            <option key={type} value={type}>
              {PAY_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-muted">
          Funktionærer får fast månedsløn. Timelønnede afregnes pr. time og overtid.
        </p>
      </Field>
      <Field label="Kostpris, kr./t">
        <Input name="hourlyRate" defaultValue={hourlyDefault} />
        <p className="mt-1 text-xs text-muted">Bruges på sager og dækningsgrad.</p>
      </Field>
      {salaried ? (
        <Field label="Månedsløn, kr.">
          <Input name="monthlySalary" defaultValue={monthlyDefault} placeholder="fx 38000" required />
          <p className="mt-1 text-xs text-muted">Fast løn pr. lønperiode. Overtid og feriepenge beregnes ikke.</p>
        </Field>
      ) : (
        <Field label="Timeløn, kr./t">
          <Input name="wageRate" defaultValue={wageDefault} placeholder="Tom = lærlingesats eller kostpris" />
          <p className="mt-1 text-xs text-muted">Den løn, der udbetales. Overskriver lærlingesats, hvis den er udfyldt.</p>
        </Field>
      )}
      <Field label="Overenskomst">
        <Select name="agreementCode" defaultValue={employee?.agreementCode ?? "NONE"}>
          {(agreements.length ? agreements : [{ code: "NONE", name: "Ingen overenskomst" }]).map((row) => (
            <option key={row.code} value={row.code}>
              {row.name}
            </option>
          ))}
        </Select>
      </Field>
      {salaried ? null : (
        <>
          <Field label="Lærlingetrin">
            <Select name="apprenticeStep" defaultValue={String(employee?.apprenticeStep ?? 0)}>
              <option value="0">Ikke lærling</option>
              {[1, 2, 3, 4, 5].map((step) => (
                <option key={step} value={String(step)}>
                  {step}. år / lønperiode
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Uddannelse startet">
            <Input
              name="apprenticeStart"
              type="date"
              defaultValue={employee?.apprenticeStart ? toDateInput(employee.apprenticeStart) : ""}
            />
            <p className="mt-1 text-xs text-muted">Udfyldes for lærlinge, så timelønnen følger, hvor langt de er.</p>
          </Field>
        </>
      )}
      <Field label="Kalenderfarve">
        <div className="flex items-center gap-3">
          <Input
            name="color"
            type="color"
            defaultValue={employee?.color ?? EMPLOYEE_COLORS[0]}
            className="h-10 w-16 cursor-pointer p-1"
          />
          <p className="text-sm text-muted">Vises i planlægning og på medarbejderkortet.</p>
        </div>
      </Field>
      <SubmitButton>{edit ? "Gem medarbejder" : "Opret medarbejder"}</SubmitButton>
    </form>
  );
}
