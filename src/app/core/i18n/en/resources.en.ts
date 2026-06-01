import { TranslationFile } from '../i18n.types';

const resources: TranslationFile<'resources'> = {
  resources: {
    welcomeTitle: 'Resources',
    welcomeSubtitle: 'Welcome back! Here’s what’s happening today.',
    title: 'Resource management & workload',
    subtitle: 'Track workloads and distribute tasks efficiently.',
    export: 'Export report',
    kpi: {
      totalDevelopers: 'Total developers',
      avgWorkload: 'Average workload',
      overloaded: 'Overloaded developers',
      available: 'Available developers',
    },
    filters: {
      search: 'Search',
      searchPlaceholder: 'Search by developer name…',
      project: 'Project',
      allProjects: 'All',
      priority: 'Priority',
      allPriorities: 'All',
      sortBy: 'Sort by',
      reset: 'Reset',
    },
    sort: {
      WorkloadDesc: 'Workload (highest first)',
      WorkloadAsc: 'Workload (lowest first)',
      TasksDesc: 'Tasks (most first)',
      NameAsc: 'Name (A–Z)',
    },
    team: {
      title: 'Team overview',
      tasksLabel: 'tasks',
      availableOf: 'h available of',
      workload: 'Workload',
      empty: 'No developers match the current filters.',
    },
    distribution: {
      title: 'Workload distribution',
      tasksLabel: 'tasks',
      empty: 'No workload data to display yet.',
    },
    table: {
      developer: 'Developer',
      specialty: 'Specialty',
      tasks: 'Tasks',
      usedHours: 'Used hours',
      availableHours: 'Available hours',
      capacity: 'Capacity (h)',
      workload: 'Workload',
    },
    messages: {
      loadFailed: 'Failed to load resource data',
      nothingToExport: 'There is no data to export',
    },
  },
};

export default resources;
