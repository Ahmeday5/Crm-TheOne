import { TranslationFile } from '../i18n.types';

const goals: TranslationFile<'goals'> = {
  goals: {
    title: 'Goals & Motivation',
    subtitle: 'Track goals and motivate your team to achieve exceptional results',
    myTitle: 'My Goals',
    mySubtitle: 'Goals assigned to you — track your progress and earn rewards',
    addNew: 'Add New Goal',
    noGoals: 'No goals yet',
    noGoalsHint: 'Add a new goal to motivate the sales team',
    noMyGoals: 'No goals assigned to you',
    noMyGoalsHint: 'Goals assigned by your manager will appear here',

    kpi: {
      total: 'Total Goals',
      active: 'Active Goals',
      individual: 'Individual Goals',
      team: 'Team Goals',
      achieved: 'Achieved',
      inProgress: 'In Progress',
      totalPoints: 'Total Points',
    },

    stats: {
      title: 'Goals Statistics',
      breakdown: 'Earned Points Breakdown',
      breakdownEmpty: 'No points earned yet',
      colGoal: 'Goal',
      colType: 'Type',
      colPeriod: 'Period',
      colPoints: 'Points',
      colReward: 'Reward (EGP)',
      colUser: 'Employee',
      colAchievedAt: 'Achieved At',
      colFrom: 'From',
      colTo: 'To',
    },

    type: {
      label: 'Goal Type',
      Individual: 'Individual',
      Team: 'Team',
    },

    period: {
      label: 'Time Period',
      Daily: 'Daily',
      Weekly: 'Weekly',
      Monthly: 'Monthly',
      Yearly: 'Yearly',
    },

    status: {
      active: 'Active',
      upcoming: 'Upcoming',
      expired: 'Expired',
      achieved: 'Achieved',
      inProgress: 'In Progress',
    },

    card: {
      target: 'Target',
      points: 'Points',
      reward: 'Financial Reward',
      assignedTo: 'Assigned to',
      createdBy: 'Created by',
      period: 'Period',
      daysLeft: 'days left',
      dayLeft: 'day left',
      daysAgo: 'd',
      ended: 'Ended',
      startsIn: 'Starts in',
      currency: 'EGP',
      currentProgress: 'Current Progress',
      progressOf: 'of',
      achievedOn: 'Achieved on',
      updateProgress: 'Update Progress',
      notStarted: 'Not started yet',
    },

    progress: {
      title: 'Update Progress',
      subtitle: 'Enter the new progress value',
      currentLabel: 'Current Progress',
      targetLabel: 'Target',
      newValueLabel: 'New Value',
      newValuePh: 'Enter progress value...',
      previewLabel: 'New percentage',
      willAchieve: '🏆 Goal will be achieved!',
      update: 'Update',
      cancel: 'Cancel',
    },

    celebration: {
      title: 'Congratulations! You achieved your goal!',
    },

    form: {
      createTitle: 'Add New Goal',
      editTitle: 'Edit Goal',
      title: 'Goal Title',
      titlePh: 'e.g. Achieve 50 sales this month',
      description: 'Description',
      descriptionPh: 'Detailed description of the goal and how to achieve it...',
      type: 'Goal Type',
      period: 'Time Period',
      targetValue: 'Target Value',
      targetValuePh: 'e.g. 5000',
      points: 'Points',
      pointsPh: 'e.g. 100',
      financialReward: 'Financial Reward (EGP)',
      financialRewardPh: 'e.g. 500',
      startDate: 'Start Date',
      endDate: 'End Date',
      assignedTo: 'Assign to Employee',
      assignedToPh: 'Select a sales employee...',
      endDateHint: 'Must be at least 1 day after the start date',
      save: 'Save Goal',
      update: 'Save Changes',
      cancel: 'Cancel',
    },

    confirm: {
      deleteTitle: 'Delete Goal',
      deleteMessage: 'Are you sure you want to delete this goal? This action cannot be undone.',
      deleteConfirm: 'Delete',
      deleteCancel: 'Cancel',
    },

    messages: {
      loadFailed: 'Failed to load goals, please try again',
      statsLoadFailed: 'Failed to load statistics',
      createSuccess: 'Goal created successfully',
      createFailed: 'Failed to create goal',
      updateSuccess: 'Goal updated successfully',
      updateFailed: 'Failed to update goal',
      deleteSuccess: 'Goal deleted successfully',
      deleteFailed: 'Failed to delete goal',
      progressUpdated: 'Progress updated successfully ✓',
      progressFailed: 'Failed to update progress',
      salesLoadFailed: 'Failed to load employees list',
    },

    filter: {
      all: 'All',
      active: 'Active',
      upcoming: 'Upcoming',
      expired: 'Expired',
      individual: 'Individual',
      team: 'Team',
      search: 'Search',
      searchPh: 'Search for a goal...',
      byPeriod: 'Period',
      byAchieved: 'Status',
      achievedAll: 'All',
      achievedYes: 'Achieved',
      achievedNo: 'In Progress',
    },

    leaderboard: {
      title: 'Leaderboard',
      subtitle: 'Employees ranked by earned points',
      empty: 'No data yet',
      goalsAchieved: 'goal(s) achieved',
      pointsUnit: 'pts',
    },

    detail: {
      title: 'Goal Details',
      viewStats: 'View Details',
      achievementRate: 'Achievement Rate',
      assignedTo: 'Assigned to',
      createdBy: 'Created by',
    },
  },
};

export default goals;
