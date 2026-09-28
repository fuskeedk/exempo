export type BookLine = { description: string; quantity: number; unitPrice: number };

export type BookInvoice = {
  invoiceNumber: string;
  issuedAt: Date;
  lines: BookLine[];
  customerName: string;
  email: string;
  address: string;
  postal: string;
  city: string;
  phone: string;
};

export type BookSettings = {
  accounting_provider: string;
  economic_agreement_grant: string;
  economic_app_secret: string;
  billy_api_key: string;
  billy_org_id: string;
  dinero_api_key: string;
  dinero_org_id: string;
  dinero_client_id: string;
  dinero_client_secret: string;
};

function kr(ore: number) {
  return Math.round(ore) / 100;
}

function day(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function readError(response: Response) {
  const text = (await response.text()).slice(0, 240);
  return text || `Bogføring svarede ${response.status}.`;
}

export function accountingConfigured(settings: BookSettings) {
  if (settings.accounting_provider === "economic") {
    return Boolean(settings.economic_agreement_grant && settings.economic_app_secret);
  }
  if (settings.accounting_provider === "billy") return Boolean(settings.billy_api_key);
  if (settings.accounting_provider === "dinero") {
    return Boolean(settings.dinero_api_key && settings.dinero_org_id && settings.dinero_client_id && settings.dinero_client_secret);
  }
  return false;
}

export async function bookInvoice(
  settings: BookSettings,
  invoice: BookInvoice,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: true; ref: string; skipped?: boolean } | { ok: false; reason: string }> {
  if (!settings.accounting_provider) return { ok: true, ref: "", skipped: true };
  if (!accountingConfigured(settings)) {
    return { ok: false, reason: "Bogføring er valgt, men nøglerne er ikke udfyldt." };
  }
  if (settings.accounting_provider === "economic") return bookEconomic(settings, invoice, fetchImpl);
  if (settings.accounting_provider === "billy") return bookBilly(settings, invoice, fetchImpl);
  if (settings.accounting_provider === "dinero") return bookDinero(settings, invoice, fetchImpl);
  return { ok: true, ref: "", skipped: true };
}

export async function pingAccounting(settings: BookSettings, fetchImpl: typeof fetch = fetch) {
  if (!accountingConfigured(settings)) return { ok: false as const, reason: "Nøglerne er ikke udfyldt." };
  if (settings.accounting_provider === "economic") {
    const response = await fetchImpl("https://restapi.e-conomic.com/self", { headers: economicHeaders(settings) });
    return response.ok ? { ok: true as const } : { ok: false as const, reason: await readError(response) };
  }
  if (settings.accounting_provider === "billy") {
    const response = await fetchImpl("https://api.billysbilling.com/v2/organization", { headers: billyHeaders(settings) });
    return response.ok ? { ok: true as const } : { ok: false as const, reason: await readError(response) };
  }
  const token = await dineroToken(settings, fetchImpl);
  if (!token.ok) return token;
  const response = await fetchImpl(`https://api.dinero.dk/v1/${settings.dinero_org_id}/contacts?pageSize=1`, {
    headers: { Authorization: `Bearer ${token.token}` },
  });
  return response.ok ? { ok: true as const } : { ok: false as const, reason: await readError(response) };
}

function economicHeaders(settings: BookSettings) {
  return {
    "X-AppSecretToken": settings.economic_app_secret,
    "X-AgreementGrantToken": settings.economic_agreement_grant,
    "Content-Type": "application/json",
  };
}

function billyHeaders(settings: BookSettings) {
  return { "X-Access-Token": settings.billy_api_key, "Content-Type": "application/json" };
}

async function bookEconomic(settings: BookSettings, invoice: BookInvoice, fetchImpl: typeof fetch) {
  const headers = economicHeaders(settings);
  const listed = await fetchImpl(
    `https://restapi.e-conomic.com/customers?filter=name$eq:${encodeURIComponent(invoice.customerName)}&pagesize=1`,
    { headers },
  );
  if (!listed.ok) return { ok: false as const, reason: await readError(listed) };
  const found = (await listed.json()) as { collection?: Array<{ customerNumber: number }> };
  let customerNumber = found.collection?.[0]?.customerNumber;
  if (!customerNumber) {
    const created = await fetchImpl("https://restapi.e-conomic.com/customers", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: invoice.customerName || "Kunde",
        email: invoice.email,
        address: invoice.address,
        zip: invoice.postal,
        city: invoice.city,
        telephoneAndFaxNumber: invoice.phone,
        currency: "DKK",
        customerGroup: { customerGroupNumber: 1 },
        paymentTerms: { paymentTermsNumber: 1 },
        vatZone: { vatZoneNumber: 1 },
      }),
    });
    if (!created.ok) return { ok: false as const, reason: await readError(created) };
    customerNumber = ((await created.json()) as { customerNumber: number }).customerNumber;
  }
  const drafted = await fetchImpl("https://restapi.e-conomic.com/invoices/drafts", {
    method: "POST",
    headers,
    body: JSON.stringify({
      date: day(invoice.issuedAt),
      currency: "DKK",
      customer: { customerNumber },
      recipient: {
        name: invoice.customerName,
        address: invoice.address,
        zip: invoice.postal,
        city: invoice.city,
        vatZone: { vatZoneNumber: 1 },
      },
      layout: { layoutNumber: 1 },
      notes: { heading: invoice.invoiceNumber },
      lines: invoice.lines.map((line) => ({
        description: line.description,
        quantity: line.quantity,
        unitNetPrice: kr(line.unitPrice),
      })),
    }),
  });
  if (!drafted.ok) return { ok: false as const, reason: await readError(drafted) };
  const body = (await drafted.json()) as { draftInvoiceNumber?: number };
  return { ok: true as const, ref: body.draftInvoiceNumber ? `economic:${body.draftInvoiceNumber}` : "economic" };
}

