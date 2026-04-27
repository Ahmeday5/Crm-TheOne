import { TranslationFile } from '../i18n.types';

const auth: TranslationFile<'auth'> = {
  auth: {
    welcome: 'مرحباً بك في',
    subtitle:
      'نظام متكامل لإدارة علاقات العملاء مع تحكم كامل في جميع عمليات المبيعات والتسويق والدعم الفني',
    login: {
      title: 'تسجيل الدخول',
      hint: 'أدخل بياناتك للوصول إلى لوحة التحكم',
      submit: 'تسجيل الدخول',
    },
    email: 'البريد الإلكتروني',
    emailPlaceholder: 'أدخل البريد الإلكتروني',
    password: 'كلمة المرور',
    passwordPlaceholder: 'أدخل كلمة المرور',
    remember: 'تذكرني',
    forgot: 'نسيت كلمة المرور؟',
    quick: 'تسجيل دخول سريع للتجربة',
    role: {
      admin: 'مدير',
      marketing: 'تسويق',
      sales: 'مبيعات',
      support: 'دعم',
      developer: 'مطورين',
    },
    copyright: '© 2026 TheOne CRM - جميع الحقوق محفوظة',
    stats: {
      modules: 'وحدات متكاملة',
      roles: 'أدوار مخصصة',
      uptime: 'معدل التشغيل',
      support: 'دعم متواصل',
    },
  },
};

export default auth;
