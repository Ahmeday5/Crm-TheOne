import { TranslationFile } from '../i18n.types';

/** Shared "date added" range filter (`app-customer-date-range-filter`) + created-at cells. */
const dateFilter: TranslationFile<'dateFilter'> = {
  dateFilter: {
    createdAt: 'تاريخ الإضافة',
    from: 'من',
    to: 'إلى',
    clear: 'مسح التاريخ',
    removeChip: 'إزالة فلتر تاريخ الإضافة',
    invalidRange: 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية أو يساويه.',
    since: 'من {from}',
    until: 'حتى {to}',
    between: '{from} – {to}',
    presetsLabel: 'فترات سريعة',
    presets: {
      today: 'اليوم',
      last7Days: 'آخر ٧ أيام',
      last30Days: 'آخر ٣٠ يومًا',
      last90Days: 'آخر ٩٠ يومًا',
      thisMonth: 'هذا الشهر',
      lastMonth: 'الشهر الماضي',
      thisYear: 'هذا العام',
    },
  },
};

export default dateFilter;
