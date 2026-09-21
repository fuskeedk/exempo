# Installationsguide

Guiden dækker lokal udvikling og en enkel Linux-produktion. Der ligger **ingen** rigtige kundedata, mails eller adgangskoder i repoet. `.env`, databaser og uploads bliver **ikke** committet.

## Krav

- Node.js 20 eller nyere (22 anbefales)
- npm 10 eller nyere
- Git
- I produktion: en reverse proxy (Apache eller Nginx) og HTTPS

Windows-brugere, der ikke vil installere Node, kan køre den bærbare `.exe` (se nederst).

## 1. Hent koden

```bash
git clone https://github.com/fuskeedk/exempo.git
cd exempo
```

## 2. Miljøfil

```bash
cp .env.example .env
```

Ret mindst `AUTH_SECRET` til en lang tilfældig streng:

```bash
openssl rand -hex 32
```

| Variabel | Betydning | Eksempel |
| --- | --- | --- |
| `AUTH_SECRET` | Hemmelighed til login-cookies. Skal være unik i produktion. | output fra `openssl rand -hex 32` |
| `DATABASE_URL` | Sti til SQLite for standard-virksomheden | `file:./dev.db` lokalt, `file:/var/lib/exempo/exempo.db` i drift |
| `APP_URL` | Offentlig URL (uden skråstreg til sidst) | `http://localhost:3000` eller `https://jeres-domæne.dk` |
| `DEFAULT_TENANT` | Kort navn på første virksomhed | `exempo` |
| `DATA_DIR` | Mappe til databaser, `platform.json` og tenant-filer | `./data` |
| `COOKIE_SECURE` | Sæt til `1` bag HTTPS, så cookie kun sendes sikkert | `1` |
| `PORT` | Intern port, hvis I ikke bruger standard 3000 | `3000` |
| `HOSTNAME` | Bind-adresse for `next start` | `127.0.0.1` |
| `NODE_ENV` | `production` på serveren | `production` |

Commit aldrig `.env`. Mail, EAN, AO-katalog og løn-nøgler sættes inde i appen under **Indstillinger** og ligger i databasen.

## 3. Installér, database og demo

```bash
npm install
npx prisma db push
npx tsx prisma/seed.ts
npm test
npm run dev
```

`seed` sletter den aktuelle database og fylder fiktive sager, kunder og medarbejdere i. Kør den **ikke** på en database, I bruger rigtigt.

Demo-login (kun efter seed):

- `admin@exempo.dk` / `exempo123`
- `pl@exempo.dk` / `exempo123`
- `lars@exempo.dk` / `exempo123`

Flere virksomheder oprettes på `/opret`. Hver virksomhed får sin egen fil under `DATA_DIR/tenants/`.

## 4. Produktion på Linux

Byg og kør som en almindelig Node-app bag en reverse proxy. Appen lytter kun på localhost.

```bash
sudo useradd --system --home /opt/exempo --shell /usr/sbin/nologin exempo
sudo mkdir -p /opt/exempo /var/lib/exempo/tenants /var/lib/exempo/uploads
sudo git clone https://github.com/fuskeedk/exempo.git /opt/exempo
cd /opt/exempo
sudo cp .env.example .env
# ret AUTH_SECRET, DATABASE_URL, APP_URL, DATA_DIR, COOKIE_SECURE, PORT
sudo chown -R exempo:exempo /opt/exempo /var/lib/exempo
sudo -u exempo npm ci
sudo -u exempo npx prisma db push
sudo -u exempo npm run build
```

Eksempel på `.env` i drift:

```
AUTH_SECRET=<lang-tilfældig-streng>
DATABASE_URL=file:/var/lib/exempo/exempo.db
DATA_DIR=/var/lib/exempo
APP_URL=https://jeres-domæne.dk
DEFAULT_TENANT=exempo
COOKIE_SECURE=1
PORT=3000
HOSTNAME=127.0.0.1
NODE_ENV=production
```

Kopiér systemd-filen:

```bash
sudo cp deploy/exempo.service /etc/systemd/system/exempo.service
sudo systemctl daemon-reload
sudo systemctl enable --now exempo
sudo systemctl status exempo
```

### Apache (Let’s Encrypt foran)

```
<VirtualHost *:443>
  ServerName jeres-domæne.dk
  SSLEngine on
  # SSLCertificateFile / SSLCertificateKeyFile fra certbot

  ProxyPreserveHost On
  RequestHeader set X-Forwarded-Proto "https"
  ProxyPass / http://127.0.0.1:3000/
  ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

### Nginx

```
server {
  listen 443 ssl;
  server_name jeres-domæne.dk;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

Uploads og SQLite-filer skal eje af den bruger, tjenesten kører som (`exempo` i eksemplet). Tag backup af `DATA_DIR` (databaser + `platform.json`) og `.env`.

## 5. Opdatering

```bash
cd /opt/exempo
sudo -u exempo git pull
sudo -u exempo npm ci
sudo -u exempo npx prisma db push
sudo -u exempo npm run build
sudo systemctl restart exempo
```

`prisma db push` tilføjer nye felter. Den sletter ikke jeres data, medmindre I bruger `--force-reset` eller kører seed.

## 6. Windows uden Node

1. Åbn repoet på GitHub → **Actions** → **Windows exe**.
2. Hent artifact `Exempo-windows.zip`.
3. Pak **hele mappen** ud og kør `Exempo.exe`.
4. Log ind med demo-brugerne ovenfor, og skift koden bagefter.

Byg selv på en maskine med Node og Go:

```bash
npm ci
cp .env.example .env
npm run package:win
```

Zip-filen ligger i `dist/Exempo-windows.zip`. Windows kan advare om en usigneret fil — vælg *Flere oplysninger* → *Kør alligevel*.

## Fejlfinding

- **Login virker ikke efter deploy:** `AUTH_SECRET` er skiftet, eller `COOKIE_SECURE=1` kører uden HTTPS.
- **Tom side / 502:** `systemctl status exempo` og at proxyen peger på samme port som `PORT`.
- **Ny virksomhed kan ikke logge ind:** e-mailen skal være unik på tværs af virksomheder (`platform.json` i `DATA_DIR`).
- **Mail sendes ikke:** SMTP sættes under Indstillinger. Adgangskoder gemmes i databasen, ikke i git.
