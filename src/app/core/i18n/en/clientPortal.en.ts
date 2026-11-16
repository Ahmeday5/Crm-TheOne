import { TranslationFile } from '../i18n.types';

/** Client portal (`/portal`) + the client-request strings staff share. */
const clientPortal: TranslationFile<'clientPortal'> = {
  clientPortal: {
    nav: 'Portal menu',
    logout: 'Sign out',
    home: {
      title: 'My projects',
      greeting: 'Hello',
      subtitle: 'Follow your projects, and tell us about any problem or change.',
      empty: 'No projects are linked to your account yet',
      emptyHint: 'If you have a project with us and it isn’t here, contact your project manager.',
      open: 'Open project',
    },
    project: {
      back: 'My projects',
      progress: 'Progress',
      done: 'complete',
      milestones: 'Project plan',
      noMilestones: 'The plan is being prepared',
      expectedEnd: 'Expected delivery',
      lastUpdate: 'Last update',
      news: 'Latest news',
      cta: 'I have a problem / change request',
      notFound: 'This project doesn’t exist or isn’t available to your account',
    },
    milestone: {
      Done: 'Done',
      InProgress: 'In progress',
      Pending: 'Upcoming',
      due: 'Expected',
    },
    requests: {
      title: 'My requests',
      staffTitle: 'Client requests',
      all: 'All',
      openShort: 'open',
      emptyHint: 'Found a problem or need a change? Tap “I have a problem / change request”.',
      emptyStaff: 'The client hasn’t sent any requests yet',
      emptyFilter: 'No requests with this status',
    },
    newRequest: {
      title: 'New request',
      kind: 'Request type',
      titleLabel: 'Short title',
      titlePlaceholder: {
        Issue: 'e.g. The pay button doesn’t work',
        ChangeRequest: 'e.g. Add cash on delivery',
        Question: 'e.g. When is the next release?',
      },
      details: 'Describe it',
      detailsPlaceholder: 'What happened? Where exactly? What did you expect?',
      send: 'Send',
    },
    attach: {
      button: 'Attach files',
      drop: 'Drop images or files here, or click to choose',
      rules: 'Up to 10 files · 20 MB each · images, PDF, Office, video, audio, zip',
      clear: 'Clear attachments',
      skipped: {
        type: 'A file type that isn’t allowed was skipped',
        size: 'A file larger than 20 MB was skipped',
        empty: 'An empty file was skipped',
        tooMany: 'At most 10 files',
      },
    },
    type: {
      Issue: 'Problem',
      ChangeRequest: 'Change request',
      Question: 'Question',
    },
    typeHint: {
      Issue: 'Something doesn’t work right',
      ChangeRequest: 'Change or add something',
      Question: 'You have a question',
    },
    status: {
      Open: 'New',
      InReview: 'In review',
      InProgress: 'In progress',
      Resolved: 'Resolved',
      Closed: 'Closed',
    },
    priority: {
      High: 'High',
      Medium: 'Medium',
      Low: 'Low',
      untriaged: 'Needs priority',
    },
    role: {
      Client: 'Client',
      Admin: 'Admin',
      Developer: 'Developer',
      Team: 'Team',
    },
    staff: {
      status: 'Status',
      priority: 'Priority',
      assignee: 'Assignee',
      unassigned: 'Unassigned',
    },
    thread: {
      you: 'You',
      noRepliesClient: 'We got your request — the team will reply soon',
      noRepliesStaff: 'No replies yet — start by answering the client',
      replyPlaceholder: 'Write your reply… (Ctrl + Enter to send)',
      send: 'Send',
      closed: 'This request is closed — send a new one if the problem comes back.',
      reopenHint: 'Marked as resolved. Still a problem? Reply here and it goes back to review.',
    },
    errors: {
      load: 'Couldn’t load the data',
      requestNotFound: 'This request doesn’t exist or isn’t available to your account',
    },
  },
};

export default clientPortal;
