import { TranslationFile } from '../i18n.types';

const projects: TranslationFile<'projects'> = {
  projects: {
    title: 'Projects & tasks',
    subtitle: "Welcome back! Here's what's happening today.",
    tabs: {
      projects: 'Projects board',
      tasks: 'Tasks management',
    },
    manage: { title: 'Projects management' },
    project: {
      name: 'Project name',
      client: 'Client',
      manager: 'Project manager',
      startDate: 'Start date',
      deadline: 'Deadline',
      progress: 'Progress',
      status: 'Status',
      team: 'Team',
      statuses: { planning: 'Planning', active: 'Active', onHold: 'On hold', completed: 'Completed' },
    },
    tasks: {
      title: 'Tasks management',
      add: 'Add task',
      name: 'Task name',
      assignee: 'Assignee',
      dueDate: 'Due date',
      priority: 'Priority',
      status: 'Status',
      statuses: { todo: 'To-do', inProgress: 'In progress', review: 'Review', done: 'Done' },
    },
  },
};

export default projects;
