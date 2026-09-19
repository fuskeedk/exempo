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

| Rolle | Login | Kode |
| --- | --- | --- |
| Projektleder | pl@exempo.dk | exempo123 |
| Administrator | admin@exempo.dk | exempo123 |
| Tømrer (marken) | lars@exempo.dk | exempo123 |

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
