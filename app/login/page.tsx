import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { ErrorFlash } from "@/components/Flash";
import { Input, Label } from "@/components/ui";
import Link from "next/link";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string }>;
}) {
  const { error, created } = await searchParams;
  return (
    <div className="min-h-screen bg-pine">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-2">
        <div className="text-[#f4efe4]">
          <p className="text-xs uppercase tracking-[0.28em] text-[#d7c9a8]">Exempo</p>
          <h1 className="mt-3 font-serif text-5xl leading-tight">
            Tilbud. Arbejdssedler.
            <br />
            Planlægning. Faktura.
          </h1>
          <p className="mt-5 max-w-md text-lg text-[#e4d8c0]">
            Én indgang til alle virksomheder. Hver virksomhed får sin egen database.
          </p>
        </div>
        <form action={loginAction} className="rounded-3xl bg-paper p-8 shadow-2xl">
          <h2 className="font-serif text-2xl">Log ind</h2>
          <p className="mt-1 text-sm text-muted">Demo: admin@exempo.dk / exempo123</p>
          {created ? (
            <p className="mt-4 rounded-xl bg-[#e7efe8] px-3 py-2 text-sm text-[#1f4a3a]">
              Virksomheden er oprettet. Log ind med administratorens e-mail.
            </p>
          ) : null}
          <ErrorFlash message={error} />
          <div className="mt-6 space-y-4">
            <label className="block">
              <Label>E-mail</Label>
              <Input id="email" name="email" type="email" required autoComplete="username" />
            </label>
            <label className="block">
              <Label>Adgangskode</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </label>
            <SubmitButton>Fortsæt</SubmitButton>
          </div>
          <p className="mt-6 text-sm text-muted">
            Ny virksomhed?{" "}
            <Link href="/opret" className="underline">
              Opret her
            </Link>
          </p>
          <div className="mt-4 grid gap-2 text-sm text-muted">
            <p>Projektleder: pl@exempo.dk</p>
            <p>Tømrer: lars@exempo.dk</p>
            <p>Alle demokoder: exempo123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
