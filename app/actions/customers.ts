"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createCustomerAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const name = str(formData, "name");
  if (!name) throw new Error("Kundenavn er påkrævet.");
  const customer = await prisma.customer.create({
    data: {
      name,
      type: str(formData, "type") || "PRIVAT",
      cvr: str(formData, "cvr"),
      email: str(formData, "email"),
      phone: str(formData, "phone"),
      notes: str(formData, "notes"),
      addresses: str(formData, "street")
        ? {
            create: {
              label: str(formData, "addressLabel") || "Primær",
              street: str(formData, "street"),
              postal: str(formData, "postal"),
              city: str(formData, "city"),
            },
          }
        : undefined,
    },
  });
  revalidatePath("/kunder");
  redirect(`/kunder/${customer.id}`);
}

export async function addAddressAction(formData: FormData) {
  await requireRole(["ADMIN", "PL"]);
  const customerId = str(formData, "customerId");
  await prisma.address.create({
    data: {
      customerId,
      label: str(formData, "label") || "Adresse",
      street: str(formData, "street"),
      postal: str(formData, "postal"),
      city: str(formData, "city"),
      notes: str(formData, "notes"),
    },
  });
  revalidatePath(`/kunder/${customerId}`);
}
