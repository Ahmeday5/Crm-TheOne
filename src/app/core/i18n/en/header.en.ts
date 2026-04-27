import { TranslationFile } from '../i18n.types';

const header: TranslationFile<'header'> = {
  header: {
    app: 'TheOne CRM',
    tagline: 'Customer Relationship Management',
    theme: 'Theme',
    language: 'Language',
    profile: 'Profile',
    settings: 'Settings',
    logout: 'Logout',
    notifications: 'Notifications',
    mode: { light: 'Light', dark: 'Dark' },
    color: {
      label: 'Color',
      blue: 'Blue',
      purple: 'Purple',
      green: 'Green',
    },
  },
};

export default header;
