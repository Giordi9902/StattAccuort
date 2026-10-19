import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'feedback';

i18n.addResourceBundle('en', NAMESPACE, {
  button: 'Send feedback',
  title: 'Send feedback',
  close: 'Close',
  typeLabel: 'What kind of feedback is this?',
  typeFeature: 'Feature request',
  typeBug: 'Bug report',
  typeGeneral: 'General',
  messageLabel: 'Tell us more',
  messagePlaceholder: 'Share your idea, the bug you hit, or anything else…',
  submit: 'Submit',
  submitting: 'Sending…',
  successTitle: 'Thanks for your feedback!',
  successText: 'We read every submission.',
  error: 'Could not send your feedback. Please try again.',
  retry: 'Try again',
});

i18n.addResourceBundle('it', NAMESPACE, {
  button: 'Invia un feedback',
  title: 'Invia un feedback',
  close: 'Chiudi',
  typeLabel: 'Che tipo di feedback è?',
  typeFeature: 'Richiesta di funzionalità',
  typeBug: 'Segnalazione di un bug',
  typeGeneral: 'Generale',
  messageLabel: 'Raccontaci di più',
  messagePlaceholder: 'Condividi la tua idea, il bug che hai trovato o qualsiasi altra cosa…',
  submit: 'Invia',
  submitting: 'Invio in corso…',
  successTitle: 'Grazie per il tuo feedback!',
  successText: 'Leggiamo ogni messaggio.',
  error: 'Impossibile inviare il feedback. Riprova.',
  retry: 'Riprova',
});
