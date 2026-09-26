import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support — Exempo",
  description: "Hjælp til Exempo på telefon og computer.",
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-12 text-ink">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs uppercase tracking-[0.28em] text-muted">Exempo</p>
        <h1 className="mt-3 font-serif text-4xl">Support</h1>
        <div className="mt-8 space-y-5 text-[17px] leading-7">
          <p>
            iPhone-appen er det samme Exempo som på computeren. Log ind med den konto, kontoret
            har oprettet.
          </p>
          <h2 className="font-serif text-2xl">Kom i gang</h2>
          <ol className="list-decimal space-y-2 pl-5">
            <li>Åbn appen. Den viser https://exempo.jbnet.dk.</li>
            <li>Log ind med e-mail og adgangskode.</li>
            <li>Brug menuen som på computeren: Min dag, arbejdssedler, kalender, kunder.</li>
          </ol>
          <h2 className="font-serif text-2xl">Demo</h2>
          <p>
            <code>lars@exempo.dk</code> / <code>exempo123</code> (montør). Projektleder:{" "}
            <code>pl@exempo.dk</code> / <code>exempo123</code>.
          </p>
          <h2 className="font-serif text-2xl">Kontakt</h2>
          <p>
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
