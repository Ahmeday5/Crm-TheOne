import { ActivatedRouteSnapshot, Params, Route } from '@angular/router';
import { ParamAwareRouteReuseStrategy, recreateOnParamChange } from './param-aware-reuse.strategy';

function snap(routeConfig: Route | null, params: Params): ActivatedRouteSnapshot {
  return { routeConfig, params } as ActivatedRouteSnapshot;
}

describe('ParamAwareRouteReuseStrategy', () => {
  const strategy = new ParamAwareRouteReuseStrategy();
  const keyed: Route = { path: 'projects/:id', data: recreateOnParamChange({ roles: ['Admin'] }) };
  const plain: Route = { path: 'whatsapp/chats/:chatId' };

  it('re-creates an opted-in route when a path param changes', () => {
    expect(strategy.shouldReuseRoute(snap(keyed, { id: '33' }), snap(keyed, { id: '34' }))).toBeFalse();
  });

  it('reuses an opted-in route when its params are unchanged (query-only change)', () => {
    expect(strategy.shouldReuseRoute(snap(keyed, { id: '33' }), snap(keyed, { id: '33' }))).toBeTrue();
  });

  it('keeps Angular’s default for routes that did not opt in', () => {
    expect(strategy.shouldReuseRoute(snap(plain, { chatId: '1' }), snap(plain, { chatId: '2' }))).toBeTrue();
  });

  it('never reuses across different route configs', () => {
    expect(strategy.shouldReuseRoute(snap(keyed, { id: '1' }), snap(plain, { chatId: '1' }))).toBeFalse();
  });

  it('keeps the route’s other data', () => {
    expect(keyed.data?.['roles']).toEqual(['Admin']);
  });
});
