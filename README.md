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

Feltappen ligger i `mobile/` (Expo, bundle ID `dk.exempo.app`). Den taler med https://exempo.jbnet.dk og har samme felt-flow som web: Min dag, timesedler, arbejdssedler og kunder.

**Ja — du kan prøve den på din MacBook.** Hurtigst er Expo Go. Med Xcode kører den i iPhone-simulator. Apple Developer Program bruges til at installere på din iPhone, TestFlight og App Store. Se `mobile/README.md`.

Hent koden fra GitHub (ikke fra webserveren). Expo Go og Expo CLI skal bruge **din egen** gratis [Expo-konto](https://expo.dev/signup) — ikke `lars@exempo.dk`. Den grønne login-skærm i appen er Exempo.

Åbn [https://exempo.jbnet.dk/mobil](https://exempo.jbnet.dk/mobil) i Safari på iPhonen. Ingen Expo Go og ingen tunnel.

Lokalt på Mac:

```bash
cd ~ && (test -d exempo/.git || git clone -b cursor/sagsbehandling-fsm-604a https://github.com/fuskeedk/exempo.git) && cd ~/exempo/mobile && git pull origin cursor/sagsbehandling-fsm-604a && npm install && npx expo start --web --offline --clear
```

Log ind som `lars@exempo.dk` / `exempo123`, eller tryk **Prøv demo**.

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
