/**
 * Maps error codes (shared by `validateLeaveRequest` and the API's `code`
 * field) to translation keys under `attendance.errors`. Unknown codes return
 * `null` so the caller can fall back to the server's message.
 */
const KNOWN_CODES = new Set([
  'endBeforeStart',
  'startInPast',
  'halfDayRange',
  'noWorkingDays',
  'overlap',
  'insufficientBalance',
  'alreadyCheckedIn',
  'alreadyCheckedOut',
  'notCheckedIn',
  'notPending',
  'reasonRequired',
  'notFound',
  'forbidden',
]);

export function leaveErrorKey(code: string): string | null {
  return KNOWN_CODES.has(code) ? `attendance.errors.${code}` : null;
}
