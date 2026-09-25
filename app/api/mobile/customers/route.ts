import { isSession, jsonOk, mobileOptions, requireBearer } from "@/lib/mobile-auth";
import { prisma } from "@/lib/prisma";

export const OPTIONS = mobileOptions;

export async function GET(request: Request) {
  const user = await requireBearer(request);
  if (!isSession(user)) return user;
  const customers = await prisma.customer.findMany({
    include: {
      addresses: true,
      _count: { select: { cases: true } },
    },
    orderBy: { name: "asc" },
    take: 200,
  });
  return jsonOk({
    customers: customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      type: customer.type,
      phone: customer.phone,
      email: customer.email,
      address: customer.addresses[0]
        ? `${customer.addresses[0].street}, ${customer.addresses[0].postal} ${customer.addresses[0].city}`.trim()
        : "",
      caseCount: customer._count.cases,
    })),
  });
}
