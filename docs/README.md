# Documentazione di Statt’Accuort

| Documento | Per chi | Contenuto |
|---|---|---|
| [architecture.md](./architecture.md) | Chi sviluppa | Come si incastrano i pacchetti, moduli dell’API, pipeline dei dati, cache, osservabilità, scalabilità |
| [deploy.md](./deploy.md) | Chi gestisce un’istanza | Docker Compose, variabili d’ambiente, aggiornamento di rete e orari, monitoraggio, checklist di messa online |
| [api.md](./api.md) | Chi usa l’API | Endpoint REST, parametri e codici di errore |

Ogni pacchetto ha anche il suo README:

- [`packages/cities`](../packages/cities/README.md): il registry delle città
- [`packages/api-worker`](../packages/api-worker/README.md): API, seed, test e migrazioni
- [`packages/frontend-next`](../packages/frontend-next/README.md): web app e app iOS
- [`packages/tile-server`](../packages/tile-server/README.md): mappa di base PMTiles

Questi documenti descrivono la struttura, non le singole decisioni: quelle vivono nel codice, nei
commenti e nelle pull request. In caso di dubbio ha ragione il codice.
