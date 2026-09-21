import type { MailAccount } from "@prisma/client";
import { MAIL_PURPOSE_LABELS, MAIL_PURPOSES } from "@/lib/catalog";
import { Input, Label, Select } from "@/components/ui";

export function MailAccountFields({
  account,
  domain = "firma.dk",
}: {
  account?: MailAccount | null;
  domain?: string;
}) {
  const hostPlaceholder = `mail.${domain || "firma.dk"}`;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block">
        <Label>Visningsnavn</Label>
        <Input name="name" placeholder="Faktura" defaultValue={account?.name ?? ""} />
      </label>
      <label className="block">
        <Label>Adresse</Label>
        <Input
          name="address"
          type="email"
          required
          placeholder={`faktura@${domain || "firma.dk"}`}
          defaultValue={account?.address ?? ""}
        />
      </label>
      <label className="block">
        <Label>Formål</Label>
        <Select name="purpose" defaultValue={account?.purpose ?? "FAKTURA"}>
          {MAIL_PURPOSES.map((purpose) => (
            <option key={purpose} value={purpose}>
              {MAIL_PURPOSE_LABELS[purpose]}
            </option>
          ))}
        </Select>
      </label>
      <label className="block">
        <Label>SMTP-vært</Label>
        <Input name="smtpHost" placeholder={hostPlaceholder} defaultValue={account?.smtpHost ?? ""} />
      </label>
      <label className="block">
        <Label>SMTP-port</Label>
        <Input name="smtpPort" defaultValue={account?.smtpPort ?? "587"} />
      </label>
      <label className="block">
        <Label>SMTP-bruger</Label>
        <Input name="smtpUser" defaultValue={account?.smtpUser ?? ""} placeholder={account?.address ?? ""} />
      </label>
      <label className="block">
        <Label>SMTP-adgangskode</Label>
        <Input
          name="smtpPassword"
          type="password"
          autoComplete="new-password"
          placeholder={account?.smtpPassword ? "Efterlad tom for at beholde" : ""}
        />
      </label>
      <label className="block">
        <Label>SMTP-kryptering</Label>
        <Select name="smtpEncryption" defaultValue={account?.smtpEncryption || "tls"}>
          <option value="tls">TLS (port 587)</option>
          <option value="ssl">SSL (port 465)</option>
          <option value="none">Ingen</option>
        </Select>
      </label>
      <label className="block">
        <Label>IMAP-vært</Label>
        <Input name="imapHost" placeholder={hostPlaceholder} defaultValue={account?.imapHost ?? ""} />
      </label>
      <label className="block">
        <Label>IMAP-port</Label>
        <Input name="imapPort" defaultValue={account?.imapPort ?? "993"} />
      </label>
      <label className="block">
        <Label>IMAP-bruger</Label>
        <Input name="imapUser" defaultValue={account?.imapUser ?? ""} placeholder={account?.address ?? ""} />
      </label>
      <label className="block">
        <Label>IMAP-adgangskode</Label>
        <Input
          name="imapPassword"
          type="password"
          autoComplete="new-password"
          placeholder={account?.imapPassword ? "Efterlad tom for at beholde" : ""}
        />
      </label>
      <label className="block">
        <Label>IMAP-mappe</Label>
        <Input name="imapFolder" defaultValue={account?.imapFolder ?? "INBOX"} />
      </label>
    </div>
  );
}
