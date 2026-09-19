import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Input, Label } from "@/components/ui";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
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
            Ordrestyring til håndværk — samme flow som Minuba, fra tilbud til dækningsgrad.
          </p>
        </div>
        <form action={loginAction} className="rounded-3xl bg-paper p-8 shadow-2xl">
          <h2 className="font-serif text-2xl">Log ind</h2>
          <p className="mt-1 text-sm text-muted">Demo: admin@exempo.dk / exempo123</p>
          {error ? (
            <p className="mt-4 rounded-xl bg-[#f3d7d4] px-3 py-2 text-sm text-[#7c2f2a]">{error}</p>
          ) : null}
          <div className="mt-6 space-y-4">
            <label className="block">
              <Label>E-mail</Label>
              <Input id="email" name="email" type="email" defaultValue="pl@exempo.dk" required autoComplete="username" />
            </label>
            <label className="block">
              <Label>Adgangskode</Label>
              <Input id="password" name="password" type="password" defaultValue="exempo123" required autoComplete="current-password" />
            </label>
            <SubmitButton>Fortsæt</SubmitButton>
          </div>
          <div className="mt-6 grid gap-2 text-sm text-muted">
            <p>Projektleder: pl@exempo.dk</p>
            <p>Tømrer: lars@exempo.dk</p>
            <p>Alle koder: exempo123</p>
          </div>
        </form>
      </div>
    </div>
  );
}
