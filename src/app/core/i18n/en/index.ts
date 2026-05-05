import { Translations } from '../i18n.types';
import common from './common.en';
import header from './header.en';
import sidebar from './sidebar.en';
import auth from './auth.en';
import dashboard from './dashboard.en';
import leads from './leads.en';
import sales from './sales.en';
import support from './support.en';
import projects from './projects.en';
import reportAnalysis from './reportAnalysis.en';
import notFound from './notFound.en';
import settings from './settings.en';

const en: Translations = {
  ...common,
  ...header,
  ...sidebar,
  ...auth,
  ...dashboard,
  ...leads,
  ...sales,
  ...support,
  ...projects,
  ...reportAnalysis,
  ...notFound,
  ...settings,
};

export default en;
