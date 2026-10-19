<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="docs/readme_assets/logo-white.png" />
    <img src="docs/readme_assets/logo-dark.png" alt="Logo di Statt’Accuort" width="110" />
  </picture>

  <h1>Statt’Accuort</h1>

  <p><strong>La mappa live dei controllori sui mezzi pubblici di Napoli.</strong><br/>
  Metro, Cumana, Circumflegrea, Circumvesuviana, funicolari e bus ANM: segnalati dalla community, in tempo reale.</p>

  <p>
    <a href="LICENSE"><img alt="Licenza MIT" src="https://img.shields.io/badge/licenza-MIT-0f766e?style=flat-square" /></a>
    <a href="https://github.com/Giordi9902/StattAccuort/actions/workflows/api-worker-ci.yml"><img alt="API CI" src="https://img.shields.io/github/actions/workflow/status/Giordi9902/StattAccuort/api-worker-ci.yml?label=API%20CI&style=flat-square" /></a>
    <a href="https://github.com/Giordi9902/StattAccuort/actions/workflows/frontend-next-ci.yml"><img alt="Frontend CI" src="https://img.shields.io/github/actions/workflow/status/Giordi9902/StattAccuort/frontend-next-ci.yml?label=Frontend%20CI&style=flat-square" /></a>
    <a href="https://github.com/Giordi9902/StattAccuort/actions/workflows/tile-server-ci.yml"><img alt="Tiles CI" src="https://img.shields.io/github/actions/workflow/status/Giordi9902/StattAccuort/tile-server-ci.yml?label=Tiles%20CI&style=flat-square" /></a>
  </p>

  <p>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="React" src="https://img.shields.io/badge/React%2019-20232A?style=flat-square&logo=react&logoColor=61DAFB" />
    <img alt="Hono" src="https://img.shields.io/badge/Hono-E36002?style=flat-square&logo=hono&logoColor=white" />
    <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white" />
    <img alt="MapLibre" src="https://img.shields.io/badge/MapLibre-396CB2?style=flat-square&logo=maplibre&logoColor=white" />
    <img alt="Bun" src="https://img.shields.io/badge/Bun-000000?style=flat-square&logo=bun&logoColor=white" />
    <img alt="Docker" src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" />
  </p>

  <p>
    <a href="#-avvio-rapido">Avvio rapido</a> ·
    <a href="#-come-funziona">Come funziona</a> ·
    <a href="#%EF%B8%8F-architettura">Architettura</a> ·
    <a href="docs/README.md">Documentazione</a> ·
    <a href="CONTRIBUTING.md">Contribuire</a>
  </p>
</div>

---

<table align="center">
  <tr>
    <td align="center"><img src="docs/readme_assets/screenshot1.png" alt="Mappa di Napoli con le linee e le segnalazioni attive" width="250" /></td>
    <td align="center"><img src="docs/readme_assets/screenshot2.png" alt="Scheda della stazione Toledo con i prossimi passaggi della Linea 1" width="250" /></td>
  </tr>
  <tr>
    <td align="center"><sub><strong>Linee e controlli in corso</strong></sub></td>
    <td align="center"><sub><strong>Scheda stazione e prossimi passaggi</strong></sub></td>
  </tr>
</table>

## 👀 Che cos’è

*Statt’accuort*, in napoletano «stai attento». È una web app (e app iOS) in cui chi viaggia sui
mezzi di Napoli segnala in pochi tocchi dove ha visto i controllori: stazione, linea e direzione.
La segnalazione compare subito sulla mappa di tutti, insieme a una stima del rischio tratta per
tratta, alle statistiche dei punti caldi e ai prossimi passaggi.

## ✨ Funzionalità

| | |
|---|---|
| 🗺️ **Mappa live** | Tutta la rete della città metropolitana su una mappa vettoriale MapLibre, colorata per tipo di linea |
| 📍 **Segnalazioni in tre tocchi** | Stazione, linea, direzione: l’API deduce quello che manca dalla rete |
| 🔥 **Rischio per tratta** | Modello con decadimento spaziale e temporale, combinato con ritardi, disservizi e borseggiatori |
| 🚨 **Avvisi dei passeggeri** | Ritardi (con minuti stimati), disservizi e borseggiatori, a scadenza automatica |
| 🕒 **Prossimi passaggi** | Orari GTFS di ANM e tabelloni EAV in tempo reale |
| 📊 **Insights** | Andamento orario e classifiche delle stazioni e delle linee più controllate |
| 🔒 **Privacy by design** | Nessun account, nessun IP salvato: solo un’impronta anonima HMAC per il limite antispam |
| 📱 **Web, PWA e iOS** | Un solo bundle React servito ovunque, app nativa con Capacitor |
| 🌍 **Pronto per altre città** | Tutto ciò che è specifico di Napoli sta in un registry di dati, non nel codice |

