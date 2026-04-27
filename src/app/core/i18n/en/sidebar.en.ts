import { TranslationFile } from '../i18n.types';

const sidebar: TranslationFile<'sidebar'> = {
  sidebar: {
    search: 'Search menu...',
    collapse: 'Collapse menu',
    expand: 'Expand menu',
    sections: {
      role: 'Select role',
      modules: 'Available modules',
      system: 'System administration',
    },
    items: {
      admin: 'Admin / Owner',
      marketing: 'Marketing',
      sales: 'Sales',
      support: 'Technical Support',
      developers: 'Developers',
      leads: 'Leads management',
      salesLine: 'Sales pipeline',
      projects: 'Projects & tasks',
      reports: 'Reports & analytics',
      chat: 'Internal chat',
      users: 'User management',
      settings: 'System settings',
      kb: 'Knowledge base',
      improvements: 'System improvements',
      advanced: 'Advanced features',
      notifications: 'Notifications center',
    },
  },
};

export default sidebar;
