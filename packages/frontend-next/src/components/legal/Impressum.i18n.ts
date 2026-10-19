import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'impressum';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Legal Notice',
  sections: {
    provider: {
      title: 'Provider Information',
      name: 'FreiFahren e.V. - Johan Trieloff (Chairman)',
      careOf: 'c/o Online-Impressum #7591',
      street: 'Europaring 90',
      city: '53757 Sankt Augustin',
    },
    contact: {
      title: 'Contact',
      emailLabel: 'Email:',
      form: 'Additional electronic contact channel: email.',
    },
    representedBy: {
      title: 'Represented by',
      content:
        'The association is represented jointly by any two members of the board: Johan Trieloff, Moritz Clerc, David Brandes.',
    },
    register: {
      title: 'Register Entry',
      content: 'Register of Associations: Amtsgericht Charlottenburg, VR 42496',
    },
    vat: {
      title: 'VAT',
      content: 'The association is not subject to VAT.',
    },
  },
  links: {
    privacy: 'Privacy Policy',
  },
});

i18n.addResourceBundle('it', NAMESPACE, {
  title: 'Note legali',
  sections: {
    provider: {
      title: 'Informazioni sul fornitore',
      name: 'FreiFahren e.V. - Johan Trieloff (Presidente)',
      careOf: 'c/o Online-Impressum #7591',
      street: 'Europaring 90',
      city: '53757 Sankt Augustin',
    },
    contact: {
      title: 'Contatti',
      emailLabel: 'Email:',
      form: 'Ulteriore canale di contatto elettronico: email.',
    },
    representedBy: {
      title: 'Rappresentanza',
      content:
        "L'associazione è rappresentata congiuntamente da due membri qualsiasi del direttivo: Johan Trieloff, Moritz Clerc, David Brandes.",
    },
    register: {
      title: 'Iscrizione al registro',
      content: 'Registro delle associazioni: Amtsgericht Charlottenburg, VR 42496',
    },
    vat: {
      title: 'IVA',
      content: "L'associazione non è soggetta a IVA.",
    },
  },
  links: {
    privacy: 'Informativa sulla privacy',
  },
});
