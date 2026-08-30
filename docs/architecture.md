# Arkitektur og datamodell

Dette dokumentet beskriver kjernearkitekturen og datamodellen for varelager-/POS-appen. Målet er et **generisk varebevegelses- og prosjektsporingssystem** som passer flere bransjer med lignende lagerbehov — først og fremst reklameartikler og bar-/restaurantutstyr (glass, servise, dekorasjon), men bygget for å kunne utvides til flere vertikaler senere uten at kjernen må bygges om.

## Grunnprinsipp

Systemet er *ikke* bygget rundt "beholdning" som primærbegrep, men rundt **bevegelse**. Alt som skjer med en vare — inn, ut, svinn, retur, internbruk — logges som en hendelse. Dagens beholdning er en konsekvens av bevegelseshistorikken, ikke en egen sannhet som kan komme ut av synk.

Dette gir:
- Full historikk og sporbarhet uten ekstra arbeid
- Mulighet til å svare på spørsmål som "hvor mye har vi levert til kunde X dette året", ikke bare "hva har vi nå"
- En modell som fungerer likt for salg, prosjektuttak, svinn og internbruk

## Hvorfor generisk på tvers av bransjer

Reklameartikler og bar-/restaurantutstyr har et felles mønster:

- Varer med **varianter** (farge, trykk, størrelse, logo)
- Uttak knyttet til en **kontekst** (kunde, event, avdeling, kampanje) — ikke bare et kvitteringsnummer
- Delvis **ikke-salg-uttak**: internbruk, svinn, retur, utlån
- Behov for å svare på "hvor mye har vi levert/brukt på X" over tid, ikke bare dagens saldo

Datamodellen er designet rundt dette mønsteret, ikke rundt én spesifikk bransje. Bransjetilpasning skjer via konfigurerbare felt (attributter, kontekst-typer), ikke ved å endre skjema.

## Datamodell

### Entiteter

**Vare** — den overordnede varen/produktet
- `id` (PK)
- `navn`
- `kategori`
- `leverandor_id` (FK → Leverandør)

**Variant** — en spesifikk utgave av varen (farge, trykk, størrelse, logo)
- `id` (PK)
- `vare_id` (FK → Vare)
- `attributter` (JSON — fleksibelt felt for farge/trykk/størrelse/logo osv.)
- `sku`
- `bildeurl`

**Lokasjon** — fysisk sted varer lagres eller flyttes til/fra
- `id` (PK)
- `navn`
- `type`

**Bevegelse** — kjernetabellen. Hver rad er én hendelse: en variant flyttet inn/ut av en lokasjon
- `id` (PK)
- `variant_id` (FK → Variant)
- `lokasjon_id` (FK → Lokasjon)
- `kontekst_id` (FK → Kontekst)
- `bruker_id` (FK → Bruker)
- `type` (inn / ut / svinn / retur / internbruk)
- `antall`
- `tidspunkt`

**Kontekst** — polymorf tabell som gir bevegelsen et formål. Samme tabell dekker kunde, event, kampanje, internbruk, svinn eller innkjøp
- `id` (PK)
- `type` (kunde / prosjekt / internbruk / svinn / retur / innkjop)
- `navn`
- `referanse`

**Bruker**
- `id` (PK)
- `navn`
- `rolle`

**Leverandør**
- `id` (PK)
- `navn`

### Relasjoner

- Vare 1—mange Variant
- Variant 1—mange Bevegelse
- Lokasjon 1—mange Bevegelse
- Kontekst 1—mange Bevegelse
- Bruker 1—mange Bevegelse
- Leverandør 1—mange Vare

### Praktiske notater

- **Ingen egen "beholdning"-tabell.** Dagens lagerbeholdning beregnes som summen av `Bevegelse` per `variant_id` + `lokasjon_id`. Kan materialiseres/caches for ytelse senere, men beregningslogikken skal alltid ta utgangspunkt i bevegelseslinjene — ikke en separat, potensielt usynkronisert saldo.
- **Indekser:** `variant_id + lokasjon_id + tidspunkt` er den viktigste sammensatte indeksen for raske beholdnings- og rapportspørringer.
- **`attributter` som JSON på Variant** gir fleksibilitet til å legge til nye variant-typer (farge, trykk, størrelse) uten skjemaendring.
- **`type` på Bevegelse** styrer rapportlogikk (f.eks. skille svinn fra salg) uten behov for separate tabeller per hendelsestype.

## Arkitektur — lag

### 1. Klient (mobil/nettbrett)
- Scanning av strekkode/QR
- Fotografering ved inn/ut-registrering (til bildegjenkjenning)
- Delvis offline-støtte: lagre lokalt, synkroniser når nett er tilbake — lagerarbeid skjer ofte i kjeller/bakrom med dårlig dekning

### 2. Backend API
- Tar imot bevegelser
- Autentisering og rollestyring
- Eksponerer rapport-endepunkter

### 3. Database
- Postgres passer godt til denne modellen
- Se indekser nevnt over

### 4. AI-lag (separate tjenester kalt fra backend)
- **Bildegjenkjenning** — tar imot bilde fra klient, foreslår `variant_id` (evt. oppretter ny variant hvis ukjent)
- **Fakturaparsing** — leser PDF/bilde av følgeseddel, foreslår bevegelseslinjer for godkjenning
- **NLP-rapportering** — oversetter naturlig språk-spørsmål til spørringer mot `Bevegelse`-tabellen

**Viktig prinsipp:** AI-laget skal **foreslå**, ikke **bestemme automatisk** — spesielt ved bildegjenkjenning og fakturaparsing. Et menneske bekrefter forslaget med ett trykk. Dette bygger tillit til systemet og reduserer risiko for feilregistrering som direkte påvirker lagerverdi.

## Anbefalt byggerekkefølge

1. Skjema og migrations for kjernetabellene (Vare, Variant, Lokasjon, Bevegelse, Kontekst, Bruker, Leverandør), med enkle seed-data
2. Backend API for grunnleggende inn/ut-registrering og beholdningsspørring
3. Rapport-endepunkter (uten AI først — ren aggregering av Bevegelse)
4. AI-tjenester som isolerte moduler: bildegjenkjenning, fakturaparsing, NLP-rapportering
5. Klient-app med scanning, foto og offline-synk

AI-integrasjonene bygges som isolerte tjenester/moduler fra dag én — ikke vevd inn i kjernelogikken. Dette gjør det enklere å bytte modell/leverandør senere, og lettere å teste kjernen uten å måtte kalle en AI-API for hver test.
