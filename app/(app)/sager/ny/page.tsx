import { NewOrderForm } from "@/components/NewOrderForm";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewCasePage() {
  const user = await requireRole(["ADMIN", "PL"]);
  const [customers, employees] = await Promise.all([
    prisma.customer.findMany({
      include: { addresses: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { active: true, role: { in: ["ADMIN", "PL", "MEDARBEJDER"] } },
      select: { id: true, name: true, role: true, trade: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <NewOrderForm
      customers={customers.map((row) => ({
        id: row.id,
        name: row.name,
        cvr: row.cvr,
        email: row.email,
        phone: row.phone,
        addresses: row.addresses.map((address) => ({
          id: address.id,
          label: address.label,
          street: address.street,
          postal: address.postal,
          city: address.city,
        })),
      }))}
      employees={employees}
      currentUserId={user.id}
    />
  );
}
