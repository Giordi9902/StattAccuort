import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'legalDisclaimer';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Please confirm before proceeding',
  text: 'To maintain the integrity of our community and the spirit of fair use, we ask you to confirm two important points:',
  ticket: 'I own a valid ticket for my journey.',
  ticketDescription:
    'I understand that this app is designed to improve awareness and planning in public transport, not to circumvent rules or regulations.',
  activeUsage: 'I am not actively using the app during my journey.',
  activeUsageDescription:
    'I understand that the active use of the app during my journey can disturb other passengers and violate the terms of use of the public transport operator.',
  saved: 'Your confirmation will be saved on this device.',
  confirm: 'I confirm',
  privacy: 'Privacy',
  imprint: 'Imprint',
  reviewTitle: 'Terms of Use',
  close: 'Close',
});

i18n.addResourceBundle('it', NAMESPACE, {
  title: 'Conferma prima di continuare',
  text: "Per tutelare l'integrità della nostra community e lo spirito di un uso corretto, ti chiediamo di confermare due punti importanti:",
  ticket: 'Ho un biglietto valido per il mio viaggio.',
  ticketDescription:
    "Sono consapevole che questa app serve a migliorare l'informazione e la pianificazione sui mezzi pubblici, non ad aggirare regole o regolamenti.",
  activeUsage: "Non uso attivamente l'app durante il viaggio.",
  activeUsageDescription:
    "Sono consapevole che usare attivamente l'app durante il viaggio può disturbare gli altri passeggeri e violare le condizioni d'uso dell'azienda di trasporto.",
  saved: 'La tua conferma verrà salvata su questo dispositivo.',
  confirm: 'Confermo',
  privacy: 'Privacy',
  imprint: 'Note legali',
  reviewTitle: "Condizioni d'uso",
  close: 'Chiudi',
});
