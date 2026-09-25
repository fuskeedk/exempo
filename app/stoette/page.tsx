import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — Exempo",
  description: "Hjælp til Exempo-appen og kontoret.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-12 text-ink">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs uppercase tracking-[0.28em] text-muted">Exempo</p>
        <h1 className="mt-3 font-serif text-4xl">Support</h1>
        <div className="mt-8 space-y-5 text-[17px] leading-7">
          <p>
            Exempo-appen er feltappen til Min dag: tid, materialer, foto, ekstraarbejde og
            fravær. Kontoret kører i browseren.
          </p>
          <h2 className="font-serif text-2xl">Kom i gang</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Åbn Indstillinger i appen og sæt jeres Exempo-server (https://…).</li>
            <li>Log ind med den e-mail, kontoret har oprettet.</li>
            <li>På Min dag ser du dagens arbejdssedler.</li>
          </ol>
          <h2 className="font-serif text-2xl">Demo</h2>
          <p>
            I en demo-installation: <code>lars@exempo.dk</code> / <code>exempo123</code>. I
            appen kan du også vælge «Prøv demo» uden server.
          </p>
          <h2 className="font-serif text-2xl">Kontakt</h2>
          <p>
            Skriv til{" "}
            <a className="underline" href="mailto:dvaergen98@gmail.com">
              dvaergen98@gmail.com
            </a>
          </p>
        </div>
        <p className="mt-10 text-sm text-muted">
          <Link href="/privatliv" className="underline">
            Privatlivspolitik
          </Link>
          {" · "}
          <Link href="/login" className="underline">
            Log ind
          </Link>
        </p>
      </div>
    </main>
  );
}
