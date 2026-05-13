import { TranslationFile } from '../i18n.types';

const sidebar: TranslationFile<'sidebar'> = {
  sidebar: {
    search: 'Search menu...',
    collapse: 'Collapse menu',
    expand: 'Expand menu',
    sections: {
      role: 'Select role',
      marketingSales: 'Marketing & sales',
      mainModules: 'Main modules',
      system: 'System administration',
      contracts: 'Contracts & schedule',
      performance: 'Performance & motivation',
      security: 'Security',
    },
    items: {
      // Roles
      admin: 'Admin / Owner',
      marketing: 'Marketing',
      sales: 'Sales',
      support: 'Technical support',
      developers: 'Developers',
      // Marketing & sales
      campaigns: 'Marketing campaigns',
      salesAnalysis: 'Sales analysis',
      // Main modules
      leads: 'Leads management',
      salesCustomers: 'Sales customers',
      salesLine: 'Sales pipeline',
      projects: 'Projects & tasks',
      reports: 'Reports & analytics',
      chat: 'Internal chat',
      dailyReports: 'Daily reports',
      // System administration
      settings: 'System settings',
      services: 'Services management',
      kb: 'Knowledge base',
      improvements: 'System improvements',
      resources: 'Resources management',
      notifications: 'Notifications center',
      devAnalytics: 'Developer analytics',
      webhooks: 'Webhooks management',
      // Contracts & schedule
      contractsManage: 'Contracts management',
      schedule: 'Schedule',
      // Performance
      goals: 'Goals & motivation',
      // Security
      mfa: 'Multi-factor authentication',
    },
  },
};

export default sidebar;
