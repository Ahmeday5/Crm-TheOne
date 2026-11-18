import { DailyReport, DailyReportListItem } from '../../../shared/models';
import { normalizeDailyReport, normalizeDailyReportListItem } from './daily-report.mapper';

describe('daily-report.mapper', () => {
  it('keeps valid project refs and drops broken ones', () => {
    const r = normalizeDailyReport({ id: 5, projects: [{ id: 13, title: 'dd' }, { id: 0, title: 'x' }, { id: 7, title: '' }] } as unknown as DailyReport);
    expect(r.projects).toEqual([{ id: 13, title: 'dd' }, { id: 7, title: '#7' }]);
  });

  it('turns missing links (old reports / old cache) into empty arrays', () => {
    expect(normalizeDailyReport({ id: 1 } as DailyReport).projects).toEqual([]);
    expect(normalizeDailyReportListItem({ id: 1 } as DailyReportListItem).projectNames).toEqual([]);
  });

  it('cleans list project names', () => {
    const row = normalizeDailyReportListItem({ id: 1, projectNames: ['dd', ' ', null] } as unknown as DailyReportListItem);
    expect(row.projectNames).toEqual(['dd']);
  });
});
