/** Row returned by `GET /ChannelSources`. */
export interface ChannelSource {
  id: number;
  name: string;
}

/** Body for `POST /ChannelSources`. */
export interface CreateChannelSourceRequest {
  name: string;
}
