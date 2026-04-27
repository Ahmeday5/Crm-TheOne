import { TranslationFile } from '../i18n.types';

const support: TranslationFile<'support'> = {
  support: {
    title: 'Technical support',
    subtitle: "Welcome back! Here's what's happening today.",
    tabs: {
      dashboard: 'Dashboard',
      designatedClients: 'Designated clients',
      tickets: 'Support tickets',
      log: 'Log',
    },
    dashboard: { title: 'Support dashboard', subtitle: 'Tickets and customer status' },
    designatedClients: {
      title: 'Designated clients',
      list: 'Designated clients list',
    },
    technicalConsultation: {
      title: 'Technical consultation',
      subject: 'Subject',
      consultant: 'Consultant',
      duration: 'Duration',
    },
    tickets: {
      title: 'Support tickets',
      number: 'Ticket #',
      subject: 'Subject',
      priority: 'Priority',
      assignee: 'Assignee',
      created: 'Created',
      lastUpdate: 'Last update',
      priorities: { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' },
      statuses: { open: 'Open', pending: 'Pending', resolved: 'Resolved', closed: 'Closed' },
    },
    casesDetails: {
      title: 'Open support cases details',
    },
    log: {
      title: 'Technical support log',
      action: 'Action',
      performedBy: 'Performed by',
      timestamp: 'Timestamp',
    },
  },
};

export default support;
