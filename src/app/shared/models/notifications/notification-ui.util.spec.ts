import { notificationIcon, notificationRoute, notificationTone } from './notification-ui.util';

describe('contract notifications', () => {
  const n = (type: string, id: number | null = 42) => ({
    type,
    relatedEntityType: id === null ? null : 'Contract',
    relatedEntityId: id,
  });

  it('open the contract page for Admin and Sales', () => {
    for (const type of ['ContractExpiringSoon', 'ContractExpired', 'ContractRenewed']) {
      expect(notificationRoute(n(type), 'Admin')).toEqual(['/contracts', '42']);
      expect(notificationRoute(n(type), 'Sales')).toEqual(['/contracts', '42']);
      expect(notificationRoute(n(type), 'Support')).toBeNull();
    }
  });

  it('fall back to the contracts list without an id', () => {
    expect(notificationRoute(n('ContractExpired', null), 'Admin')).toEqual(['/contracts-management']);
  });

  it('use amber clock / red / green check', () => {
    expect(notificationIcon('ContractExpiringSoon')).toContain('hourglass');
    expect(notificationTone('ContractExpiringSoon')).toBe('warning');
    expect(notificationTone('ContractExpired')).toBe('danger');
    expect(notificationIcon('ContractRenewed')).toContain('check');
    expect(notificationTone('ContractRenewed')).toBe('success');
  });

  it('never break on unknown types', () => {
    expect(notificationIcon('SomethingNew')).toBe('fa-solid fa-bell');
    expect(notificationTone('SomethingNew')).toBe('primary');
    expect(notificationRoute({ type: 'SomethingNew', relatedEntityType: 'Mystery', relatedEntityId: 1 }, 'Admin')).toBeNull();
  });
});
