import { TranslationFile } from '../i18n.types';

/** Shared "date added" range filter (`app-customer-date-range-filter`) + created-at cells. */
const dateFilter: TranslationFile<'dateFilter'> = {
  dateFilter: {
    createdAt: 'Date added',
    from: 'From',
    to: 'To',
    clear: 'Clear dates',
    removeChip: 'Remove the date-added filter',
    invalidRange: '"From" must be on or before "To".',
    since: 'From {from}',
    until: 'Until {to}',
    between: '{from} – {to}',
    presetsLabel: 'Quick ranges',
    presets: {
      today: 'Today',
      last7Days: 'Last 7 days',
      last30Days: 'Last 30 days',
      last90Days: 'Last 90 days',
      thisMonth: 'This month',
      lastMonth: 'Last month',
      thisYear: 'This year',
    },
  },
};

export default dateFilter;
