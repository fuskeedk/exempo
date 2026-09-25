# Exempo til iPhone

Feltapp til App Store. Den spejler webudgavens felt-del — Min dag, arbejdssedler, planlægning og tid — ikke kontoret (faktura, DG, medarbejdere). Bundle ID: `dk.exempo.app`.

En App Store-app kan ikke indeholde Next.js-serveren. iOS-klienten kalder `/api/mobile/*` på jeres hostede Exempo over HTTPS.

## Forudsætninger for indsendelse

1. **Apple Developer Program** på det team, der skal udgive appen.
2. **Offentlig HTTPS-server** med denne repo (Vercel, en VPS eller tilsvarende) og `AUTH_SECRET` sat.
3. **EAS / Expo-konto** til at bygge den signerede IPA.

Uden de tre kan projektet bygges og testes, men Apple tager ikke imod en usigneret app.

## Test lokalt

```bash
cd mobile
npm install
npx expo start
```

På en fysisk iPhone: Expo Go, og sæt serveradressen til din PCs LAN-IP, f.eks. `http://192.168.1.20:3000`. Kontoret skal køre `npm run dev` i repo-roden.

«Prøv demo» virker uden server.

## Byg til TestFlight / App Store

```bash
npm i -g eas-cli
eas login
eas init
```

Sæt `extra.eas.projectId` i `app.json` og Apple-team i `eas.json` (`ascAppId`, `appleTeamId` efter appen er oprettet i App Store Connect).

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

I App Store Connect:

- Sæt support- og privatlivs-URL til `https://<domæne>/stoette` og `/privatliv`
- Upload 6.7" og 6.5" screenshots fra simulator
- Sæt ITS-export til «app uses only exempt encryption»
- Review-noter: se `store/da-DK/listing.md`

## Ikoner

```bash
npm run icons
```

Skriver 1024×1024 `assets/icon.png` uden gennemsigtighed.
