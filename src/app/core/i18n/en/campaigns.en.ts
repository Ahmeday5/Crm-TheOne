import { TranslationFile } from '../i18n.types';

const campaigns: TranslationFile<'campaigns'> = {
  campaigns: {
    title: 'Marketing campaigns',
    subtitle:
      'Create and manage your marketing campaigns across every platform',
    welcomeTitle: 'Campaigns management',
    welcomeSubtitle: 'Welcome! Here is what is happening today.',
    new: 'Create new campaign',
    sar: 'EGP',
    days: 'days',

    kpi: {
      totalCampaigns: 'Total campaigns',
      totalBudget: 'Total budget',
      spent: 'Spent',
      active: 'Active campaigns',
      remaining: 'Remaining',
      conversions: 'Conversions',
    },

    filters: {
      searchPlaceholder: 'Search for a campaign...',
      allStatuses: 'All statuses',
      allPlatforms: 'All platforms',
    },

    status: {
      active: 'Active',
      notactive: 'Paused',
      completed: 'Completed',
      cancelled: 'Cancelled',
    },

    targeting: {
      ageLabel: 'Age',
    },

    card: {
      totalBudget: 'Total budget',
      dailyBudget: 'Daily budget',
      audience: 'Target audience',
      details: 'Details',
      pause: 'Pause',
      resume: 'Resume',
      delete: 'Delete',
      empty: 'No campaigns match your filters',
    },

    create: {
      title: 'Create new marketing campaign',
      sectionInfo: 'Basic information',
      sectionBudget: 'Budget and duration',
      sectionAudience: 'Target audience',
      name: 'Campaign name',
      namePlaceholder: 'e.g. Big summer campaign',
      description: 'Description',
      descriptionPlaceholder: 'Short description and goals...',
      platform: 'Platform',
      platformPlaceholder: 'Select advertising platform',
      addChannelSource: 'Add new platform',
      status: 'Campaign status',
      statusHint: 'Defaults to Active',
      budget: 'Total budget (EGP)',
      duration: 'Campaign duration (days)',
      durationHint: 'Computed automatically from start and end dates',
      startDate: 'Start date',
      endDate: 'End date',
      minAge: 'Minimum age',
      maxAge: 'Maximum age',
      gender: 'Gender',
      countries: 'Target countries',
      countriesPlaceholder: 'Select one or more countries',
      countriesHint: 'You can pick multiple countries from the list.',
      countriesSearch: 'Search countries...',
      countriesEmpty: 'No matching countries',
      cancel: 'Cancel',
      submit: 'Create campaign',
      invalidDuration: 'End date must be after the start date.',
      genders: {
        all: 'All',
        male: 'Male',
        female: 'Female',
      },
      errors: {
        endBeforeStart: 'End date must be after the start date',
        ageRangeInvalid:
          'Maximum age must be greater than or equal to the minimum age',
      },
    },

    details: {
      title: 'Campaign details',
      notFound: 'Campaign data not found',
      platformUnknown: 'Unknown platform',
      budget: 'Budget',
      remaining: 'Remaining',
      duration: 'Duration',
      daysElapsed: 'Days elapsed',
      daysRemaining: 'Days remaining',
      spentProgress: 'Spent progress',
    },

    channelSource: {
      title: 'Add advertising platform',
      name: 'Platform name',
      namePlaceholder: 'e.g. Facebook',
      submit: 'Add platform',
      created: 'Platform added successfully',
    },

    messages: {
      created: 'Campaign created successfully',
      paused: 'Campaign paused',
      resumed: 'Campaign resumed',
      deleted: 'Campaign deleted',
      loadFailed: 'Failed to load campaigns',
    },

    deleteDialog: {
      title: 'Delete campaign',
      message:
        'Are you sure you want to delete this campaign? This action cannot be undone.',
      confirm: 'Delete',
      cancel: 'Cancel',
    },

    toggleDialog: {
      pauseTitle: 'Pause campaign',
      pauseMessage: 'Pause this campaign? You can resume it later.',
      resumeTitle: 'Resume campaign',
      resumeMessage: 'Resume this campaign?',
      pauseConfirm: 'Pause',
      resumeConfirm: 'Resume',
      cancel: 'Cancel',
    },
  },
};

export default campaigns;
