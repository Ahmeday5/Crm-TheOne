import { TranslationFile } from '../i18n.types';

const auth: TranslationFile<'auth'> = {
  auth: {
    welcome: 'Welcome to',
    subtitle:
      'A complete CRM platform with full control over sales, marketing and technical support operations',
    login: {
      title: 'Sign in',
      hint: 'Enter your credentials to access the dashboard',
      submit: 'Sign in',
    },
    email: 'Email address',
    emailPlaceholder: 'Enter your email',
    password: 'Password',
    passwordPlaceholder: 'Enter your password',
    remember: 'Remember me',
    forgot: 'Forgot password?',
    quick: 'Quick demo login',
    role: {
      admin: 'Admin',
      marketing: 'Marketing',
      sales: 'Sales',
      support: 'Support',
      developer: 'Developer',
    },
    copyright: '© 2026 TheOne CRM — All rights reserved',
    stats: {
      modules: 'Integrated modules',
      roles: 'Custom roles',
      uptime: 'Uptime',
      support: 'Continuous support',
    },
  },
};

export default auth;
