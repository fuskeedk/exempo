import { createCustomerAction } from "@/app/actions/customers";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPES } from "@/lib/catalog";

export default async function NewCustomerPage() {
  await requireRole(["ADMIN", "PL"]);
  return (
    <>
      <PageHeader kicker="Kartotek" title="Ny kunde" description="Opret kunde med primær adresse." />
      <Card>
        <form action={createCustomerAction} className="grid max-w-xl gap-4">
          <Field label="Navn">
            <Input name="name" required />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue="PRIVAT">
              {CUSTOMER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CUSTOMER_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="CVR">
            <Input name="cvr" />
          </Field>
          <Field label="Telefon">
            <Input name="phone" />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" />
          </Field>
          <Field label="Adresselabel">
            <Input name="addressLabel" defaultValue="Primær" />
          </Field>
          <Field label="Adresse">
            <Input name="street" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Postnr.">
              <Input name="postal" />
            </Field>
            <Field label="By">
              <Input name="city" />
            </Field>
          </div>
          <Field label="Noter">
            <Textarea name="notes" rows={3} />
          </Field>
          <SubmitButton>Opret kunde</SubmitButton>
        </form>
      </Card>
    </>
  );
}
