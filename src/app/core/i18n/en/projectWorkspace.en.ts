import { TranslationFile } from '../i18n.types';

/** Project workspace: team allocation + build archive (APK + auto git push). */
const projectWorkspace: TranslationFile<'projectWorkspace' | 'projectTeam' | 'projectBuilds'> = {
  projectWorkspace: {
    status: 'Status',
    progress: 'Progress',
    team: 'Team',
    client: 'Client',
    loadFailed: 'Could not load the project',
  },
  projectTeam: {
    title: 'Team & allocation',
    edit: 'Edit team',
    addDeveloper: 'Add developer',
    addFirst: 'Add the first developer',
    pickDeveloper: 'Pick a developer…',
    remove: 'Remove',
    distribute: 'Split evenly',
    rolePlaceholder: 'Role (e.g. Backend)',
    noRole: 'No role set',
    tasksProgress: 'Task progress',
    overBudget: 'Allocation exceeds 100% — adjust before saving.',
    emptyTitle: 'No developers on this project',
    emptyHint: 'Add developers and set each one’s share of the work.',
  },
  projectBuilds: {
    title: 'Builds',
    latest: 'Latest',
    publish: 'Publish build',
    download: 'Download file',
    downloadMock: 'Download (not available in preview)',
    you: 'You',
    emptyTitle: 'No builds published',
    emptyHint: 'Publish the first build — the file uploads and the source auto-pushes to GitHub.',
    status: {
      pending: 'Pending',
      uploading: 'Uploading',
      pushed: 'Pushed',
      failed: 'Failed',
    },
    platform: {
      Android: 'Android',
      iOS: 'iOS',
      Web: 'Web',
      Backend: 'Backend',
      Other: 'Other',
    },
    col: {
      version: 'Version',
      platform: 'Platform',
      developer: 'Developer',
      artifact: 'File',
      git: 'GitHub',
      status: 'Status',
      date: 'Date',
    },
    composer: {
      title: 'Publish a new build',
      version: 'Version number',
      platform: 'Platform',
      artifact: 'Build file (APK/package)',
      pickFile: 'Choose the build file',
      gitHint: 'The source auto-pushes to the company GitHub and links to this build.',
      notes: 'Release notes',
      notesPlaceholder: 'What changed in this build?',
      publish: 'Publish build',
    },
  },
};

export default projectWorkspace;
