import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'layerToggle';

i18n.addResourceBundle('en', NAMESPACE, {
  risk: 'Risk',
  lines: 'Lines',
  showRiskLayer: 'Show risk layer',
  hideRiskLayer: 'Show line colours instead of risk',
  riskLow: 'Low',
  riskHigh: 'High',
  filter: 'Filter',
  filterLines: 'Choose which lines to show',
  showOnMap: 'Show on map',
  riskFactors: 'Risk based on',
  factor: {
    inspection: 'Inspectors',
    delay: 'Delays',
    disruption: 'Disruptions',
    pickpocket: 'Danger (pickpockets)',
  },
  type: {
    subway: 'Metro',
    suburban: 'Suburban rail',
    light_rail: 'Light rail',
    train: 'Train',
    funicular: 'Funicular',
    tram: 'Tram',
    bus: 'Bus',
  },
});

i18n.addResourceBundle('it', NAMESPACE, {
  risk: 'Rischio',
  lines: 'Linee',
  showRiskLayer: 'Mostra il livello di rischio',
  hideRiskLayer: 'Mostra i colori delle linee invece del rischio',
  riskLow: 'Basso',
  riskHigh: 'Alto',
  filter: 'Filtra',
  filterLines: 'Scegli quali linee mostrare',
  showOnMap: 'Mostra sulla mappa',
  riskFactors: 'Rischio calcolato su',
  factor: {
    inspection: 'Controllori',
    delay: 'Ritardi',
    disruption: 'Disservizi',
    pickpocket: 'Pericolosità (borseggiatori)',
  },
  type: {
    subway: 'Metro',
    suburban: 'Treno suburbano',
    light_rail: 'Metropolitana leggera',
    train: 'Treno',
    funicular: 'Funicolare',
    tram: 'Tram',
    bus: 'Bus',
  },
});
