import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'cityLocationPrompt';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Switch to {{city}}?',
  description:
    'Your location looks like you are in {{city}}. Statt’Accuort shows reports for one city at a time.',
  switch: 'Switch',
  stay: 'Stay here',
  remember: 'Remember this choice',
  expansionTitle: 'Want Statt’Accuort in your city?',
  expansionDescription:
    'You are outside the cities Statt’Accuort currently covers. Would you like Statt’Accuort where you live?',
  expansionCta: 'Yes, tell me more',
  expansionStay: 'Not now',
});

i18n.addResourceBundle('it', NAMESPACE, {
  title: 'Passare a {{city}}?',
  description:
    'Dalla tua posizione sembra che tu sia a {{city}}. Statt’Accuort mostra le segnalazioni per una città alla volta.',
  switch: 'Cambia',
  stay: 'Resta qui',
  remember: 'Ricorda questa scelta',
  expansionTitle: 'Vuoi Statt’Accuort nella tua città?',
  expansionDescription:
    'Ti trovi fuori dalle città coperte da Statt’Accuort. Vorresti Statt’Accuort dove vivi?',
  expansionCta: 'Sì, dimmi di più',
  expansionStay: 'Non ora',
});
