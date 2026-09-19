import Link from "next/link";
import {
  createAbsenceAction,
  createExtraWorkAction,
  startTimerAction,
  stopTimerAction,
} from "@/app/actions/field";
import { addCatalogMaterialAction, addMaterialByBarcodeAction } from "@/app/actions/products";
import { uploadDocumentAction } from "@/app/actions/documents";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, Field, Input, PageHeader, Select } from "@/components/ui";
import { canManageOffice, requireSession } from "@/lib/auth";
import { ABSENCE_TYPE_LABELS, ABSENCE_TYPES } from "@/lib/catalog";
import { toDateInput, weekStart } from "@/lib/dates";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";

export default async function MyDayPage() {
  const user = await requireSession();
  const office = canManageOffice(user.role);
  const worker = await prisma.user.findUnique({ where: { id: user.id } });
  const weekFrom = weekStart(new Date());
  const weekTo = addDays(weekFrom, 7);

  const jobs = await prisma.case.findMany({
    where: {
      state: { notIn: ["AFSLUTTET", "ANNULLERET"] },
      OR: [
        { assignedToId: user.id },
        ...(office ? [{ scheduledStart: { gte: weekFrom, lt: weekTo } }] : []),
      ],
    },
    orderBy: { scheduledStart: "asc" },
  });
  const products = await prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const timerCase = worker?.timerCaseId
    ? jobs.find((job) => job.id === worker.timerCaseId) ??
      (await prisma.case.findUnique({ where: { id: worker.timerCaseId } }))
    : null;

  return (
    <>
      <PageHeader
        kicker="I marken"
        title="Min dag"
        description="Arbejdssedler, stopur, materialer, foto og ekstraarbejde — det montøren har i Minuba-appen."
      />
      {timerCase ? (
        <Card className="mb-6 border-pine">
          <p className="text-sm text-muted">Timer kører på</p>
          <p className="font-serif text-2xl">{timerCase.title}</p>
          <form action={stopTimerAction} className="mt-3">
            <SubmitButton>Stop og registrér tid</SubmitButton>
          </form>
        </Card>
      ) : null}

      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/sager/${job.id}`} className="font-serif text-xl hover:underline">
                  {job.caseNumber} · {job.title}
                </Link>
                <p className="text-sm text-muted">
                  {job.customerName} · {job.customerAddress}, {job.customerCity}
                </p>
              </div>
              <StatusBadge state={job.state} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <form action={startTimerAction}>
                <input type="hidden" name="caseId" value={job.id} />
                <SubmitButton variant="secondary">Start tid</SubmitButton>
              </form>
              <Link
                href={`/sager/${job.id}`}
                className="inline-flex items-center rounded-full border border-line bg-white px-4 py-2.5 text-sm font-semibold"
              >
                Åbn arbejdsseddel
              </Link>
            </div>
            <form action={addCatalogMaterialAction} className="mt-4 grid gap-2 sm:grid-cols-[1fr_100px_auto]">
              <input type="hidden" name="caseId" value={job.id} />
              <Select name="productId" required>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} · {product.name}
                  </option>
                ))}
              </Select>
              <Input name="quantity" defaultValue="1" />
              <SubmitButton variant="secondary">Materiale</SubmitButton>
            </form>
            <form action={addMaterialByBarcodeAction} className="mt-2 grid gap-2 sm:grid-cols-[1fr_100px_auto]">
              <input type="hidden" name="caseId" value={job.id} />
              <Input name="barcode" placeholder="Stregkode eller varenr." required />
              <Input name="quantity" defaultValue="1" />
              <SubmitButton variant="secondary">Scan</SubmitButton>
            </form>
            <form action={uploadDocumentAction} className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
              <input type="hidden" name="caseId" value={job.id} />
              <input type="hidden" name="category" value="FOTO" />
              <Input type="file" name="file" required />
              <SubmitButton variant="secondary">Foto</SubmitButton>
            </form>
            <form action={createExtraWorkAction} className="mt-3 grid gap-2 sm:grid-cols-3">
              <input type="hidden" name="caseId" value={job.id} />
              <Input name="title" placeholder="Ekstraarbejde" required />
              <Input name="amount" placeholder="Beløb, kr." />
              <SubmitButton variant="secondary">Send ekstra</SubmitButton>
            </form>
          </Card>
        ))}
        {jobs.length === 0 ? (
          <Card>
            <p className="text-sm text-muted">
              Ingen job i kalenderen lige nu. Åbn arbejdssedler, eller få PL til at lægge dig på planlægningen.
            </p>
          </Card>
        ) : null}
      </div>

      <Card className="mt-8">
        <h2 className="font-serif text-xl">Fravær</h2>
        <form action={createAbsenceAction} className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Dato">
            <Input type="date" name="date" defaultValue={toDateInput(new Date())} required />
          </Field>
          <Field label="Type">
            <Select name="type" defaultValue="FERIE">
              {ABSENCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ABSENCE_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Timer">
            <Input name="hours" defaultValue="7,4" />
          </Field>
          <Field label="Note">
            <Input name="note" />
          </Field>
          <SubmitButton>Registrér fravær</SubmitButton>
        </form>
      </Card>
    </>
  );
}
