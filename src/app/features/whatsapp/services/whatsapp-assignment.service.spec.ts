import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { WaAssignNumberRequest, WaInstance } from '../models/whatsapp.models';
import { makeChannel } from '../testing/whatsapp.testing';
import { WhatsAppApiService } from './whatsapp-api.service';
import { WhatsAppAssignmentService } from './whatsapp-assignment.service';

describe('WhatsAppAssignmentService', () => {
  let service: WhatsAppAssignmentService;
  let calls: [string, string | null][];
  let failFor: string | null;

  const number = makeChannel({ id: 'wa-1', type: 'whatsapp_cloud', assignedUserId: 'sara', assignedUserName: 'Sara' });
  const page = makeChannel({ id: 'fb-1', type: 'messenger', assignedUserId: 'sara', assignedUserName: 'Sara' });
  const all = [number, page];

  beforeEach(() => {
    calls = [];
    failFor = null;
    const api: Partial<WhatsAppApiService> = {
      assignNumber: (userId: string, body: WaAssignNumberRequest): Observable<WaInstance | null> => {
        calls.push([userId, body.instanceId]);
        return userId === failFor && body.instanceId ? throwError(() => ({ status: 400, message: 'taken' })) : of(null);
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: WhatsAppApiService, useValue: api }] });
    service = TestBed.inject(WhatsAppAssignmentService);
  });

  it('unassign clears everything, then gives back the owner’s other channel', () => {
    service.unassign(number, all).subscribe();
    expect(calls).toEqual([
      ['sara', null],
      ['sara', 'fb-1'],
    ]);
  });

  it('assigning a free channel is a single call', () => {
    service.assign(makeChannel({ id: 'wa-2' }), 'omar', all).subscribe();
    expect(calls).toEqual([['omar', 'wa-2']]);
  });

  it('moving a taken channel releases it (keeping the old owner’s page) then assigns', () => {
    service.assign(number, 'omar', all).subscribe();
    expect(calls).toEqual([
      ['sara', null],
      ['sara', 'fb-1'],
      ['omar', 'wa-1'],
    ]);
  });

  it('rolls back to the previous owner when the new assignment fails', () => {
    failFor = 'omar';
    let error: unknown = null;
    service.assign(number, 'omar', all).subscribe({ error: (e) => (error = e) });
    expect(calls[calls.length - 1]).toEqual(['sara', 'wa-1']);
    expect((error as { message: string }).message).toBe('taken');
  });
});
