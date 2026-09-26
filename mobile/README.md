# Exempo på iPhone

Den native app (`dk.exempo.app`) er en rigtig iOS-app, der kan sendes til App Store. Den åbner hele Exempo — samme login og samme funktioner som på https://exempo.jbnet.dk.

Der er ikke en separat “felt-app”. Kalender, arbejdssedler, Min dag, kunder, tilbud og faktura er de samme sider som på computeren.

## Prøv på iPhone nu (uden App Store)

1. Åbn Safari og gå til https://exempo.jbnet.dk
2. Log ind.
3. Del → Tilføj til hjemmeskærm.

## Byg til App Store / TestFlight

Kræver [Apple Developer Program](https://developer.apple.com/programs/) (99 USD/år) og en Mac med Xcode til den første signing.

```bash
git clone https://github.com/fuskeedk/exempo.git
cd exempo/mobile
npm install
npm i -g eas-cli
eas login
eas init
```

Sæt `appleTeamId` og senere `ascAppId` i `eas.json`, når I har oprettet appen i App Store Connect.

Prøv på Mac-simulator (ingen betalt konto nødvendig til selve .app-filen):

```bash
eas build --platform ios --profile simulator
```

Intern test på fysisk iPhone (Ad Hoc / TestFlight-preview):

```bash
eas build --platform ios --profile preview
```

Produktion til App Store:

```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

Apple skal have de offentlige URL’er:

- Support: https://exempo.jbnet.dk/stoette
- Privatliv: https://exempo.jbnet.dk/privatliv

Review-login: `lars@exempo.dk` / `exempo123`. Fulde tekster: `store/da-DK/listing.md`.

## Expo Go (kun udvikling)

Expo Go-kontoen er *ikke* Exempo-login.

```bash
cd mobile
npx expo start --lan
```

Åbn projektet i Expo Go, og log derefter ind med `lars@exempo.dk` i selve Exempo.
