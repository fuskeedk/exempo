import type { WholesalerAgreement } from "@prisma/client";
import { Input, Label, Textarea } from "@/components/ui";
import { toDateInput } from "@/lib/dates";

export function WholesalerFields({ agreement }: { agreement?: WholesalerAgreement | null }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <Label>Navn</Label>
        <Input name="name" required defaultValue={agreement?.name ?? ""} placeholder="STARK" />
      </label>
      <label className="block">
        <Label>Aftalenummer</Label>
        <Input name="agreementNumber" defaultValue={agreement?.agreementNumber ?? ""} />
      </label>
      <label className="block">
        <Label>Rabatperiode (dato)</Label>
        <Input name="discountUntil" type="date" defaultValue={agreement?.discountUntil ? toDateInput(agreement.discountUntil) : ""} />
      </label>
      <label className="block">
        <Label>EDI modtaget</Label>
        <Input name="ediReceivedAt" type="date" defaultValue={agreement?.ediReceivedAt ? toDateInput(agreement.ediReceivedAt) : ""} />
      </label>
      <label className="block">
        <Label>Grossistlistepris (dato)</Label>
        <Input name="listPriceAt" type="date" defaultValue={agreement?.listPriceAt ? toDateInput(agreement.listPriceAt) : ""} />
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="ediEnabled" value="1" defaultChecked={agreement?.ediEnabled} />
        EDI opsat
      </label>
      <label className="flex items-center gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="excludedFromSearch" value="1" defaultChecked={agreement?.excludedFromSearch} />
        Udelukket fra varesøgning
      </label>
      <p className="sm:col-span-2 text-sm text-muted">
        Hos AO Johansen betyder det AO-kataloget på arbejdssedlen. Lad feltet være slået fra for at søge varenr. og stregkode hos AO. Aftalenummer kan være AO-kundenummeret, hvis I har et.
      </p>
      <label className="block sm:col-span-2">
        <Label>Login / grossist-link</Label>
        <Input name="loginUrl" defaultValue={agreement?.loginUrl ?? ""} placeholder="https://ao.dk" />
      </label>
      <label className="block">
        <Label>Brugernavn</Label>
        <Input name="username" defaultValue={agreement?.username ?? ""} autoComplete="off" />
      </label>
      <label className="block">
        <Label>Adgangskode</Label>
        <Input
          name="password"
          type="password"
          placeholder={agreement?.password ? "Efterlad tom for at beholde" : ""}
          autoComplete="new-password"
        />
      </label>
      <label className="block sm:col-span-2">
        <Label>Note</Label>
        <Textarea name="note" rows={2} defaultValue={agreement?.note ?? ""} />
      </label>
    </div>
  );
}
