import { TranslationFile } from '../i18n.types';

const settings: TranslationFile<'settings'> = {
  settings: {
    title: 'Settings',
    subtitle: "Welcome back! Here's what's happening today.",
    tabs: {
      users: 'User management',
      roles: 'Roles & permissions',
      system: 'System settings',
      activity: 'Activity log',
      audit: 'Audit log',
      notifications: 'Notifications & alerts',
      backup: 'Backup & data',
    },
    users: {
      title: 'User management',
      subtitle: 'Manage users and their accounts',
      kpi: {
        total: 'Total users',
        active: 'Active users',
        inactive: 'Inactive users',
        roles: 'Roles count',
      },
      filters: {
        searchPlaceholder: 'Search by name or email...',
        allRoles: 'All roles',
        allStatuses: 'All statuses',
        active: 'Active',
        inactive: 'Inactive',
      },
      list: {
        title: 'Users list',
        empty: 'No users to display',
        col: {
          name: 'Name',
          role: 'Role',
          email: 'Email',
          phone: 'Phone',
          status: 'Status',
          createdAt: 'Created at',
          actions: 'Actions',
        },
      },
      add: 'Add user',
      edit: 'Edit',
      delete: 'Delete',
      view: 'View',
      addDialog: {
        title: 'Add new user',
        fullName: 'Full name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        password: 'Password',
        role: 'Role',
        cancel: 'Cancel',
        submit: 'Add',
        submitting: 'Adding...',
      },
      editDialog: {
        title: 'Edit user',
        cancel: 'Cancel',
        submit: 'Save changes',
        submitting: 'Saving...',
      },
      deleteDialog: {
        title: 'Delete user',
        message: 'Are you sure you want to delete this user? This action cannot be undone.',
        confirm: 'Delete',
        cancel: 'Cancel',
      },
      messages: {
        added: 'User added successfully',
        updated: 'User updated successfully',
        deleted: 'User deleted successfully',
        loadFailed: 'Failed to load users',
      },
      placeholders: {
        notProvided: 'Not provided',
      },
    },
    placeholder: {
      comingSoon: 'This page is under development. Stay tuned.',
    },
  },
};

export default settings;
