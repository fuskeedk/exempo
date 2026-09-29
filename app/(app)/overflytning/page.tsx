import { importMigrationAction } from "@/app/actions/migration";
import { AdminTabs } from "@/components/AdminTabs";
import { ErrorFlash, Flash } from "@/components/Flash";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { requireRole } from "@/lib/auth";

export default async function MigrationPage({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string; fejl?: string }>;
}) {
  await requireRole(["ADMIN", "PL"]);
  const { besked, fejl } = await searchParams;
  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Overflytning"
        description="Hent kunder, sager og varer fra Minuba, Ordrestyring, Apacta eller en anden CSV- eller Excel-fil."
      />
      <AdminTabs />
      <Flash message={besked} />
      <ErrorFlash message={fejl} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <form action={importMigrationAction} className="grid gap-4">
            <Field label="System">
              <Select name="source" defaultValue="auto">
                <option value="auto">Find selv</option>
                <option value="minuba">Minuba</option>
                <option value="ordrestyring">Ordrestyring</option>
                <option value="apacta">Apacta</option>
                <option value="andet">Anden fil</option>
              </Select>
            </Field>
            <Field label="Filer">
              <Input name="files" type="file" accept=".csv,.txt,.xlsx,.xls,text/csv" multiple required />
            </Field>
            <SubmitButton>Hent ind</SubmitButton>
          </form>
        </Card>
        <Card>
          <h2 className="font-serif text-xl">Eksport</h2>
          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="font-medium">Minuba</dt>
              <dd className="text-muted">Kunder → Import/Eksport → Eksporter kunder. Overblik → Eksporter overblik som CSV.</dd>
            </div>
            <div>
              <dt className="font-medium">Ordrestyring</dt>
              <dd className="text-muted">Indstillinger → Eksport, som CSV eller Excel.</dd>
            </div>
            <div>
              <dt className="font-medium">Apacta</dt>
              <dd className="text-muted">Eksportér kunder og sager til Excel eller CSV. Samme vej virker for andre systemer.</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
