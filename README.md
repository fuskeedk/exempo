# Exempo — ordrestyring

Ordrestyring til håndværk i samme spor som Minuba: tilbud, arbejdssedler, planlægning, tid, materialer, KLS, faktura og dækningsgrad.

## Kør lokalt

```bash
cp .env.example .env
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000).

## Windows .exe

På en Windows-PC kan du køre Exempo uden at installere Node eller Git:

1. Hent `Exempo-windows.zip` fra GitHub Actions på branchen (kør *Windows exe*, download artifact).
2. Pak **hele mappen** ud.
3. Dobbeltklik `Exempo.exe`.
4. Log ind med `pl@exempo.dk` / `exempo123`.

Byg selv:

```bash
npm run package:win
```

Zip-filen ligger i `dist/Exempo-windows.zip`. Windows kan advare om en usigneret fil — vælg *Flere oplysninger* → *Kør alligevel*.

| Rolle | Login | Kode |
| --- | --- | --- |
| Projektleder | pl@exempo.dk | exempo123 |
| Administrator | admin@exempo.dk | exempo123 |
| Tømrer (marken) | lars@exempo.dk | exempo123 |

## iPhone / App Store

iPhone-appen **er hjemmesiden**. Åbn [https://exempo.jbnet.dk](https://exempo.jbnet.dk) i Safari — kalender, arbejdssedler, Min dag og resten er de samme som på computeren. Del → Tilføj til hjemmeskærm, hvis du vil have et ikon.

`/mobil` sender videre til Min dag. Den native skal i `mobile/` (bundle `dk.exempo.app`) åbner samme site i WebView til App Store. Se `mobile/README.md`.

Log ind som `lars@exempo.dk` / `exempo123`.

Byg og send (kræver Developer Program):

```bash
npm i -g eas-cli
eas login
eas init
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Support og privatliv (påkrævet af Apple): `/stoette` og `/privatliv`. Fulde review-tekster står i `mobile/store/da-DK/listing.md` og `mobile/README.md`.

## Moduler

- **Overblik** — pipeline som i Minubas sagsflow
- **Min dag** — montørens app: stopur, materialer, stregkode, foto, ekstraarbejde, fravær
- **Tilbud** — forbrug, fast pris eller kalkulation; godkendt tilbud bliver arbejdsseddel
- **Arbejdssedler** — FSM fra ny sag til faktura, KLS og dokumentation
- **Planlægning** — medarbejderkalender, fravær og ressourcer (bil, lift)
- **Kunder** — kartotek med flere adresser
- **Varer** — eget katalog med varenr., stregkode og lager
- **Tid** — timer, overtid og fravær
- **Fakturaer + rykkere** — 25 % moms, kreditnota, rykker 1–3 og inkasso
- **Serviceaftaler** — faste, tilbagevendende ordrer
- **Dækningsgrad** — pr. sag, medarbejder og samlet (kostpris på materialer)
