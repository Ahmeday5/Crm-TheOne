import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_ENDPOINTS } from '../../../core/constants/api-endpoints.const';
import { CACHE_TTL } from '../../../core/constants/cache-policy.const';
import {
  withCache,
  withCacheInvalidate,
  withInlineHandling,
} from '../../../core/http/http-context.tokens';
import { ApiService } from '../../../core/services/api.service';
import { ChannelSource, CreateChannelSourceRequest } from '../../../shared/models';

/**
 * HTTP boundary for `ChannelSources/*`. Channel sources are the platforms a
 * campaign runs on (Facebook / Google Ads / …). The list is small and changes
 * rarely, so the GET is cached longer than campaigns.
 */
@Injectable({ providedIn: 'root' })
export class ChannelSourcesService {
  private readonly api = inject(ApiService);

  list(): Observable<ChannelSource[]> {
    return this.api.get<ChannelSource[]>(API_ENDPOINTS.channelSources.list, {
      context: withCache({ ttlMs: CACHE_TTL.LONG }),
    });
  }

  add(payload: CreateChannelSourceRequest): Observable<ChannelSource> {
    return this.api.post<ChannelSource>(
      API_ENDPOINTS.channelSources.add,
      payload,
      { context: withInlineHandling(withCacheInvalidate(['ChannelSources'])) },
    );
  }
}
