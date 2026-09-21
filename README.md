# Exempo

Ordrestyring til håndværk: tilbud, arbejdssedler, planlægning, tid, materialer, KLS, faktura, løn og dækningsgrad.

Hver virksomhed får sin egen SQLite-database. Demo-data er fiktiv og indeholder ikke kunde- eller medarbejderoplysninger fra et rigtigt firma.

## Hurtig start

Krav: [Node.js](https://nodejs.org/) 20 eller nyere.

```bash
git clone https://github.com/fuskeedk/exempo.git
cd exempo
cp .env.example .env
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm test
npm run dev
```

Åbn [http://localhost:3000](http://localhost:3000) og log ind med demo-brugerne:

| Rolle | E-mail | Kode |
| --- | --- | --- |
| Administrator | admin@exempo.dk | exempo123 |
| Projektleder | pl@exempo.dk | exempo123 |
| Medarbejder (marken) | lars@exempo.dk | exempo123 |

Skift adgangskoderne, før I bruger systemet rigtigt. Se den fulde [installationsguide](INSTALL.md).

## Hvad I får

- **Overblik** — sager i Ordre / Igang / Faktura
- **Tilbud** — forbrug, fast pris eller kalkulation; kunden kan svare på mail
- **Arbejdssedler** — materialer, tid, KLS, underskrift og fotos
- **Planlægning** — kalender, træk-og-slip, fravær og materiel
- **Min dag** — montørens app med stopur, materialer og ekstraarbejde
- **Faktura og rykkere** — 25 % moms, kreditnota, rykker 1–3
- **Indkøb** — indkomne leverandørfakturaer og sag-match
- **Løn** — timesedler, overenskomst, timeløn eller funktionær-månedsløn
- **Dækningsgrad** — pr. sag (kun projektleder/admin)

Katalog, vognlager og KLS kan slås til under Indstillinger.

## Produktion og Windows

- Linux-server, systemd og reverse proxy: [INSTALL.md](INSTALL.md)
- Bærbar Windows-app: GitHub Actions-jobbet *Windows exe*, eller `npm run package:win`

## Licens

[MIT](LICENSE)
