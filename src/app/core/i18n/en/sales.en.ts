import { TranslationFile } from '../i18n.types';

const sales: TranslationFile<'sales'> = {
  sales: {
    title: 'Sales pipeline',
    subtitle: "Welcome back! Here's what's happening today.",
    tabs: {
      line: 'Pipeline',
      priceOffers: 'Price offers',
      contracts: 'Contracts',
      followUps: 'Follow-ups',
    },
    lostBanner: {
      title: 'Lost deals tracking',
      stage: 'Lost deals (incomplete)',
      desc: 'When a lead is moved to the lost-deals stage, their data is automatically logged with the loss reason and sent to marketing.',
      analysisTitle: 'How it appears in sales analysis:',
      a1: 'The lead is listed in the "non-buying clients" list',
      a2: 'The reason for losing the deal is shown clearly for analysis',
      a3: 'Marketing can analyze reasons to improve future campaigns',
      a4: 'Data helps understand weaknesses and develop better strategies',
    },
    line: {
      title: 'Sales pipeline',
      subtitle: 'Track deals at every stage',
      pipeline: 'Pipeline',
      stages: {
        prospecting: 'Prospecting',
        qualified: 'Qualified',
        proposal: 'Proposal',
        negotiation: 'Negotiation',
        closed: 'Closed',
      },
    },
    priceOffers: {
      title: 'Price offers',
      add: 'New price offer',
      number: 'Offer #',
      client: 'Client',
      total: 'Total',
      validUntil: 'Valid until',
    },
    contracts: {
      title: 'Contracts',
      number: 'Contract #',
      startDate: 'Start date',
      endDate: 'End date',
      value: 'Contract value',
    },
    followUps: {
      title: 'Follow-ups',
      next: 'Next follow-up',
      previous: 'Last follow-up',
      type: 'Follow-up type',
    },
    deal: {
      details: 'Deal details',
      stage: 'Stage',
      value: 'Deal value',
      probability: 'Close probability',
      expectedClose: 'Expected close',
      owner: 'Owner',
      timeline: 'Timeline',
      activities: 'Activities',
      attachments: 'Attachments',
    },
  },
};

export default sales;
