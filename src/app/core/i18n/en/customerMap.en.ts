import { TranslationFile } from '../i18n.types';

const customerMap: TranslationFile<'customerMap'> = {
  customerMap: {
    title: 'Customer map',
    subtitleAdmin: 'Where your customers are — by country and governorate, on a real map',
    subtitleSales: 'Where your own customers are — by country and governorate, on a real map',
    unit: 'customers',
    loadFailed: "Couldn't load the map data.",
    empty: 'No customers match these filters',
    emptyHint: 'Try a wider date range or remove some filters.',
    filters: {
      title: 'Map filters',
      all: 'All',
      status: 'Status',
      source: 'Source',
      campaign: 'Campaign',
      service: 'Service',
      salesPerson: 'Sales rep',
      allSalesPeople: 'All reps',
      createdBetween: 'Customer added',
      from: 'From',
      to: 'To',
      reset: 'Clear filters',
      presets: {
        '30d': 'Last 30 days',
        '90d': 'Last 3 months',
        year: 'This year',
        all: 'All time',
      },
    },
    kpi: {
      total: 'Total customers',
      countries: 'Countries',
      located: 'Country known',
      unknown: 'Unknown country',
      unknownSub: 'No phone or dial code',
      unknownAria: 'Show customers with an unknown country',
    },
    panel: {
      customerList: 'Customers',
      openList: 'Open in the customers table',
      loadFailed: "Couldn't load the customers.",
      noCustomers: 'No customers here.',
      filtersNote: 'This list applies the status and source filters only — campaign, service, date and rep affect the map numbers only.',
    },
  },
};

export default customerMap;
