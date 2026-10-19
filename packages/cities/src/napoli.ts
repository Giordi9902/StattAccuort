import type { CityConfig } from './types'

export const NAPOLI: CityConfig = {
    slug: 'napoli',
    subdomain: 'napoli',
    displayName: 'Napoli',
    publicAppUrl: 'https://napoli.stattaccuort.it',
    lang: 'it',
    lineTypeLabels: {
        subway: 'Metro',
        suburban: 'Trenitalia',
        train: 'Treno EAV',
        light_rail: 'Circumvesuviana',
        funicular: 'Funicolare',
        bus: 'Bus',
    },
    timezone: 'Europe/Rome',
    map: {
        center: [14.2681, 40.8518],
        zoom: 11,
        // Metropolitan-city extent: Torregaveta (west) to Sarno/Baiano (east), Sorrento (south).
        bounds: [13.95, 40.6, 14.65, 41.0],
        styleUrl: 'https://tiles.stattaccuort.it/styles/napoli.json',
    },
    tiles: {
        osmUrl: 'https://download.geofabrik.de/europe/italy/sud-latest.osm.pbf',
        clipToMapBounds: true,
    },
    seed: {
        // The metropolitan city (former province), not the comune: the EAV lines run far
        // beyond the city limits.
        adminLevel: '^6$',
        // OSM still tags the funiculars with their former operator, Metronapoli (now part of ANM).
        operators: ['ANM', 'Azienda Napoletana Mobilità', 'Metronapoli', 'Trenitalia', 'EAV', 'Ente Autonomo Volturno'],
        stationBounds: [13.95, 40.6, 14.65, 41.0],
        routeTypePriority: ['subway', 'suburban', 'train', 'light_rail', 'funicular', 'bus'],
        // These operators also run lines we don't seed (Trenitalia long-distance services, EAV's
        // Other rail routes), so every rail type is whitelisted to the metro lines explicitly.
        routeRefPatterns: {
            subway: '^(1|6)$',
            train: '^(2|4|5|7)$',
            light_rail: '^(7|9|12|13|14)$',
            // Every ANM bus except the combined C51/C52 relation, which duplicates the separate
            // C51 and C52 lines, and the public lifts the GTFS files as buses.
            bus: '^(?!(C51/C52|ACTON|CHIAIA|ECHIA|SANITA|VENTA)$).+$',
        },
        // Refs another route type already uses as a line id: Linea 7 (EAV train 7) next to
        // CV S.Giorgio (light_rail 7), and the ANM buses 5 and 12 next to the Circumflegrea and CV Sarno.
        lineIds: {
            train: { '7': 'L7' },
            bus: { '5': 'bus-5', '12': 'bus-12' },
        },
        // EAV and Trenitalia run buses too; only ANM's are seeded. OSM tags ANM with both spellings.
        routeTypeOperators: {
            bus: ['ANM', 'Azienda Napoletana Mobilità'],
        },
        // OSM maps ANM's buses only in part (whole stretches of route, and lines like 612 and 633,
        // are missing), so they are built from ANM's GTFS feed instead (timetables.gtfsUrl).
        gtfsRouteTypes: ['bus'],
        // Trenitalia's Linea 2 is its own service to riders, not one of EAV's trains.
        routeTypeOverrides: { train: { '2': 'suburban' } },
        // ANM's trolleybus lines (201, 202, 204, 254) are buses to riders.
        routeTypeAliases: { trolleybus: 'bus' },
        // One colour per kind of line, so the map reads by mode at a glance.
        colors: {
            subway: '#F5C400',
            suburban: '#8E24AA',
            train: '#1E88E5',
            light_rail: '#E53935',
            funicular: '#FB8C00',
            bus: '#26A69A',
        },
        defaultLineColor: '#000000',
        // Cumana stations OSM maps but leaves out of the line's route relations: Baia, and the new
        // Pozzuoli station by Villa Maria.
        extraRouteStations: {
            train: { '4': [8602717200, 14221960861] },
        },
        // OSM tags these lines with the regional numbering, which nobody uses in conversation.
        lineNames: {
            subway: { '1': 'L1', '6': 'L6' },
            // OSM letters the funiculars A–D; riders call them by name.
            funicular: { A: 'Centrale', B: 'Chiaia', C: 'Montesanto', D: 'Mergellina' },
            train: { '2': 'L2', '4': 'Cumana', '5': 'Circumflegrea', '7': 'L7' },
            light_rail: {
                '7': 'CV S.Giorgio',
                '9': 'CV Baiano',
                '12': 'CV Sarno',
                '13': 'CV Sorrento',
                '14': 'CV Poggiomarino',
            },
        },
    },
    community: {},
    timetables: {
        // ANM's own feed also carries Trenitalia's L2.
        gtfsUrl: 'http://www.anm.it/google/google-transit.zip',
        eavBoardsUrl: 'https://orariotreni.eavsrl.it/',
        // ANM numbers the funiculars F1/F3/F4 (Chiaia, Centrale, Mergellina); OSM letters them.
        gtfsRouteAliases: { ALIB: 'Alibus', F1: 'Chiaia', F3: 'Centrale', F4: 'Mergellina' },
        eavStationAliases: {
            'CORSO V. EMANUELE': 'Corso Vittorio Emanuele',
        },
    },
}
