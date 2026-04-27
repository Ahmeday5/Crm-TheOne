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
};

export default en;
