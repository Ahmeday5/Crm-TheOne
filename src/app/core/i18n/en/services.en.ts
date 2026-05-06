import { TranslationFile } from '../i18n.types';

const services: TranslationFile<'services'> = {
  services: {
    title: 'Services management',
    subtitle: 'Create and manage the services offered to customers',
    welcomeTitle: 'Services management',
    welcomeSubtitle: 'Welcome! Here is what is happening today.',
    new: 'Add new service',

    kpi: {
      total: 'Total services',
      page: 'Current page',
      pageSize: 'Page size',
      visible: 'Visible services',
    },

    filters: {
      searchPlaceholder: 'Search services by name...',
    },

    table: {
      id: 'ID',
      nameAr: 'Arabic name',
      nameEn: 'English name',
      empty: 'No services yet — add your first service to see it here.',
      emptyFiltered: 'No services match your search.',
      edit: 'Edit',
      delete: 'Delete',
    },

    form: {
      addTitle: 'Add new service',
      editTitle: 'Edit service',
      viewTitle: 'Service details',
      nameAr: 'Arabic name',
      nameArPlaceholder: 'e.g. تطبيق موبيل',
      nameEn: 'English name',
      nameEnPlaceholder: 'e.g. Mobile Application',
      cancel: 'Cancel',
      submitAdd: 'Add service',
      submitEdit: 'Save changes',
    },

    messages: {
      added: 'Service added successfully',
      updated: 'Service updated successfully',
      deleted: 'Service deleted successfully',
      loadFailed: 'Failed to load services',
    },

    deleteDialog: {
      title: 'Delete service',
      message: 'Are you sure you want to delete this service? This action cannot be undone.',
      confirm: 'Delete',
      cancel: 'Cancel',
    },
  },
};

export default services;
