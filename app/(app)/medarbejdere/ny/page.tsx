import { EmployeeForm } from "@/components/EmployeeForm";
import { Card, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";

export default async function NewEmployeePage() {
  await requireRole(["ADMIN", "PL"]);
  return (
    <>
      <PageHeader
        kicker="Organisation"
        title="Ny medarbejder"
        description="Medarbejderen får egen login og kalender."
      />
      <Card>
        <EmployeeForm />
      </Card>
    </>
  );
}
