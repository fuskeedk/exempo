export type CustomerDraft = {
  customerId: string;
  addressId: string;
  name: string;
  street: string;
  postal: string;
  city: string;
  phone: string;
  email: string;
  cvr: string;
  type: string;
};

export type ResolvedCustomer = {
  customerId: string;
  addressId?: string;
  created: boolean;
  customerName: string;
  customerAddress: string;
  customerPostal: string;
  customerCity: string;
  customerPhone: string;
  customerEmail: string;
};

type AddressRow = {
  id: string;
  street: string;
  postal: string;
  city: string;
};

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email: string;
  addresses: AddressRow[];
};

export type CustomerStore = {
  customer: {
    findUnique: (args: {
      where: { id: string };
      include: { addresses: true };
    }) => Promise<CustomerRow | null>;
    create: (args: {
      data: {
        name: string;
        type: string;
        cvr: string;
        email: string;
        phone: string;
        addresses?: {
          create: { label: string; street: string; postal: string; city: string };
        };
      };
      include: { addresses: true };
    }) => Promise<CustomerRow>;
  };
};

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function first(formData: FormData, keys: string[]) {
  for (const key of keys) {
    const value = str(formData, key);
    if (value) return value;
  }
  return "";
}

export function readCustomerDraft(formData: FormData): CustomerDraft {
  return {
    customerId: str(formData, "customerId"),
    addressId: str(formData, "addressId"),
    name: first(formData, ["customerName", "contactName", "name"]),
    street: first(formData, ["customerAddress", "street"]),
    postal: first(formData, ["customerPostal", "postal"]),
    city: first(formData, ["customerCity", "city"]),
    phone: first(formData, ["customerPhone", "customerMobile", "phone"]),
    email: first(formData, ["customerEmail", "email"]),
    cvr: first(formData, ["vatNumber", "cvr"]),
    type: str(formData, "type") || "PRIVAT",
  };
}

function pickAddress(customer: CustomerRow, draft: CustomerDraft) {
  return (
    customer.addresses.find((item) => item.id === draft.addressId) ??
    customer.addresses.find(
      (item) =>
        draft.street &&
        item.street === draft.street &&
        item.postal === draft.postal &&
        item.city === draft.city,
    ) ??
    customer.addresses[0]
  );
}

function fromExisting(customer: CustomerRow, draft: CustomerDraft): ResolvedCustomer {
  const address = pickAddress(customer, draft);
  return {
    customerId: customer.id,
    addressId: address?.id,
    created: false,
    customerName: draft.name || customer.name,
    customerAddress: draft.street || address?.street || "",
    customerPostal: draft.postal || address?.postal || "",
    customerCity: draft.city || address?.city || "",
    customerPhone: draft.phone || customer.phone,
    customerEmail: draft.email || customer.email,
  };
}

export async function ensureCustomerFromForm(
  db: CustomerStore,
  formData: FormData,
  options: { requireName?: boolean; requireAddress?: boolean } = {},
): Promise<ResolvedCustomer> {
  const draft = readCustomerDraft(formData);
  const requireName = options.requireName ?? true;
  const requireAddress = options.requireAddress ?? false;

  if (draft.customerId) {
    const existing = await db.customer.findUnique({
      where: { id: draft.customerId },
      include: { addresses: true },
    });
    if (existing) {
      const resolved = fromExisting(existing, draft);
      if (requireName && !resolved.customerName) {
        throw new Error("Kundenavn er påkrævet.");
      }
      if (requireAddress && !resolved.customerAddress) {
        throw new Error("Adresse er påkrævet.");
      }
      return resolved;
    }
  }

  if (requireName && !draft.name) {
    throw new Error("Kundenavn er påkrævet.");
  }
  if (requireAddress && !draft.street) {
    throw new Error("Adresse er påkrævet.");
  }

  const created = await db.customer.create({
    data: {
      name: draft.name,
      type: draft.type || "PRIVAT",
      cvr: draft.cvr,
      email: draft.email,
      phone: draft.phone,
      addresses: draft.street
        ? {
            create: {
              label: "Primær",
              street: draft.street,
              postal: draft.postal,
              city: draft.city,
            },
          }
        : undefined,
    },
    include: { addresses: true },
  });

  return {
    customerId: created.id,
    addressId: created.addresses[0]?.id,
    created: true,
    customerName: created.name,
    customerAddress: created.addresses[0]?.street || draft.street,
    customerPostal: created.addresses[0]?.postal || draft.postal,
    customerCity: created.addresses[0]?.city || draft.city,
    customerPhone: created.phone,
    customerEmail: created.email,
  };
}
