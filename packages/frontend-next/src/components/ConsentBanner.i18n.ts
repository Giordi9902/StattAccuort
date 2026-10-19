import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'consentBanner';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Help us improve Statt’Accuort',
  text: 'We use privacy-friendly analytics (PostHog, hosted in the EU) to make the app better. Allow cookies and we can recognize your return visits; decline and we collect only anonymous, cookieless usage statistics - nothing is stored on your device. We never sell your data or use it for ads. You can change this anytime in Settings.',
  accept: 'Allow cookies',
  decline: 'Decline cookies',
  privacy: 'Privacy Policy',
});

i18n.addResourceBundle('it', NAMESPACE, {
  title: 'Aiutaci a migliorare Statt’Accuort',
  text: "Usiamo un sistema di analisi rispettoso della privacy (PostHog, ospitato nell'UE) per migliorare l'app. Se accetti i cookie possiamo riconoscere le tue visite successive; se li rifiuti raccogliamo solo statistiche d'uso anonime e senza cookie, e sul tuo dispositivo non viene salvato nulla. Non vendiamo mai i tuoi dati e non li usiamo per la pubblicità. Puoi cambiare questa scelta in qualsiasi momento dalle Impostazioni.",
  accept: 'Accetta i cookie',
  decline: 'Rifiuta i cookie',
  privacy: 'Informativa sulla privacy',
});
