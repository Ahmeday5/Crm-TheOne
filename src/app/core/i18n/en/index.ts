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
import campaigns from './campaigns.en';
import services from './services.en';
import customers from './customers.en';
import dailyReports from './dailyReports.en';
import tableTools from './tableTools.en';
import resources from './resources.en';
import knowledgeBase from './knowledgeBase.en';
import whatsapp from './whatsapp.en';
import notifications from './notifications.en';
import goals from './goals.en';

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
  ...campaigns,
  ...services,
  ...customers,
  ...dailyReports,
  ...tableTools,
  ...resources,
  ...knowledgeBase,
...whatsapp,
  ...notifications,
  ...goals,
};

export default en;
