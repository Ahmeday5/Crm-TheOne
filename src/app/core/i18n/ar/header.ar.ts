import { TranslationFile } from '../i18n.types';

const header: TranslationFile<'header'> = {
  header: {
    app: 'TheOne CRM',
    tagline: 'نظام إدارة علاقات العملاء',
    theme: 'المظهر',
    language: 'اللغة',
    profile: 'الملف الشخصي',
    settings: 'الإعدادات',
    logout: 'تسجيل الخروج',
    notifications: 'الإشعارات',
    mode: { light: 'فاتح', dark: 'داكن' },
    color: {
      label: 'اللون',
      blue: 'أزرق',
      purple: 'بنفسجي',
      green: 'أخضر',
    },
  },
};

export default header;
