# Exempo til iPhone

iPhone-appen **er hjemmesiden**. Kalender, arbejdssedler, Min dag, kunder og resten ligger på https://exempo.jbnet.dk — ikke i en forenklet kopi.

## Prøv på iPhone

Åbn Safari og gå til:

**https://exempo.jbnet.dk**

Log ind som på computeren. Felt-menuen er den samme: Min dag (kalender/uge), timesedler, arbejdssedler, kunder, vognlager og serviceaftaler. Kontoret er skjult for medarbejdere, ligesom på web.

Tilføj til hjemmeskærm: Del → Tilføj til hjemmeskærm.

`https://exempo.jbnet.dk/mobil` sender dig videre til Min dag på den rigtige side.

## Native skal (App Store)

`App.tsx` åbner hjemmesiden i en WebView (`dk.exempo.app`). Sådan kommer den samme kalender og de samme arbejdssedler med i App Store.

```bash
cd ~ && (test -d exempo/.git || git clone -b cursor/sagsbehandling-fsm-604a https://github.com/fuskeedk/exempo.git) && cd ~/exempo/mobile && git pull origin cursor/sagsbehandling-fsm-604a && npm install && npx expo start --ios
```

Xcode-simulator kræver Xcode. Expo Go-tunnel er unødvendig, når du bare åbner hjemmesiden på telefonen.
