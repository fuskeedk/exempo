# Exempo til iPhone

Feltapp der spejler webudgaven på https://exempo.jbnet.dk: Min dag, timesedler, arbejdssedler og kunder. Kontoret (faktura, løn, indkøb, indstillinger) er ikke med. Bundle ID: `dk.exempo.app`.

Appen kalder `/api/mobile/*` over HTTPS. Standardserveren er `https://exempo.jbnet.dk`.

## Prøv den på din MacBook (Apple Developer)

Ja. Du kan køre den på Mac, før den kommer i App Store.

### 1. Hurtigst: Expo Go (ingen betalt udviklerkonto)

1. Installer [Node.js](https://nodejs.org/) og Xcode Command Line Tools.
2. På Mac:

```bash
git clone https://github.com/fuskeedk/exempo.git
cd exempo/mobile
npm install
npx expo start
```

3. Installer **Expo Go** fra App Store på iPhonen.
4. Scan QR-koden. Log ind med `lars@exempo.dk` / `exempo123` (eller din rigtige bruger). Serveradressen er allerede `https://exempo.jbnet.dk`.

### 2. iPhone-simulator i Xcode (gratis Apple-id)

1. Installer **Xcode** fra Mac App Store og åbn det én gang, så iOS Simulator installeres.
2. Log ind i Xcode under Settings → Accounts med dit Apple-id.
3. Fra `mobile/`:

```bash
npx expo run:ios
```

Det bygger en rigtig iOS-app i Simulator. Ingen betalt Developer Program er nødvendigt til simulator.

### 3. På din egen iPhone via Developer Program

Med **Apple Developer Program** (det betalte team) kan du:

1. Oprette appen i [App Store Connect](https://appstoreconnect.apple.com) med bundle id `dk.exempo.app`.
2. Bygge med EAS og sende til TestFlight:

```bash
npm i -g eas-cli
eas login
cd mobile
eas init
```

Sæt dit Apple-team i `eas.json` (`appleTeamId`, `ascAppId`).

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

3. Eller åbn det genererede Xcode-projekt (`npx expo prebuild --platform ios` og `ios/Exempo.xcworkspace`) og tryk Run med din iPhone valgt. Xcode signerer med dit Developer-team.

Uden betalt program kan du stadig installere på din egen iPhone i 7 dage ad gangen via Xcode (gratis Apple-id). TestFlight og App Store kræver det betalte program.

## Forudsætninger for App Store

1. Apple Developer Program på det team, der skal udgive appen.
2. Den kørende Exempo på HTTPS (`https://exempo.jbnet.dk`).
3. Expo-konto til EAS Build.

## Ikoner

```bash
npm run icons
```
