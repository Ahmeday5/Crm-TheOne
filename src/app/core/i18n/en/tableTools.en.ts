import { TranslationFile } from '../i18n.types';

const tableTools: TranslationFile<'tableTools'> = {
  tableTools: {
    refresh: 'Refresh',
    label: 'Export / Print',
    excel: 'Export to Excel',
    print: 'Print (PDF)',
    exportCurrent: 'Current page',
    exportAll: 'All pages',
    printCurrent: 'Current page',
    printAll: 'All pages',
    generatedAt: 'Generated',
    total: 'Total',
    scope: {
      current: 'Current page',
      all: 'All pages',
    },
    messages: {
      noData: 'There is no data to export.',
      fetchAllFailed: 'Failed to load all pages. Please try again.',
      exportFailed: 'Export failed. Please try again.',
      popupBlocked: 'Please allow pop-ups to print this report.',
    },
  },
};

export default tableTools;
