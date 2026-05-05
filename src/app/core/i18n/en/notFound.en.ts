import { TranslationFile } from '../i18n.types';

const notFound: TranslationFile<'notFound'> = {
  notFound: {
    title: 'Page not found',
    message: 'The page you tried to reach does not exist, or it may have been moved or removed.',
    back: 'Go back',
    home: 'Go to home',
    hint: 'Double-check the address, or head back to the homepage to continue working.',
  },
};

export default notFound;
