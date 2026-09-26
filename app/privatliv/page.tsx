import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privatlivspolitik — Exempo",
  description: "Sådan behandler Exempo-appen personoplysninger.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-paper px-6 py-12 text-ink">
      <div className="mx-auto max-w-2xl">
        <p className="text-xs uppercase tracking-[0.28em] text-muted">Exempo</p>
        <h1 className="mt-3 font-serif text-4xl">Privatlivspolitik</h1>
        <p className="mt-2 text-sm text-muted">Sidst opdateret 26. september 2026</p>
        <div className="mt-8 space-y-5 text-[17px] leading-7">
          <p>
            Exempo-appen viser det samme ordrestyringssystem som på https://exempo.jbnet.dk.
            Medarbejdere logger ind og arbejder med sager, kalender, tid, materialer og faktura
            hos den virksomhed, der hoster Exempo.
          </p>
          <h2 className="font-serif text-2xl">Dataansvarlig</h2>
          <p>
            Den virksomhed, der hoster Exempo og opretter medarbejderkonti, er dataansvarlig.
            Appen indsamler ikke data til tracking eller annoncer.
          </p>
          <h2 className="font-serif text-2xl">Hvad appen behandler</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Navn, e-mail og rolle på den indloggede bruger</li>
            <li>Sager, kunder, kalender, tid, materialer, tilbud og fakturaer I selv opretter</li>
            <li>Fotos, som brugeren selv tager eller vælger fra rullen</li>
          </ul>
          <h2 className="font-serif text-2xl">Kamera og billeder</h2>
          <p>
            Kameraet bruges til dokumentationsfotos på arbejdssedlen. Billeder uploades til
            jeres Exempo-server. Appen sælger ikke billeder.
          </p>
          <h2 className="font-serif text-2xl">Videregivelse</h2>
          <p>
            Trafik går via HTTPS til https://exempo.jbnet.dk. Appen videregiver ikke oplysninger
            til tredjeparter til annoncer.
          </p>
          <p>
            Spørgsmål:{" "}
            <a className="underline" href="mailto:dvaergen98@gmail.com">
              dvaergen98@gmail.com
            </a>
          </p>
        </div>
        <p className="mt-10 text-sm text-muted">
          <Link href="/stoette" className="underline">
            Support
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
