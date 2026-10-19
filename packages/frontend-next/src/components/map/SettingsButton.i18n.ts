import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'settings';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Settings',
  open: 'Open settings',
  close: 'Close',
  // hub menu
  contact: 'Contact us',
  feedback: 'Send feedback',
  follow: 'Follow',
  // legal
  association: 'Mission',
  imprint: 'Imprint',
  privacy: 'Privacy',
  terms: 'Terms of Use',
  analytics: 'Analytics',
  ticketReminder: 'Statt’Accuort does not replace a ticket. A valid ticket is always required.',
});

i18n.addResourceBundle('it', NAMESPACE, {
  title: 'Impostazioni',
  open: 'Apri le impostazioni',
  close: 'Chiudi',
  // hub menu
  contact: 'Contattaci',
  feedback: 'Invia un feedback',
  follow: 'Seguici',
  // legal
  association: 'Missione',
  imprint: 'Note legali',
  privacy: 'Privacy',
  terms: "Condizioni d'uso",
  analytics: 'Statistiche',
  ticketReminder:
    'Statt’Accuort non sostituisce il biglietto. È sempre necessario un biglietto valido.',
});
