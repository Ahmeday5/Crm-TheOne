/**
 * Typed models for the WhatsApp Sessions gateway
 * (`{environment.whatsappApiUrl}/sessions/*`).
 *
 * The gateway wraps every payload in a `{ success, data }` envelope — see
 * `ApiEnvelope<T>`. The session-details endpoint is the one exception: it
 * carries a sibling `health` block alongside `data`.
 */

/** Connection lifecycle as reported by the gateway. */
export type SessionStatus =
  | 'connected'
  | 'connecting'
  | 'disconnected'
  | (string & {});

/** How a session authenticates with WhatsApp. */
export type ConnectionMethod = 'qr' | 'code';

/** Heartbeat-derived health classification. */
export type HealthStatus =
  | 'healthy'
  | 'warning'
  | 'offline'
  | 'unknown'
  | (string & {});

/** Standard success envelope used by every endpoint. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  message?: string;
}

// ─────────────── sessions ───────────────

export interface Session {
  id: number;
  name: string;
  status: SessionStatus;
  health_status: HealthStatus;
  connection_method: ConnectionMethod;
  phone: string | null;
  pushname: string | null;
  profile_pic: boolean;
  last_connected_at: string | null;
  last_heartbeat_at: string | null;
  created_at: string;
}

export type SessionsResponse = ApiEnvelope<Session[]>;

/** Session details share the list shape; the endpoint adds a `health` sibling. */
export type SessionDetails = Session;

export interface SessionHealthSummary {
  healthy: boolean;
  status: SessionStatus;
}

export interface SessionDetailsResponse {
  success: boolean;
  data: SessionDetails;
  health: SessionHealthSummary;
}

// ─────────────── create ───────────────

export interface CreateSessionRequest {
  name: string;
  connection_method: ConnectionMethod;
}

export type CreateSessionResponse = ApiEnvelope<SessionDetails>;

// ─────────────── QR ───────────────

export interface QrData {
  status: SessionStatus;
  qr_code: string;
  /** Ready-to-render `data:image/png;base64,…` string. */
  qr_image: string;
}

export type QrResponse = ApiEnvelope<QrData>;

// ─────────────── pairing ───────────────

export interface PairRequest {
  phone_number: string;
}

export interface PairData {
  status?: SessionStatus;
  /** The gateway may serialize the pairing code under either key. */
  pairing_code?: string;
  code?: string;
}

export type PairResponse = ApiEnvelope<PairData>;

// ─────────────── status ───────────────

export interface WidInfo {
  _serialized: string;
  user: string;
  server: string;
}

export interface ClientInfo {
  pushname: string;
  wid: WidInfo;
  me: WidInfo;
  platform: string;
}

export interface SessionStatusData {
  status: SessionStatus;
  connectionCode: string | null;
  clientInfo: ClientInfo | null;
}

export type SessionStatusResponse = ApiEnvelope<SessionStatusData>;

// ─────────────── health ───────────────

export interface SessionHealthData {
  status: SessionStatus;
  health_status: HealthStatus;
  last_heartbeat_at: string | null;
  consecutive_failures: number;
  last_connected_at: string | null;
}

export type SessionHealthResponse = ApiEnvelope<SessionHealthData>;

// ─────────────── lifecycle actions ───────────────

/** start / stop / restart / delete return the standard envelope with no payload. */
export type ActionResponse = ApiEnvelope<unknown>;
