# Exempo — sagshåndtering

FSM-baseret sagshåndtering til skadesager: oprettelse, medarbejderkalender, dokumentation, KLS, faktura og dækningsgrad.

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
| Tømrer | lars@exempo.dk | exempo123 |

## Hvad systemet dækker

- **Sager** med finite state machine: Ny → Besigtigelse → Planlagt → I gang → KLS → Klar til faktura → Faktureret → Afsluttet
- **Medarbejdere** med rolle, fag og timepris
- **Kalender** pr. medarbejder, så projektlederen kan lægge sager på
- **Dokumentation** (foto, tilbud, forsikring, KLS, faktura)
- **KLS-tjeklister** med underskrift som krav før faktura
- **Faktura** med 25 % moms og status kladde/sendt/betalt
- **Dækningsgrad** pr. sag, pr. medarbejder og samlet
