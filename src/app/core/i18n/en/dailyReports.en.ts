import { TranslationFile } from '../i18n.types';

const dailyReports: TranslationFile<'dailyReports'> = {
  dailyReports: {
    title: 'Daily reports',
    subtitle: 'Submit your daily report on tasks and achievements',
    welcomeTitle: 'Daily reports',
    welcomeSubtitle: 'Welcome! Here is what is happening today.',
    new: 'New report',
    hours: 'h',

    kpi: {
      total: 'Total reports',
      submitted: 'Submitted',
      reviewed: 'Reviewed',
      avgHours: 'Avg. work hours',
    },

    filters: {
      search: 'Search',
      searchPlaceholder: 'Search reports...',
      month: 'Month',
      year: 'Year',
      scope: 'Scope',
      allReports: 'All employees',
      mine: 'My reports',
    },

    empty: {
      title: 'No reports for this month',
      hint: 'Start by adding your first daily report',
    },

    card: {
      details: 'Details',
      edit: 'Edit',
      delete: 'Delete',
    },

    create: {
      title: 'Add daily report',
      editTitle: 'Edit daily report',
      submit: 'Submit report',
      editSubmit: 'Save changes',
      cancel: 'Cancel',
      sectionMeta: 'Basic information',
      sectionWork: 'Work details',
      sectionExtra: 'Additional notes',
      reportDate: 'Report date',
      workHours: 'Work hours',
      completedTasks: 'Completed tasks',
      completedTasksPlaceholder: 'What did you finish today?',
      tasksInProgress: 'Tasks in progress',
      tasksInProgressPlaceholder: 'What are you still working on?',
      plannedTasks: 'Planned tasks',
      plannedTasksPlaceholder: 'What are you planning to start next?',
      challenges: 'Challenges',
      challengesPlaceholder: 'Did you run into any blockers?',
      additionalNotes: 'Additional notes',
      additionalNotesPlaceholder: 'Anything else you would like to share...',
    },

    details: {
      title: 'Daily report details',
      notFound: 'Report not found',
      createdAt: 'Created at',
      updatedAt: 'Last updated',
    },

    messages: {
      created: 'Report submitted successfully',
      updated: 'Report updated successfully',
      deleted: 'Report deleted',
      loadFailed: 'Failed to load reports',
    },

    deleteDialog: {
      title: 'Delete report',
      message: 'Are you sure you want to delete this report? This action cannot be undone.',
      confirm: 'Delete',
      cancel: 'Cancel',
    },
  },
};

export default dailyReports;