## 🧭 Come funziona

```mermaid
sequenceDiagram
    autonumber
    actor U as Passeggero
    participant App as Web app / iOS
    participant API as API (Hono)
    participant DB as PostgreSQL
    U->>App: «Controllori a Garibaldi, Linea 1»
    App->>API: POST /v0/reports
    API->>API: normalizza sulla rete + limite antispam
    API->>DB: salva la segnalazione
    App->>API: GET /v0/reports, /v0/risk
    API-->>App: segnalazioni attive e rischio per tratta
    App-->>U: la mappa si aggiorna per tutti
```

## 🏗️ Architettura

Un monorepo di pacchetti indipendenti e nessun vendor lock-in: un’API Node su PostgreSQL, una web
app statica e una mappa di base in file PMTiles.

```mermaid
flowchart LR
    Web["📱 frontend-next<br/>React + Vite + MapLibre"] -->|REST /v0| API["⚙️ api-worker<br/>Hono + Drizzle"]
    Web -->|PMTiles, range request| Tiles[("🗺️ tile-server<br/>file statici")]
    API --> PG[("🐘 PostgreSQL")]
    API -->|tabelloni live| EAV["🚆 EAV"]
    Cities["🏙️ cities<br/>registry"] -.-> Web
    Cities -.-> API
    Cities -.-> Tiles
```

| Pacchetto | Cosa fa |
|---|---|
| [`packages/cities`](packages/cities) | Registry delle città: unica fonte di nomi, linee, colori, fuso orario e sorgenti dati |
| [`packages/api-worker`](packages/api-worker) | API REST, pipeline di seed da OpenStreetMap + GTFS, import degli orari, migrazioni |
| [`packages/frontend-next`](packages/frontend-next) | Web app / PWA e app iOS (Capacitor) |
| [`packages/tile-server`](packages/tile-server) | Genera la mappa di base PMTiles da OpenStreetMap |

Tutti i dettagli in [`docs/architecture.md`](docs/architecture.md).

## 🚀 Avvio rapido

Servono **Docker** e, per generare la mappa di base, **Bun**.

```sh
git clone https://github.com/Giordi9902/StattAccuort.git
cd StattAccuort

# 1. Mappa di base (una tantum)
(cd packages/tile-server && bun install && CITY=napoli bun run generate)

# 2. Configurazione
cp .env.example .env                       # imposta POSTGRES_PASSWORD e REPORT_HASH_SECRET

# 3. Database, dati e stack completo
docker compose up -d --build postgres
docker compose run --rm api setup          # seed della rete + orari
docker compose up -d --build
```

Apri **http://localhost:8080** 🎉

<details>
<summary><strong>Sviluppo in locale (API e frontend fuori da Docker)</strong></summary>

```sh
# API → http://localhost:8787
cd packages/api-worker
bun install && cp .env.example .env
bun run db:up                              # PostgreSQL in Docker
bun run seed --city napoli
bun run timetables:import --city napoli
bun run dev

# Frontend → http://napoli.localhost:1871
cd ../frontend-next
bun install && cp .env.example .env        # VITE_API_URL=http://localhost:8787
bun run dev
```

Test dell’API: `bun run test` in `packages/api-worker` (richiede il Postgres locale).
</details>

## 📚 Documentazione

| Documento | Contenuto |
|---|---|
| [Architettura](docs/architecture.md) | Pacchetti, moduli dell’API, pipeline dei dati, osservabilità, scalabilità |
| [Deploy e operazioni](docs/deploy.md) | Docker Compose, configurazione, aggiornamento dei dati, checklist di messa online |
| [API](docs/api.md) | Panoramica degli endpoint REST |
| [Contribuire](CONTRIBUTING.md) | Setup, convenzioni, commit e pull request |
| [Sicurezza](SECURITY.md) | Come segnalare una vulnerabilità |

## 🤝 Contribuire

Bug, nuove linee, traduzioni e pull request sono benvenuti. Parti da
[CONTRIBUTING.md](CONTRIBUTING.md): spiega come avviare il progetto e le poche regole che seguiamo.

## 🙏 Crediti

Statt’Accuort nasce come fork di **[FreiFahren](https://github.com/FreiFahren/FreiFahren)**, il
progetto berlinese da cui viene l’idea: grazie a tutta la loro community. I dati della rete vengono
da [OpenStreetMap](https://www.openstreetmap.org/copyright) (© contributori OSM, ODbL) e dal feed
GTFS di ANM.

## 📄 Licenza

[MIT](LICENSE)

<div align="center">
  <br/>
  <sub>Fatto a Napoli ☕ · <em>statt’accuort</em>, e buon viaggio.</sub>
</div>
