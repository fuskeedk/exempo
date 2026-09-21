import {
  createMailAccountAction,
  deleteMailAccountAction,
  removeCompanyLogoAction,
  saveAccountingSettingsAction,
  saveCompanySettingsAction,
  saveModulesSettingsAction,
  saveNumberSettingsAction,
  savePayrollSettingsAction,
  saveSproomSettingsAction,
  sendTestMailAction,
  testIntegrationAction,
  updateMailAccountAction,
  updateProfileAction,
} from "@/app/actions/settings";
import {
  createKlsTemplateAction,
  deleteKlsTemplateAction,
} from "@/app/actions/kls";
import {
  createWholesalerAction,
  deleteWholesalerAction,
  updateWholesalerAction,
} from "@/app/actions/wholesalers";
import { AdminTabs } from "@/components/AdminTabs";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";
import { Flash, ErrorFlash } from "@/components/Flash";
import { MailAccountFields } from "@/components/MailAccountFields";
import { NumberPreview } from "@/components/NumberPreview";
import { TourHelpButton } from "@/components/OnboardingTour";
import { SubmitButton } from "@/components/SubmitButton";
import { Card, GhostLink, Input, Label, PageHeader, Select } from "@/components/ui";
import { WholesalerFields } from "@/components/WholesalerFields";
import { requireRole } from "@/lib/auth";
import { MAIL_PURPOSE_LABELS } from "@/lib/catalog";
import { formatDate, formatDateTime, formatNumericDate } from "@/lib/dates";
import { ensureDefaultKlsTemplates, KLS_TRADE_OPTIONS, klsTradeLabel } from "@/lib/kls-catalog";
import { companyLogoSrc } from "@/lib/logo";
import { appUrl } from "@/lib/platform";
import { prisma } from "@/lib/prisma";
import { SECRET_SETTING_KEYS, getSettings, productCatalogEnabled, vanStockEnabled } from "@/lib/settings";
import { payPeriodBounds, payPeriodFromSettings } from "@/lib/timesheets";

