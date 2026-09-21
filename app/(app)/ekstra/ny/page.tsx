import { createExtraWorkAction } from "@/app/actions/field";
import { SubmitButton } from "@/components/SubmitButton";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewExtraWorkPage() {
  await requireRole(["ADMIN", "PL"]);
  const cases = await prisma.case.findMany({
    select: { id: true, caseNumber: true, title: true },
    orderBy: { caseNumber: "desc" },
    take: 300,
  });

  return (
    <div className="wo">
      <div className="wo-top">
        <h1>Nyt ekstra-arbejde</h1>
      </div>
      <section className="wo-section">
        <header>
          <h2>Ekstra-arbejde</h2>
        </header>
        <div className="wo-section-body">
          <form action={createExtraWorkAction} className="wo-grid-2">
            <input type="hidden" name="redirect" value="1" />
            <label className="wo-span">
              Arbejdsseddel
              <select name="caseId" required>
                <option value="">Vælg ordre…</option>
                {cases.map((sag) => (
                  <option key={sag.id} value={sag.id}>
                    {sag.caseNumber} · {sag.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="wo-span">
              Titel
              <input name="title" required placeholder="Udskiftning af sokkelpanel" />
            </label>
            <label>
              Beløb, kr.
              <input name="amount" placeholder="4.500" />
            </label>
            <label className="wo-span">
              Beskrivelse
              <textarea name="description" rows={4} />
            </label>
            <div>
              <SubmitButton>Opret ekstra-arbejde</SubmitButton>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}
