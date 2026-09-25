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
        <p className="mt-2 text-sm text-muted">Sidst opdateret 25. september 2026</p>
        <div className="mt-8 space-y-5 text-[17px] leading-7">
          <p>
            Exempo er et ordrestyringssystem til håndværksvirksomheder. iOS-appen bruges af
            medarbejdere i marken og taler kun med jeres egen Exempo-server.
          </p>
          <h2 className="font-serif text-2xl">Dataansvarlig</h2>
          <p>
            Den virksomhed, der hoster Exempo og opretter medarbejderkonti, er dataansvarlig.
            Appen indsamler ikke data til Exempos udvikler ud over det, I selv sender til jeres
            server.
          </p>
          <h2 className="font-serif text-2xl">Hvad appen behandler</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Navn, e-mail og rolle på den indloggede medarbejder</li>
            <li>Arbejdssedler, kunder, adresser og telefonnumre der er tildelt medarbejderen</li>
            <li>Tid, materialer, ekstraarbejde og fravær, som medarbejderen registrerer</li>
            <li>Fotos af arbejdet, som medarbejderen selv tager eller vælger fra rullen</li>
          </ul>
          <h2 className="font-serif text-2xl">Kamera og billeder</h2>
          <p>
            Kameraet bruges til dokumentationsfotos og til at scanne stregkoder på materialer.
            Billeder uploades til jeres Exempo-server og knyttes til sagen. Appen sælger ikke
            billeder og bruger ikke dem til annoncer.
          </p>
          <h2 className="font-serif text-2xl">Lagring på telefonen</h2>
          <p>
            Login-token gemmes i iOS Keychain. Serveradresse gemmes lokalt på enheden. Der
            trackes ikke på tværs af apps, og der bruges ikke reklame-id.
          </p>
          <h2 className="font-serif text-2xl">Videregivelse</h2>
          <p>
            Appen videregiver ikke oplysninger til tredjeparter. Trafik går via HTTPS til den
            server, I selv angiver i indstillinger.
          </p>
          <h2 className="font-serif text-2xl">Rettigheder</h2>
          <p>
            Medarbejdere kan bede deres arbejdsgiver om indsigt, berigtigelse eller sletning
            efter databeskyttelsesreglerne. Slet kontoen ved at kontakte virksomhedens
            administrator.
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