function secretHint(key: string, settings: Record<string, string>) {
  return SECRET_SETTING_KEYS.has(key) && settings[key] ? "Efterlad tom for at beholde den gemte nøgle" : "";
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ besked?: string; fejl?: string; rediger?: string; mail?: string }>;
}) {
  const user = await requireRole(["ADMIN", "PL"]);
  const { besked, fejl, rediger, mail } = await searchParams;
  await ensureDefaultKlsTemplates(prisma);
  const [settings, mailAccounts, me, wholesalers, klsTemplates] = await Promise.all([
    getSettings(),
    prisma.mailAccount.findMany({ orderBy: { address: "asc" } }),
    prisma.user.findUnique({ where: { id: user.id } }),
    prisma.wholesalerAgreement.findMany({ orderBy: { name: "asc" } }),
    prisma.klsTemplate.findMany({ include: { items: { orderBy: { sortOrder: "asc" } }, _count: { select: { reports: true } } }, orderBy: { name: "asc" } }),
  ]);
  const editing = wholesalers.find((row) => row.id === rediger) ?? null;
  const editingMail = mailAccounts.find((row) => row.id === mail) ?? null;
  const webhook = `${appUrl()}/api/sproom/${user.tenantSlug}`;
  const currentPay = payPeriodBounds(new Date(), payPeriodFromSettings(settings));

  return (
    <>
      <PageHeader
        kicker="Administration"
        title="Indstillinger"
        description="Virksomhed, sagsnumre, mail, grossistaftaler, Sproom, løn og bogføring — kun for denne virksomheds database."
      />
      <AdminTabs />
      <Flash message={besked} />
      <ErrorFlash message={fejl} />
      <nav className="mb-6 flex flex-wrap gap-2 text-sm">
        {[
          ["#virksomhed", "Virksomhed"],
          ["#moduler", "Moduler"],
          ["#kls", "KLS-skemaer"],
          ["#profil", "Din bruger"],
          ["#numre", "Sagsnumre"],
          ["#mail", "Mailkonti"],
          ["#grossist", "Grossistaftaler"],
          ["#sproom", "Sproom"],
          ["#lon", "Danløn / Dataløn"],
          ["#bogforing", "E-conomic / Billy / Dinero"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-line bg-white px-3 py-1.5 hover:bg-paper">
            {label}
          </a>
        ))}
      </nav>

      <div className="space-y-6">
        <Card id="virksomhed" tour="tour-virksomhed">
          <h2 className="font-serif text-xl">Virksomhed</h2>
          <p className="mt-1 text-sm text-muted">
            Vises i menuen og på dokumenter. Bankoplysninger kommer med på fakturaer. Gælder kun jeres database.
          </p>
          <form action={saveCompanySettingsAction} encType="multipart/form-data" className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <Label>Navn</Label>
              <Input name="company_name" defaultValue={settings.company_name} />
            </label>
            <div className="sm:col-span-2 rounded-2xl border border-line bg-white p-4">
              <Label>Firmalogo</Label>
              <p className="mb-3 text-sm text-muted">
                Vises på tilbud, kundelink, tilbudsmail, faktura og i menuen. PNG, JPG eller WebP, højst 2 MB.
              </p>
              {settings.company_logo ? (
                <div className="mb-3 flex flex-wrap items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={companyLogoSrc(user.tenantSlug, settings.company_logo)}
                    alt="Firmalogo"
                    className="max-h-16 max-w-[220px] object-contain"
                  />
                  <button
                    type="submit"
                    formAction={removeCompanyLogoAction}
                    formNoValidate
                    className="text-sm font-semibold text-[#7c2f2a] hover:underline"
                  >
                    Fjern logo
                  </button>
                </div>
              ) : null}
              <Input name="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Firmalogo" />
            </div>
            <label className="block">
              <Label>CVR</Label>
              <Input name="company_cvr" defaultValue={settings.company_cvr} />
            </label>
            <label className="block">
              <Label>Telefon</Label>
              <Input name="company_phone" type="tel" inputMode="tel" defaultValue={settings.company_phone} />
            </label>
            <AddressAutocomplete
              streetName="company_address"
              postalName="company_postal"
              cityName="company_city"
              defaultStreet={settings.company_address}
              defaultPostal={settings.company_postal}
              defaultCity={settings.company_city}
            />
            <label className="block">
              <Label>E-mail</Label>
              <Input name="company_email" type="email" defaultValue={settings.company_email} />
            </label>
            <label className="block">
              <Label>Domæne</Label>
              <Input name="company_domain" placeholder="firma.dk" defaultValue={settings.company_domain} />
            </label>
            <p className="sm:col-span-2 pt-2 font-medium">Bank</p>
            <p className="sm:col-span-2 -mt-3 text-sm text-muted">
              Bruges på fakturaer, så kunden kan se, hvor beløbet skal overføres.
            </p>
            <label className="block sm:col-span-2">
              <Label>Bank</Label>
              <Input name="company_bank_name" placeholder="Danske Bank" defaultValue={settings.company_bank_name} />
            </label>
            <label className="block">
              <Label>Reg.nr.</Label>
              <Input name="company_bank_reg" placeholder="1234" defaultValue={settings.company_bank_reg} />
            </label>
            <label className="block">
              <Label>Kontonr.</Label>
              <Input name="company_bank_account" placeholder="1234567890" defaultValue={settings.company_bank_account} />
            </label>
            <label className="block">
              <Label>IBAN</Label>
              <Input name="company_bank_iban" placeholder="DK00 0000 0000 0000 00" defaultValue={settings.company_bank_iban} />
            </label>
            <label className="block">
              <Label>SWIFT / BIC</Label>
              <Input name="company_bank_swift" placeholder="DABADKKK" defaultValue={settings.company_bank_swift} />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton>Gem virksomhed</SubmitButton>
            </div>
          </form>
        </Card>

        <Card id="moduler">
          <h2 className="font-serif text-xl">Moduler</h2>
          <p className="mt-1 text-sm text-muted">
            Varekatalog og vognlager er slået fra som standard. AO-søgning på arbejdssedlen virker alligevel. Slå et modul til, hvis I selv vil holde lager.
          </p>
          <form action={saveModulesSettingsAction} className="mt-4 space-y-3">
            <label className="flex items-start gap-3 text-sm">
              <input type="hidden" name="feature_product_catalog" value="0" />
              <input
                type="checkbox"
                name="feature_product_catalog"
                value="1"
                defaultChecked={productCatalogEnabled(settings)}
                className="mt-1"
              />
              <span>
                <strong>Varekatalog</strong>
                <span className="block text-muted">Egne varer med varenr., stregkode og lager under menuen Varer.</span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="hidden" name="feature_van_stock" value="0" />
              <input
                type="checkbox"
                name="feature_van_stock"
                value="1"
                defaultChecked={vanStockEnabled(settings)}
                className="mt-1"
              />
              <span>
                <strong>Vognlager</strong>
                <span className="block text-muted">Læg varer i bilen og træk dem på sagen. Kræver varekatalog.</span>
              </span>
            </label>
            <SubmitButton>Gem moduler</SubmitButton>
          </form>
        </Card>

        <Card id="kls">
          <h2 className="font-serif text-xl">KLS-skemaer</h2>
          <p className="mt-1 text-sm text-muted">
            Tjeklisterne vises på arbejdssedlen, når I tilføjer KLS. Standardskemaer for hvert fag ligger klar, og I kan lave jeres egne.
          </p>
          <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-white">
            {klsTemplates.map((template) => (
              <li key={template.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{template.name}</p>
                  <p className="text-muted">
                    {klsTradeLabel(template.trade)} · {template.items.length} punkter
                    {template._count.reports > 0 ? ` · bruges på ${template._count.reports} sag${template._count.reports === 1 ? "" : "er"}` : ""}
                  </p>
                </div>
                {template._count.reports === 0 ? (
                  <form action={deleteKlsTemplateAction}>
                    <input type="hidden" name="id" value={template.id} />
                    <button type="submit" className="text-sm font-semibold text-[#7c2f2a] hover:underline">
                      Slet
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
          <form action={createKlsTemplateAction} className="mt-5 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <Label>Navn</Label>
              <Input name="name" placeholder="KLS — VVS, lejlighed" required />
            </label>
            <label className="block">
              <Label>Fag</Label>
              <Select name="trade" defaultValue="ANDET">
                {KLS_TRADE_OPTIONS.map((trade) => (
                  <option key={trade} value={trade}>
                    {klsTradeLabel(trade)}
                  </option>
                ))}
              </Select>
            </label>
            <label className="block sm:col-span-2">
              <Label>Tjekpunkter (ét pr. linje)</Label>
              <textarea
                name="items"
                rows={6}
                required
                placeholder={"Foto før\nArbejde udført efter beskrivelse\nFoto efter"}
                className="w-full rounded-xl border border-line bg-white px-3 py-2.5 text-ink outline-none ring-pine/20 focus:ring-2"
              />
            </label>
            <div>
              <SubmitButton>Opret skema</SubmitButton>
            </div>
          </form>
        </Card>

        <Card id="profil">
          <h2 className="font-serif text-xl">Din bruger</h2>
          <form action={updateProfileAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <Label>Navn</Label>
              <Input name="name" defaultValue={me?.name ?? user.name} required />
            </label>
            <label className="block">
              <Label>E-mail</Label>
              <Input name="email" type="email" defaultValue={me?.email ?? user.email} required />
            </label>
            <label className="block">
              <Label>Telefon</Label>
              <Input name="phone" defaultValue={me?.phone ?? ""} />
            </label>
            <label className="block">
              <Label>Ny adgangskode</Label>
              <Input name="password" type="password" placeholder="Tom = uændret" />
            </label>
            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <SubmitButton>Gem min bruger</SubmitButton>
              <TourHelpButton className="text-sm text-pine-2 underline-offset-4 hover:underline" />
            </div>
          </form>
        </Card>

        <Card id="numre">
          <h2 className="font-serif text-xl">Sagsnumre</h2>
          <p className="mt-1 text-sm text-muted">
            Lad præfiks være tomt, hvis numrene skal starte på 00001 i stedet for EX-00001.
          </p>
          <form action={saveNumberSettingsAction} className="mt-4 space-y-6">
            <NumberPreview
              prefix={settings.case_number_prefix}
              includeYear={settings.case_number_year !== "0"}
              digits={settings.case_number_digits}
              next={settings.case_number_next}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <Label>Tilbuds-præfiks</Label>
                <Input name="quote_number_prefix" defaultValue={settings.quote_number_prefix} />
              </label>
              <label className="block">
                <Label>Tilbud: år</Label>
                <Select name="quote_number_year" defaultValue={settings.quote_number_year}>
                  <option value="0">Nej</option>
                  <option value="1">Ja</option>
                </Select>
              </label>
              <label className="block">
                <Label>Tilbud: cifre / næste</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="quote_number_digits" defaultValue={settings.quote_number_digits} />
                  <Input name="quote_number_next" defaultValue={settings.quote_number_next} />
                </div>
              </label>
              <label className="block">
                <Label>Faktura-præfiks</Label>
                <Input name="invoice_number_prefix" defaultValue={settings.invoice_number_prefix} />
              </label>
              <label className="block">
                <Label>Faktura: år</Label>
                <Select name="invoice_number_year" defaultValue={settings.invoice_number_year}>
                  <option value="0">Nej</option>
                  <option value="1">Ja</option>
                </Select>
              </label>
              <label className="block">
                <Label>Faktura: cifre / næste</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input name="invoice_number_digits" defaultValue={settings.invoice_number_digits} />
                  <Input name="invoice_number_next" defaultValue={settings.invoice_number_next} />
                </div>
              </label>
            </div>
            <SubmitButton>Gem nummerserier</SubmitButton>
          </form>
        </Card>

        <Card id="mail">
          <h2 className="font-serif text-xl">Mailkonti</h2>
          <p className="mt-1 text-sm text-muted">
            Tilbudsmail sendes fra kontoen med formål Tilbud (ellers Generel). Udfyld SMTP for at sende, og IMAP for at
            hente kundens svar (Godkendt / Nej tak). Brug <strong>Send testmail</strong> for at tjekke, at kontoen virker.
          </p>
          {mailAccounts.length ? (
            <ul className="mt-4 divide-y divide-line">
              {mailAccounts.map((account) => (
                <li
                  key={account.id}
                  className={`flex flex-wrap items-center justify-between gap-3 py-3 text-sm ${
                    editingMail?.id === account.id ? "rounded-xl bg-white px-3" : ""
                  }`}
                >
                  <div>
                    <p className="font-medium">{account.address}</p>
                    <p className="text-muted">
                      {account.name} · {MAIL_PURPOSE_LABELS[account.purpose as keyof typeof MAIL_PURPOSE_LABELS] ?? account.purpose}
                      {account.imapHost ? ` · IMAP ${account.imapHost}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={sendTestMailAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="id" value={account.id} />
                      <Input
                        name="to"
                        type="email"
                        defaultValue={user.email}
                        aria-label="Send test til"
                        className="w-52"
                        required
                      />
                      <SubmitButton variant="secondary" pendingLabel="Sender…">
                        Send testmail
                      </SubmitButton>
                    </form>
                    {editingMail?.id === account.id ? (
                      <GhostLink href="/indstillinger#mail">Annuller</GhostLink>
                    ) : (
                      <a href={`/indstillinger?mail=${account.id}#mail`} className="text-pine-2 underline">
                        Rediger
                      </a>
                    )}
                    <form action={deleteMailAccountAction}>
                      <input type="hidden" name="id" value={account.id} />
                      <SubmitButton variant="ghost">Fjern</SubmitButton>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">Ingen mailkonti endnu.</p>
          )}
          <div className="mt-6 rounded-xl border border-line bg-white p-4">
            <h3 className="font-serif text-lg">
              {editingMail ? `Rediger ${editingMail.address}` : "Ny mailkonto"}
            </h3>
            <form
              action={editingMail ? updateMailAccountAction : createMailAccountAction}
              className="mt-4 space-y-4"
            >
              {editingMail ? <input type="hidden" name="id" value={editingMail.id} /> : null}
              <MailAccountFields account={editingMail} domain={settings.company_domain} />
              <div className="flex flex-wrap gap-2">
                <SubmitButton>{editingMail ? "Gem mailkonto" : "Tilføj mailkonto"}</SubmitButton>
                {editingMail ? <GhostLink href="/indstillinger#mail">Annuller</GhostLink> : null}
              </div>
            </form>
          </div>
        </Card>

        <Card id="grossist">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl">Grossistaftaler</h2>
              <p className="mt-1 text-sm text-muted">
                Aftalenumre, EDI og rabatperiode hos AO, STARK, Bygma og de øvrige grossister. AO-varesøgning på arbejdssedlen er slået til, så længe AO ikke er udelukket fra varesøgning. Nettopriser kommer med fakturaen — indtil da sættes indkøb og salg manuelt.
              </p>
            </div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted">
                <tr>
                  <th className="py-2 pr-3">Navn</th>
                  <th className="py-2 pr-3">Udelukket fra søgning</th>
                  <th className="py-2 pr-3">Aftalenummer</th>
                  <th className="py-2 pr-3">Rabatperiode</th>
                  <th className="py-2 pr-3">EDI</th>
                  <th className="py-2 pr-3">EDI modtaget</th>
                  <th className="py-2 pr-3">Listepris</th>
                  <th className="py-2">Handlinger</th>
                </tr>
              </thead>
              <tbody>
                {wholesalers.length === 0 ? (
                  <tr>
                    <td className="py-6 text-muted" colSpan={8}>
                      Ingen grossistaftaler endnu. Opret fx STARK eller AO nedenfor.
                    </td>
                  </tr>
                ) : (
                  wholesalers.map((row) => (
                    <tr key={row.id} className="border-t border-line align-top">
                      <td className="py-3 pr-3 font-medium">{row.name}</td>
                      <td className="py-3 pr-3">{row.excludedFromSearch ? "Ja" : "Nej"}</td>
                      <td className="py-3 pr-3">{row.agreementNumber || "—"}</td>
                      <td className="py-3 pr-3">{row.discountUntil ? formatDate(row.discountUntil) : "—"}</td>
                      <td className="py-3 pr-3">{row.ediEnabled ? "Opsat" : "Ikke opsat"}</td>
                      <td className="py-3 pr-3">{row.ediReceivedAt ? formatDateTime(row.ediReceivedAt) : "—"}</td>
                      <td className="py-3 pr-3">{row.listPriceAt ? formatDate(row.listPriceAt) : "—"}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {row.loginUrl ? (
                            <a href={row.loginUrl} target="_blank" rel="noreferrer" className="text-pine-2 underline">
                              Gå til grossist
                            </a>
                          ) : null}
                          <a href={`/indstillinger?rediger=${row.id}#grossist`} className="text-pine-2 underline">
                            Indstillinger
                          </a>
                          <form action={deleteWholesalerAction}>
                            <input type="hidden" name="id" value={row.id} />
                            <SubmitButton variant="ghost">Slet</SubmitButton>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-6 rounded-xl border border-line bg-white p-4">
            <h3 className="font-serif text-lg">{editing ? `Rediger ${editing.name}` : "Opret ny grossistaftale"}</h3>
            <form action={editing ? updateWholesalerAction : createWholesalerAction} className="mt-4 space-y-4">
              {editing ? <input type="hidden" name="id" value={editing.id} /> : null}
              <WholesalerFields agreement={editing} />
              <div className="flex flex-wrap gap-2">
                <SubmitButton>{editing ? "Gem aftale" : "Opret aftale"}</SubmitButton>
                {editing ? <GhostLink href="/indstillinger#grossist">Annuller</GhostLink> : null}
              </div>
            </form>
          </div>
        </Card>

        <Card id="sproom">
          <h2 className="font-serif text-xl">Sproom</h2>
          <p className="mt-1 text-sm text-muted">
            E-fakturaer lander i Indkøb. Webhook: <code className="text-xs">{webhook}</code>
          </p>
          <form action={saveSproomSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex items-center gap-2 sm:col-span-2 text-sm">
              <input type="checkbox" name="sproom_enabled" value="1" defaultChecked={settings.sproom_enabled === "1"} />
              Aktivér Sproom
            </label>
            <label className="block sm:col-span-2">
              <Label>API-token</Label>
              <Input
                name="sproom_api_token"
                type="password"
                placeholder={secretHint("sproom_api_token", settings)}
              />
            </label>
            <label className="block sm:col-span-2">
              <Label>Webhook-hemmelighed</Label>
              <Input
                name="sproom_webhook_secret"
                type="password"
                placeholder={secretHint("sproom_webhook_secret", settings) || "Udfyld for at sætte en ny"}
              />
            </label>
            <div className="flex flex-wrap gap-2 sm:col-span-2">
              <SubmitButton>Gem Sproom</SubmitButton>
            </div>
          </form>
          <form action={testIntegrationAction} className="mt-3">
            <input type="hidden" name="kind" value="sproom" />
            <SubmitButton variant="secondary">Tjek opsætning</SubmitButton>
          </form>
        </Card>

        <Card id="lon">
          <h2 className="font-serif text-xl">Lønperiode og Danløn / Dataløn</h2>
          <p className="mt-1 text-sm text-muted">
            Lønperioden vises på timesedler. Standard er den 20. til den 21. næste måned. Timesedler afleveres under Timesedler og godkendes under Løn.
          </p>
          <p className="mt-2 text-sm">
            <a href="/timesedler?periode=LONPERIODE" className="text-pine-2 underline-offset-4 hover:underline">
              Åbn timesedler som lønperiode
            </a>
            {" · "}
            <a href="/lon" className="text-pine-2 underline-offset-4 hover:underline">
              Åbn løn og eksport
            </a>
            {" · "}
            <a href="/overenskomster" className="text-pine-2 underline-offset-4 hover:underline">
              Overenskomster
            </a>
          </p>
          <form action={savePayrollSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <Label>Lønperiode fra den</Label>
              <Input
                name="payroll_period_start_day"
                type="number"
                min={1}
                max={28}
                defaultValue={settings.payroll_period_start_day || "20"}
              />
              <p className="mt-1 text-xs text-muted">Startdag i måneden. Standard 20.</p>
            </label>
            <label className="block">
              <Label>til den næste måned</Label>
              <Input
                name="payroll_period_end_day"
                type="number"
                min={1}
                max={28}
                defaultValue={settings.payroll_period_end_day || "21"}
              />
              <p className="mt-1 text-xs text-muted">
                Slutdato næste måned. Standard 21. Aktuel periode: {formatNumericDate(currentPay.start)} – {formatNumericDate(currentPay.end)}.
              </p>
            </label>
            <label className="block sm:col-span-2">
              <Label>Udbyder</Label>
              <Select name="payroll_provider" defaultValue={settings.payroll_provider}>
                <option value="">Ingen</option>
                <option value="danlon">Danløn</option>
                <option value="dataloen">Dataløn</option>
              </Select>
            </label>
            <label className="block">
              <Label>Danløn virksomheds-id</Label>
              <Input name="danlon_company_id" defaultValue={settings.danlon_company_id} />
            </label>
            <label className="block">
              <Label>Danløn API-nøgle</Label>
              <Input name="danlon_api_key" type="password" placeholder={secretHint("danlon_api_key", settings)} />
            </label>
            <label className="block">
              <Label>Dataløn virksomheds-id</Label>
              <Input name="dataloen_company_id" defaultValue={settings.dataloen_company_id} />
            </label>
            <label className="block">
              <Label>Dataløn API-nøgle</Label>
              <Input name="dataloen_api_key" type="password" placeholder={secretHint("dataloen_api_key", settings)} />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton>Gem løn</SubmitButton>
            </div>
          </form>
          <div className="mt-3 flex gap-2">
            <form action={testIntegrationAction}>
              <input type="hidden" name="kind" value="danlon" />
              <SubmitButton variant="secondary">Tjek Danløn</SubmitButton>
            </form>
            <form action={testIntegrationAction}>
              <input type="hidden" name="kind" value="dataloen" />
              <SubmitButton variant="secondary">Tjek Dataløn</SubmitButton>
            </form>
          </div>
        </Card>

        <Card id="bogforing">
          <h2 className="font-serif text-xl">E-conomic / Billy / Dinero</h2>
          <form action={saveAccountingSettingsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <Label>Bogføringssystem</Label>
              <Select name="accounting_provider" defaultValue={settings.accounting_provider}>
                <option value="">Ingen</option>
                <option value="economic">E-conomic</option>
                <option value="billy">Billy</option>
                <option value="dinero">Dinero</option>
              </Select>
            </label>
            <label className="block">
              <Label>E-conomic aftale-token</Label>
              <Input
                name="economic_agreement_grant"
                type="password"
                placeholder={secretHint("economic_agreement_grant", settings)}
              />
            </label>
            <label className="block">
              <Label>E-conomic app secret</Label>
              <Input
                name="economic_app_secret"
                type="password"
                placeholder={secretHint("economic_app_secret", settings)}
              />
            </label>
            <label className="block">
              <Label>Billy API-nøgle</Label>
              <Input name="billy_api_key" type="password" placeholder={secretHint("billy_api_key", settings)} />
            </label>
            <label className="block">
              <Label>Billy organisations-id</Label>
              <Input name="billy_org_id" defaultValue={settings.billy_org_id} />
            </label>
            <label className="block">
              <Label>Dinero API-nøgle</Label>
              <Input name="dinero_api_key" type="password" placeholder={secretHint("dinero_api_key", settings)} />
            </label>
            <label className="block">
              <Label>Dinero organisations-id</Label>
              <Input name="dinero_org_id" defaultValue={settings.dinero_org_id} />
            </label>
            <label className="block">
              <Label>Dinero client id</Label>
              <Input name="dinero_client_id" defaultValue={settings.dinero_client_id} />
            </label>
            <label className="block">
              <Label>Dinero client secret</Label>
              <Input
                name="dinero_client_secret"
                type="password"
                placeholder={secretHint("dinero_client_secret", settings)}
              />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton>Gem bogføring</SubmitButton>
            </div>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {(["economic", "billy", "dinero"] as const).map((kind) => (
              <form key={kind} action={testIntegrationAction}>
                <input type="hidden" name="kind" value={kind} />
                <SubmitButton variant="secondary">
                  Tjek {kind === "economic" ? "E-conomic" : kind === "billy" ? "Billy" : "Dinero"}
                </SubmitButton>
              </form>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
