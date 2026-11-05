import { TranslationFile } from '../i18n.types';

const pipeline: TranslationFile<'pipeline'> = {
  pipeline: {
    title: 'Sales board',
    subtitleAdmin: "Every sales-team customer, grouped by stage",
    subtitleSales: 'Your customers, grouped by stage',
    view: {
      label: 'View',
      table: 'Table',
      kanban: 'Kanban',
    },
    stats: {
      total: 'Total customers',
      inProgress: 'In progress',
      buyers: 'Bought',
      closeRate: 'Close rate',
      closeRateHint: 'Buyers ÷ (buyers + not buyers)',
    },
    filters: {
      search: 'Search by name or phone...',
      allSources: 'All sources',
      allServices: 'All services',
      allSales: 'All sales reps',
    },
    toolbar: {
      overdueOnly: 'Overdue follow-ups only',
      sort: 'Sort',
      stale: 'Stale after',
      staleHint: 'Days in the same stage after which a customer is flagged as stale',
      staleDefault: 'Default',
      staleDays: '{days} days',
      clear: 'Clear filters',
      dragHint: 'Drag a card to another column to change its status, or use the status button.',
      refresh: 'Refresh',
    },
    sort: {
      Newest: 'Newest added',
      Oldest: 'Oldest added',
      StageAge: 'Longest in stage',
      NextFollowUp: 'Next follow-up',
    },
    card: {
      enteredToday: 'Entered stage today',
      daysInStage: '{days} days in stage',
      stale: 'stale',
      followUp: 'Next follow-up',
      followUpOverdue: 'Follow-up overdue',
      unassigned: 'Unassigned',
      changeStatus: 'Change status',
      whatsapp: 'WhatsApp',
      call: 'Call',
      view: 'View details',
    },
    partial: 'Showing {shown} of {total} customers — use search, filters or "Load more" in each column.',
    loadMore: 'Load more ({left})',
    columnEmpty: 'No customers in this stage',
    empty: 'No customers in the pipeline yet.',
    emptyFiltered: 'No customers match the current filters.',
    messages: {
      loadFailed: "Couldn't load the sales board — please try again.",
      moved: '{name} moved to "{stage}" ✓',
      moveFailed: "Couldn't change the customer's status.",
    },
  },
};

export default pipeline;
