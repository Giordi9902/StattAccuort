import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportSuccess';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Thank you for your report!',
  description: 'people appreciate your help',
  sentimentPrompt: 'Do you like Statt’Accuort?',
  sentimentYes: 'Yes, I like it',
  sentimentNo: 'No, not really',
  syncText: 'Your report was synced with {{handle}}',
  continue: 'Continue',
});

i18n.addResourceBundle('it', NAMESPACE, {
  title: 'Grazie per la tua segnalazione!',
  description: 'persone apprezzano il tuo aiuto',
  sentimentPrompt: 'Ti piace Statt’Accuort?',
  sentimentYes: 'Sì, mi piace',
  sentimentNo: 'No, non molto',
  syncText: 'La tua segnalazione è stata sincronizzata con {{handle}}',
  continue: 'Continua',
});
