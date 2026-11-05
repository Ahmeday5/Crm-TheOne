import { TranslationFile } from '../i18n.types';

const commandCenter: TranslationFile<'commandCenter'> = {
  commandCenter: {
    trigger: 'Search or run a command…',
    notAvailable: 'This shortcut isn’t available for your role.',
    groups: {
      recent: 'Recent',
      pages: 'Pages',
      actions: 'Commands',
    },
    palette: {
      label: 'Command palette',
      placeholder: 'Search pages or commands… (English or عربي)',
      noResults: 'No results',
      noResultsHint: 'Try another word in English or Arabic',
      navigate: 'navigate',
      open: 'open',
      close: 'close',
    },
    actions: {
      newCustomer: 'Add new customer',
      newAnnouncement: 'Publish an announcement',
      goHome: 'Go to dashboard',
      darkMode: 'Switch to dark mode',
      lightMode: 'Switch to light mode',
      switchLanguage: 'Change language (العربية)',
      startTour: 'Product tour',
      shortcuts: 'Keyboard shortcuts',
      install: 'Install the app',
    },
    shortcuts: {
      palette: 'Quick search / command palette',
      newCustomer: 'Add new customer',
      goPipeline: 'Go to sales pipeline',
      goWhatsapp: 'Go to customer WhatsApp',
      goChat: 'Go to team chat',
      goAnnouncements: 'Go to announcements',
      goHome: 'Go to dashboard',
      help: 'Show all shortcuts',
    },
    help: {
      title: 'Keyboard shortcuts',
      intro: 'Save time — run common tasks straight from the keyboard.',
      then: 'then',
      note: 'Shortcuts are off while typing in a field, and work with an Arabic keyboard layout too.',
    },
    tour: {
      step: 'Step {n} of {total}',
      skip: 'Skip',
      prev: 'Back',
      next: 'Next',
      finish: 'Get started',
      welcome: {
        title: 'Welcome to TheOne CRM 👋',
        body: 'A quick tour (under a minute) of the parts that matter for your role.',
      },
      sidebar: {
        title: 'Main menu',
        body: 'All your pages, grouped — open a group to see what’s inside, search the menu or collapse it.',
      },
      dashboards: {
        title: 'Dashboards',
        body: 'Track every department from one place: management, marketing, sales, support and developers.',
      },
      sales: {
        title: 'Sales',
        body: 'Your customers, the Kanban pipeline (drag a customer between stages) and price offers.',
      },
      marketing: {
        title: 'Marketing',
        body: 'Add leads, run campaigns and analyse sales outcomes.',
      },
      support: {
        title: 'Technical support',
        body: 'Customers handed to you and the knowledge base to solve issues fast.',
      },
      development: {
        title: 'Projects & development',
        body: 'Your tasks, projects and progress reports in one place.',
      },
      reports: {
        title: 'Reports & analytics',
        body: 'Daily reports, sales results and smart analytics — every number in one place.',
      },
      chats: {
        title: 'Conversations',
        body: 'Customer WhatsApp and internal chat with your teammates.',
      },
      announcements: {
        title: 'Announcements',
        body: 'Management announcements appear here and as a banner on every page while they’re live.',
      },
      search: {
        title: 'Quick search Ctrl + K',
        body: 'Type any page or command in English or Arabic and jump straight to it. Press ? for all shortcuts.',
      },
      notifications: {
        title: 'Notifications',
        body: 'Everything that concerns you arrives here in real time: follow-ups, messages and announcements.',
      },
      profile: {
        title: 'Your account',
        body: 'Edit your details and photo, replay this tour or install the app from here.',
      },
      done: {
        title: 'You’re all set! 🚀',
        body: 'Replay the tour any time from your account menu or Ctrl + K.',
      },
    },
    pwa: {
      updateTitle: 'A new version is available',
      updateBody: 'Update now to get the latest improvements.',
      updateNow: 'Update',
      later: 'Later',
    },
  },
};

export default commandCenter;
