import { TranslationFile } from '../i18n.types';

const sidebar: TranslationFile<'sidebar'> = {
  sidebar: {
    navLabel: 'Main navigation',
    search: 'Search menu...',
    clearSearch: 'Clear search',
    noResults: 'No matching pages',
    collapse: 'Collapse menu',
    expand: 'Expand menu',
    close: 'Close menu',
    sections: {
      overview: 'Overview',
      departments: 'Departments',
      developers: 'Developers',
      reports: 'Reports & analytics',
      marketingSales: 'Marketing & sales',
      operations: 'Operations',
      communication: 'Communication',
      performance: 'Performance & reports',
      system: 'System administration',
      // Kept for older references.
      role: 'Select role',
      mainModules: 'Main modules',
      contracts: 'Contracts & schedule',
      security: 'Security',
    },
    groups: {
      dashboards: 'Dashboards',
      marketing: 'Marketing',
      sales: 'Sales',
      contracts: 'Contracts & schedule',
      support: 'Technical support',
      development: 'Developers',
      reports: 'Reports & analytics',
      chats: 'Conversations',
      announcements: 'Announcements & alerts',
      goals: 'Goals & motivation',
    },
    items: {
      // Dashboards
      adminDashboard: 'Admin dashboard',
      attendance: 'Attendance & leave',
      marketingDashboard: 'Marketing dashboard',
      salesDashboard: 'Sales dashboard',
      supportDashboard: 'Support dashboard',
      developersDashboard: 'Developers dashboard',
      admin: 'Admin / Owner',
      marketing: 'Marketing',
      sales: 'Sales',
      support: 'Technical support',
      developers: 'Developers',
      // Marketing
      leads: 'Leads',
      campaigns: 'Marketing campaigns',
      salesAnalysis: 'Sales analysis',
      smartAnalytics: 'Smart analytics',
      // Sales
      salesCustomers: 'Sales customers',
      salesPipeline: 'Sales board (Kanban)',
      priceOffers: 'Price offers',
      salesPlaybook: 'Sales playbook',
      salesLine: 'Price offers',
      // Contracts & schedule
      contractsManage: 'Contracts management',
      schedule: 'Schedule',
      // Operations
      supportClients: 'Support customers',
      kb: 'Knowledge base',
      projects: 'Projects & tasks',
      devAnalytics: 'Developer analytics',
      myProjectReports: 'My reports',
      // Communication
      whatsapp: 'Customer WhatsApp',
      teamChat: 'Team chat',
      whatsappNumbers: 'WhatsApp numbers',
      announcements: 'Announcements board',
      notifications: 'Notifications center',
      chat: 'Team chat',
      // Performance
      dailyReports: 'Daily reports',
      goals: 'Goals',
      leaderboard: 'Leaderboard',
      // System
      settings: 'System settings',
      services: 'Services management',
      resources: 'Resources management',
      // Not in the menu right now
      reports: 'Reports & analytics',
      improvements: 'System improvements',
      webhooks: 'Webhooks management',
      mfa: 'Multi-factor authentication',
    },
  },
};

export default sidebar;
