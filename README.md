# ARTKL

Bevegelsesbasert varelager-/POS-system. Se [docs/architecture.md](docs/architecture.md) for arkitektur og datamodell.

Dette er steg 1–5 i "Anbefalt byggerekkefølge": databaseskjema med migrations og seed-data, backend-API for inn/ut-registrering og beholdningsspørring, rapport-endepunkter, et AI-lag (NLP-rapportering, fakturaparsing, bildegjenkjenning) som isolerte moduler kalt fra backend, og en klient-app (React Native/Expo) som så langt dekker bildegjenkjenning.

## Kom i gang

Forutsetter Docker og Node.js 20+.

```bash
# 1. Start Postgres (dev + test-instans)
docker compose up -d

# 2. Installer avhengigheter
cd backend
npm install
cp .env.example .env

# 3. Kjør migrations og seed-data
npm run prisma:migrate
npm run prisma:seed

# 4. Start API-serveren
npm run dev
```

Serveren kjører på `http://localhost:3000`. Sjekk `GET /health` for å bekrefte at den kjører.

Interaktiv API-dokumentasjon (Swagger UI) er tilgjengelig på [http://localhost:3000/docs](http://localhost:3000/docs) — bla gjennom alle endepunkter og prøv forespørsler direkte i nettleseren.

## Kjøre tester

Testene kjører mot en egen test-database (`postgres_test`-tjenesten i `docker-compose.yml`, port 5433) og migrerer den automatisk før testkjøring.

```bash
cd backend
npm test
```

## API

| Metode | Sti | Beskrivelse |
| --- | --- | --- |
| POST/GET | `/api/leverandorer` | Leverandører |
| POST/GET | `/api/varer` | Varer |
| POST/GET | `/api/varianter` | Varianter (farge/trykk/størrelse/logo via `attributter`) |
| POST/GET | `/api/lokasjoner` | Lokasjoner |
| POST/GET | `/api/kontekster` | Kontekst for bevegelser (kunde/prosjekt/internbruk/svinn/retur/innkjop) |
| POST/GET | `/api/brukere` | Brukere |
| POST | `/api/bevegelser` | Registrer en bevegelse (inn/ut/svinn/retur/internbruk) |
| GET | `/api/bevegelser` | Liste, filtrerbar på `variantId`, `lokasjonId`, `kontekstId` |
| GET | `/api/beholdning` | Beregnet beholdning per variant+lokasjon, filtrerbar på `variantId`, `lokasjonId` |
| GET | `/api/rapporter/kontekst/:kontekstId` | Summert antall per variant+type for én kontekst, filtrerbar på `variantId`, `fra`, `til` |
| GET | `/api/rapporter/periode` | Summert antall per type, filtrerbar på `variantId`, `lokasjonId`, `kontekstId`, `fra`, `til` |
| POST | `/api/rapporter/sporsmal` | NLP-rapportering: still et spørsmål på naturlig språk (`{ "sporsmal": "..." }`), får svar basert på faktiske tall slått opp via verktøy. Krever `ANTHROPIC_API_KEY` (returnerer 503 uten) |
| POST | `/api/fakturaer/tolk` | Fakturaparsing: last opp en følgeseddel/faktura (`{ "fil": "<base64>", "mediaType": "application/pdf"\|"image/png"\|"image/jpeg"\|"image/webp", "lokasjonId": "..." }`), får forslag til bevegelseslinjer (variant/kontekst forsøkt matchet mot eksisterende data) for godkjenning — ingenting lagres automatisk. Krever `ANTHROPIC_API_KEY` (returnerer 503 uten) |
| POST | `/api/varianter/gjenkjenn` | Bildegjenkjenning: last opp et bilde av en vare (`{ "fil": "<base64>", "mediaType": "image/png"\|"image/jpeg"\|"image/webp" }`), får forslag til `variantId` (eller flagg om at det kan være en ny variant). Krever `ANTHROPIC_API_KEY` (returnerer 503 uten) |

## Klient-app

`client/` er en React Native-app (Expo, TypeScript), responsiv for både telefon og nettbrett. Første funksjon: ta bilde av en vare og få forslag til `variantId` via `/api/varianter/gjenkjenn`.

```bash
cd client
npm install
cp .env.example .env
```

Sett `EXPO_PUBLIC_API_URL` i `client/.env` til PC-ens LAN-IP (f.eks. `http://192.168.1.42:3000`) — `localhost` fungerer ikke fra en fysisk enhet over nettverket. Backend må kjøre og godta forespørsler fra samme nettverk.

```bash
npm start
```

Skann QR-koden med [Expo Go](https://expo.dev/go) på telefon/nettbrett, eller trykk `w` for nettleser-forhåndsvisning (kamera fungerer da via nettleserens egen kamera-tilgang).

## Utenfor scope (kommer senere)

- Barcode/QR-scanning og registrering av bevegelser fra klienten
- Offline-støtte og synkronisering i klienten
- Update/delete på referansetabeller
- Autentisering/autorisasjon
