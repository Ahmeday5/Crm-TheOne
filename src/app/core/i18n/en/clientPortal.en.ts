import { TranslationFile } from '../i18n.types';

/** Client portal (the project owner's view) + staff answering client requests. */
const clientPortal: TranslationFile<'clientPortal'> = {
  clientPortal: {
    home: {
      title: 'My projects',
      greeting: 'Hello',
      subtitle: 'Follow your projects and tell us about any problem or change you need',
      empty: 'No projects are linked to your account yet',
      emptyHint: 'If you have a project with us and it isn’t here, contact your project manager.',
      openRequests: 'open request(s)',
      noOpenRequests: 'No open requests',
      open: 'Open project',
    },
    project: {
      subtitle: 'Where your project stands',
      back: 'My projects',
      progress: 'Progress',
      done: 'complete',
      status: 'Status',
      milestones: 'Milestones',
      started: 'Started',
      expectedEnd: 'Expected delivery',
      lastUpdate: 'Last update',
      updates: 'Latest updates',
      noUpdates: 'No updates yet',
      notFound: 'This project doesn’t exist or isn’t available to your account',
    },
    milestone: {
      Done: 'Done',
      InProgress: 'In progress',
      Pending: 'Not started',
    },
    requests: {
      title: 'My requests',
      staffTitle: 'Client requests',
      new: 'New request',
      open: 'Open',
      all: 'All',
      emptyOpen: 'No open requests',
      emptyAll: 'No requests yet',
      emptyHint: 'Found a problem or need a change? Send it here and the team will reply.',
    },
    newRequest: {
      title: 'New request',
      kind: 'Request type',
      titleLabel: 'Short title',
      titlePlaceholder: 'e.g. The pay button doesn’t work',
      details: 'Describe it',
      detailsPlaceholder: 'What happened? Where exactly? What did you expect?',
      attach: 'Attach images or files',
      attachHint: 'Up to 5 files · 10 MB each',
      send: 'Send request',
    },
    type: {
      Issue: 'Problem',
      ChangeRequest: 'Change',
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
      none: 'No priority',
      untriaged: 'Needs triage',
    },
    role: {
      Client: 'Client',
      Staff: 'Team',
    },
    staff: {
      status: 'Status',
      priority: 'Priority',
    },
    thread: {
      noReplies: 'No replies yet — the team will reply soon',
      replyPlaceholder: 'Write your reply… (Ctrl + Enter to send)',
      send: 'Send',
      closed: 'This request is closed — open a new one if the problem comes back.',
    },
    errors: {
      send: 'Couldn’t send, please try again',
    },
  },
};

export default clientPortal;
