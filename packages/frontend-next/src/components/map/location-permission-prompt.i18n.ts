import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'locationPermission';

i18n.addResourceBundle('en', NAMESPACE, {
  mapTitle: 'Show your location?',
  mapDescription:
    'See nearby stations faster and help us distinguish trustworthy reports from spam. Your precise location is not shown to others.',
  reportTitle: 'Use your location for this report?',
  reportDescription:
    'Confirming that you are near the selected station helps us filter false reports. Your precise location is not shown to others.',
  deniedTitle: 'Location access is disabled',
  deniedDescription:
    'To share your location, enable access for Statt’Accuort in your device or browser settings. You can still continue without it.',
  allow: 'Use location',
  notNow: 'Not now',
  continueWithout: 'Continue without',
});

i18n.addResourceBundle('it', NAMESPACE, {
  mapTitle: 'Mostrare la tua posizione?',
  mapDescription:
    'Trova più velocemente le stazioni vicine e aiutaci a distinguere le segnalazioni affidabili dallo spam. La tua posizione precisa non viene mostrata agli altri.',
  reportTitle: 'Usare la tua posizione per questa segnalazione?',
  reportDescription:
    'Confermare che sei vicino alla stazione selezionata ci aiuta a filtrare le segnalazioni false. La tua posizione precisa non viene mostrata agli altri.',
  deniedTitle: "L'accesso alla posizione è disattivato",
  deniedDescription:
    "Per condividere la tua posizione, consenti l'accesso a Statt’Accuort nelle impostazioni del dispositivo o del browser. Puoi comunque continuare senza.",
  allow: 'Usa la posizione',
  notNow: 'Non ora',
  continueWithout: 'Continua senza',
});
