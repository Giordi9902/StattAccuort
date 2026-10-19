# API di Statt’Accuort

API REST in JSON servita da `packages/api-worker`. In sviluppo è su `http://localhost:8787`; nello
stack Docker Caddy la espone sotto `/api` della stessa origine dell’app.

Questa pagina è una mappa degli endpoint. Gli schemi esatti di input e output sono le definizioni
Zod nei file `*-routes.ts` e `*-contract.ts` di `src/modules/`, e i test in `tests/` mostrano
come si usano.

## Convenzioni

- **Versioni.** Ogni endpoint vive sotto `/v0/...`. Un prefisso di versione sconosciuto risponde
  `404` con le versioni disponibili.
- **Città.** Ogni richiesta accetta `?city=<slug>` (default `napoli`). Uno slug sconosciuto
  risponde `400 UNKNOWN_CITY`.
- **Intervalli di tempo.** Dove ci sono `from` e `to` vanno passati entrambi, in ISO 8601, con
  `to` dopo `from`. Senza, si usa la finestra predefinita dell’endpoint.
- **Errori.** Corpo JSON con un codice interno stabile (`internalCode`); in produzione la
  descrizione testuale viene rimossa. Ci si basa sul codice di stato e sul codice interno, non sul
  messaggio.
- **Cache.** I dati di riferimento (stazioni, linee, segmenti) arrivano con ETag e
  `max-age=0, must-revalidate`; segnalazioni, rischio e distanze sono `no-store`.

## Rete

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/v0/transit/stations` | Tutte le stazioni della città |
| `GET` | `/v0/transit/lines` | Linee con tipo, colore, circolarità e sequenza di stazioni |
| `GET` | `/v0/transit/segments` | Geometrie delle tratte tra stazioni consecutive |
| `GET` | `/v0/transit/distance?from=<id>&to=<id>` | Distanza in fermate tra due stazioni |
| `GET` | `/v0/departures/:stationId` | Prossimi passaggi: orari GTFS di ANM e tabelloni EAV in tempo reale. Se il tabellone EAV non risponde restano gli orari programmati |

## Segnalazioni dei controlli

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/v0/reports?from=&to=` | Segnalazioni nella finestra, più quelle «previste» quando mancano dati reali |
| `GET` | `/v0/reports/:stationId?from=&to=` | Come sopra, per una stazione |
| `POST` | `/v0/reports` | Nuova segnalazione |

Corpo di `POST /v0/reports`: almeno uno tra `stationId`, `lineId` e `directionId`, più
`source` (`web_app`, `mobile_app` o `mini_app`, default `web_app`). L’API completa linea,
direzione o stazione quando può dedurle dalla rete.

```sh
curl -X POST http://localhost:8787/v0/reports \
  -H 'Content-Type: application/json' \
  -d '{"stationId": "<id stazione>", "lineId": "<id linea>"}'
```

Una seconda segnalazione dallo stesso dispositivo entro `REPORT_COOLDOWN_SECONDS` risponde
`429 REPORT_RATE_LIMITED`.

## Avvisi dei passeggeri

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/v0/incidents?from=&to=` | Avvisi nella finestra (default: abbastanza per tutti quelli ancora attivi; massimo 7 giorni) |
| `POST` | `/v0/incidents` | Nuovo avviso |

Corpo di `POST /v0/incidents`: `kind` (`delay`, `disruption`, `pickpocket`), almeno uno tra
`stationId` e `lineId`, e per i soli ritardi `delayMinutes` (5, 15, 30 o 60). Un avviso resta
attivo 30 minuti (ritardo), 120 (disservizio) o 60 (borseggiatori).

## Rischio e statistiche

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/v0/risk` | Rischio per segmento con i singoli fattori (controlli, ritardi, disservizi, borseggiatori) |
| `GET` | `/v0/insights/station/:stationId` | Statistiche di una stazione |
| `GET` | `/v0/insights/lines/:lineName` | Statistiche di una linea |
| `GET` | `/v0/insights/lines?names=a,b,c` | Statistiche di più linee (fino a 50) |
| `GET` | `/v0/config` | Configurazione della città risolta lato server |

## Amministrazione e operazioni

| Metodo | Percorso | Descrizione |
|---|---|---|
| `GET` | `/v0/admin/overview?window=1h\|24h\|7d\|30d` | Dati della dashboard admin. Richiede `Authorization: Bearer <ADMIN_TOKEN>`; senza token configurato risponde `503` |
| `GET` | `/healthz` | Il processo risponde |
| `GET` | `/readyz` | Database raggiungibile e replica non in chiusura |
| `GET` | `/metrics` | Metriche Prometheus |

`/healthz`, `/readyz` e `/metrics` non sono esposti dal proxy pubblico.