async function bookBilly(settings: BookSettings, invoice: BookInvoice, fetchImpl: typeof fetch) {
  const headers = billyHeaders(settings);
  const query = encodeURIComponent(invoice.customerName);
  const listed = await fetchImpl(`https://api.billysbilling.com/v2/contacts?q=${query}`, { headers });
  if (!listed.ok) return { ok: false as const, reason: await readError(listed) };
  const found = (await listed.json()) as { contacts?: Array<{ id: string }> };
  let contactId = found.contacts?.[0]?.id;
  if (!contactId) {
    const created = await fetchImpl("https://api.billysbilling.com/v2/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({
        contact: {
          name: invoice.customerName || "Kunde",
          type: "company",
          countryId: "DK",
          cityText: invoice.city,
          zipcodeText: invoice.postal,
          street: invoice.address,
          phone: invoice.phone,
          ...(settings.billy_org_id ? { organizationId: settings.billy_org_id } : {}),
        },
      }),
    });
    if (!created.ok) return { ok: false as const, reason: await readError(created) };
    contactId = ((await created.json()) as { contacts?: Array<{ id: string }> }).contacts?.[0]?.id;
  }
  if (!contactId) return { ok: false as const, reason: "Billy oprettede ikke kontakten." };
  const drafted = await fetchImpl("https://api.billysbilling.com/v2/invoices", {
    method: "POST",
    headers,
    body: JSON.stringify({
      invoice: {
        contactId,
        entryDate: day(invoice.issuedAt),
        currencyId: "DKK",
        ...(settings.billy_org_id ? { organizationId: settings.billy_org_id } : {}),
        lines: invoice.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPrice: kr(line.unitPrice),
        })),
      },
    }),
  });
  if (!drafted.ok) return { ok: false as const, reason: await readError(drafted) };
  const body = (await drafted.json()) as { invoices?: Array<{ id: string }> };
  return { ok: true as const, ref: body.invoices?.[0]?.id ? `billy:${body.invoices[0].id}` : "billy" };
}

async function dineroToken(settings: BookSettings, fetchImpl: typeof fetch) {
  const basic = Buffer.from(`${settings.dinero_client_id}:${settings.dinero_client_secret}`).toString("base64");
  const response = await fetchImpl("https://authz.dinero.dk/dineroapi/oauth/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "password",
      scope: "read write",
      username: settings.dinero_api_key,
      password: settings.dinero_api_key,
    }),
  });
  if (!response.ok) return { ok: false as const, reason: await readError(response) };
  const body = (await response.json()) as { access_token?: string };
  if (!body.access_token) return { ok: false as const, reason: "Dinero gav ikke et token." };
  return { ok: true as const, token: body.access_token };
}

async function bookDinero(settings: BookSettings, invoice: BookInvoice, fetchImpl: typeof fetch) {
  const token = await dineroToken(settings, fetchImpl);
  if (!token.ok) return token;
  const headers = { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" };
  const listed = await fetchImpl(
    `https://api.dinero.dk/v1/${settings.dinero_org_id}/contacts?queryFilter=Name+eq+'${encodeURIComponent(invoice.customerName)}'`,
    { headers },
  );
  if (!listed.ok) return { ok: false as const, reason: await readError(listed) };
  const found = (await listed.json()) as { Collection?: Array<{ ContactGuid: string }> };
  let contactGuid = found.Collection?.[0]?.ContactGuid;
  if (!contactGuid) {
    const created = await fetchImpl(`https://api.dinero.dk/v1/${settings.dinero_org_id}/contacts`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        Name: invoice.customerName || "Kunde",
        CountryKey: "DK",
        IsPerson: false,
        Street: invoice.address,
        ZipCode: invoice.postal,
        City: invoice.city,
        Email: invoice.email,
        Phone: invoice.phone,
      }),
    });
    if (!created.ok) return { ok: false as const, reason: await readError(created) };
    contactGuid = ((await created.json()) as { ContactGuid?: string }).ContactGuid;
  }
  if (!contactGuid) return { ok: false as const, reason: "Dinero oprettede ikke kontakten." };
  const drafted = await fetchImpl(`https://api.dinero.dk/v1/${settings.dinero_org_id}/invoices`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      Date: day(invoice.issuedAt),
      ContactGuid: contactGuid,
      Description: invoice.invoiceNumber,
      ProductLines: invoice.lines.map((line) => ({
        Description: line.description,
        Quantity: line.quantity,
        AccountNumber: 1000,
        Unit: "parts",
        BaseAmountValue: kr(line.unitPrice),
      })),
    }),
  });
  if (!drafted.ok) return { ok: false as const, reason: await readError(drafted) };
  const body = (await drafted.json()) as { Guid?: string };
  return { ok: true as const, ref: body.Guid ? `dinero:${body.Guid}` : "dinero" };
}
