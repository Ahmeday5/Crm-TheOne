import { Translations } from '../i18n.types';
import common from './common.ar';
import header from './header.ar';
import sidebar from './sidebar.ar';
import auth from './auth.ar';
import dashboard from './dashboard.ar';
import leads from './leads.ar';
import sales from './sales.ar';
import support from './support.ar';
import projects from './projects.ar';
import reportAnalysis from './reportAnalysis.ar';
import notFound from './notFound.ar';
import settings from './settings.ar';

const ar: Translations = {
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

export default ar;
