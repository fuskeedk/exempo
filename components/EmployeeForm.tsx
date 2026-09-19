import { createEmployeeAction } from "@/app/actions/employees";
import { SubmitButton } from "@/components/SubmitButton";
import { Field, Input, Select } from "@/components/ui";
import { ROLE_LABELS, ROLES, TRADE_LABELS, TRADES } from "@/lib/catalog";

export function EmployeeForm() {
  return (
    <form action={createEmployeeAction} className="grid max-w-xl gap-4">
      <Field label="Navn">
        <Input name="name" required />
      </Field>
      <Field label="E-mail">
        <Input name="email" type="email" required />
      </Field>
      <Field label="Adgangskode">
        <Input name="password" type="text" defaultValue="exempo123" />
      </Field>
      <Field label="Telefon">
        <Input name="phone" />
      </Field>
      <Field label="Rolle">
        <Select name="role" defaultValue="MEDARBEJDER">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Fag">
        <Select name="trade" defaultValue="ANDET">
          {TRADES.map((trade) => (
            <option key={trade} value={trade}>
              {TRADE_LABELS[trade]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Timepris, kr.">
        <Input name="hourlyRate" defaultValue="450" />
      </Field>
      <SubmitButton>Opret medarbejder</SubmitButton>
    </form>
  );
}
