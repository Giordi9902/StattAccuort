# Contribuire a Statt’Accuort

Grazie per voler dare una mano! Questa guida spiega come avviare il progetto e come proporre una
modifica. Le convenzioni complete (test, migrazioni, commenti, frontend) stanno in
[AGENTS.md](AGENTS.md): valgono per le persone come per gli strumenti automatici.

## Prerequisiti

- [Bun](https://bun.sh) (gestore dei pacchetti e runtime degli script)
- [Node.js](https://nodejs.org) 24 (runtime dell’API)
- [Docker](https://www.docker.com) (PostgreSQL in locale, generazione della mappa, stack completo)

## Primo avvio

Il monorepo non ha un workspace alla radice: ogni pacchetto in `packages/` ha il suo
`package.json` e il suo `bun.lock`, quindi `bun install` si lancia dentro il pacchetto.

```sh
# API
cd packages/api-worker
bun install
cp .env.example .env
bun run db:up
bun run seed --city napoli
bun run dev                     # http://localhost:8787

# Frontend
cd packages/frontend-next
bun install
cp .env.example .env
bun run dev                     # http://napoli.localhost:1871
```

La guida completa, con la mappa di base e lo stack Docker, è in [docs/deploy.md](docs/deploy.md).

## Prima di aprire una pull request

Lancia nel pacchetto che hai toccato gli stessi controlli della CI:

| Pacchetto | Comandi |
|---|---|
| `api-worker` | `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test` |
| `frontend-next` | `bun run lint`, `bun run format:check`, `bun run build` |
| `tile-server` | `bun run typecheck` |

## Regole in breve

- **Test di integrazione** attraverso l’API pubblica, senza inserimenti manuali nel database.
- **Nessuna città nel codice.** Tutto ciò che è specifico di Napoli va in
  `packages/cities/src/napoli.ts`.
- **Migrazioni con nomi descrittivi** (`add_reports_direction_index`, non il nome generato).
- **Errori come `AppError`** e log strutturati con il logger del contesto.
- **Frontend:** file in kebab-case, niente `useMemo`/`useCallback` (c’è React Compiler), le
  dipendenze nuove si pesano in byte.
- **Documentazione:** il codice è la fonte di verità. Aggiorna `docs/architecture.md` e
  `docs/deploy.md` nella stessa PR quando aggiungi un pacchetto, un servizio, una variabile
  d’ambiente o un passo di deploy.

## Commit e titoli delle PR

Usiamo i [Conventional Commits](https://www.conventionalcommits.org/it/):

```
feat: mostra i prossimi passaggi della Circumvesuviana
fix: restituisci 404 invece di 500 per una stazione sconosciuta
docs: spiega come aggiornare il feed GTFS
```

Prefissi: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`.

La descrizione della PR è documentazione: spiega il problema, la soluzione scelta e perché.

## Aggiungere o correggere una linea

La rete viene da OpenStreetMap e dal GTFS di ANM. Se una linea manca o è sbagliata, spesso conviene
correggere OpenStreetMap; altrimenti si affinano `operators`, `routeRefPatterns`, `lineNames` o
`extraRouteStations` nel registry e si rigenerano gli snapshot con
`bun run db:seed:refresh --city napoli`. I dettagli in
[docs/architecture.md](docs/architecture.md#pipeline-dei-dati-seed).
