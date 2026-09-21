import { createCompanyAction } from "@/app/actions/tenants";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorFlash } from "@/components/Flash";
import { Input, Label } from "@/components/ui";
import Link from "next/link";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="min-h-screen bg-pine">
      <div className="mx-auto max-w-xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.28em] text-[#d7c9a8]">Exempo</p>
        <h1 className="mt-3 font-serif text-4xl text-[#f4efe4]">Opret virksomhed</h1>
        <p className="mt-3 text-[#e4d8c0]">
          I får jeres egen database. Alle virksomheder logger ind med deres egen e-mail.
        </p>
        <form action={createCompanyAction} className="mt-8 space-y-4 rounded-3xl bg-paper p-8 shadow-2xl">
          <ErrorFlash message={error} />
          <label className="block">
            <Label>Virksomhedsnavn</Label>
            <Input name="name" required placeholder="Nordbyg ApS" />
          </label>
          <label className="block">
            <Label>Kort navn (database)</Label>
            <Input name="slug" placeholder="nordbyg" />
          </label>
          <label className="block">
            <Label>Administrator</Label>
            <Input name="adminName" required placeholder="Navn" />
          </label>
          <label className="block">
            <Label>E-mail</Label>
            <Input name="adminEmail" type="email" required placeholder="dig@ditfirma.dk" />
          </label>
          <label className="block">
            <Label>Adgangskode</Label>
            <Input name="adminPassword" type="password" required minLength={8} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <Label>Sagsnummer-præfiks</Label>
              <Input name="casePrefix" placeholder="Tomt = 00001" />
            </label>
            <label className="block">
              <Label>Cifre</Label>
              <Input name="caseDigits" type="number" defaultValue="5" min={1} max={8} />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="caseIncludeYear" value="1" className="rounded border-line" />
            Inkludér årstal i sagsnummer
          </label>
          <SubmitButton>Opret og gå til login</SubmitButton>
          <p className="text-sm text-muted">
            Har I allerede en konto?{" "}
            <Link href="/login" className="underline">
              Log ind
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
