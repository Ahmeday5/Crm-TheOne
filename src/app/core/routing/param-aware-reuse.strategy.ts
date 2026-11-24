import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, BaseRouteReuseStrategy, Data, Params } from '@angular/router';

/** Route `data` flag read by {@link ParamAwareRouteReuseStrategy}. */
export const RECREATE_ON_PARAM_CHANGE = 'recreateOnParamChange';

/**
 * Marks a route whose page is keyed by its path params (`/projects/:id`, …):
 * moving to the same route with different params builds a fresh component
 * instead of reusing the current one.
 *
 *   { path: 'projects/:id', data: recreateOnParamChange({ roles: [...] }), … }
 *
 * Use it for pages that read their params once (`route.snapshot`) and wire
 * their state from them. Pages that already react to `paramMap` (chat lists,
 * boards that keep a sidebar) should NOT opt in — they'd lose that state.
 */
export function recreateOnParamChange(data: Data = {}): Data {
  return { ...data, [RECREATE_ON_PARAM_CHANGE]: true };
}

/**
 * Angular's default strategy reuses a component whenever the route config is
 * the same, so `/projects/34 → /projects/33` (e.g. from a notification) keeps
 * project 34 on screen until a refresh. This strategy keeps that default for
 * every route, except opted-in routes whose **path** params changed.
 * Query-param changes (`?tab=`) never re-create the page.
 */
@Injectable()
export class ParamAwareRouteReuseStrategy extends BaseRouteReuseStrategy {
  override shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    if (future.routeConfig !== curr.routeConfig) return false;
    // Own config only — the flag must not leak to child routes through inherited data.
    if (!future.routeConfig?.data?.[RECREATE_ON_PARAM_CHANGE]) return true;
    return sameParams(future.params, curr.params);
  }
}

function sameParams(a: Params, b: Params): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => a[k] === b[k]);
}
