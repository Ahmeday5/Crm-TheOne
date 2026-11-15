import { makeMessage } from '../testing/whatsapp.testing';
import { MEDIA_DOWNLOAD_GRACE_MS, mediaAvailability } from './whatsapp.util';

describe('mediaAvailability (files are stored server-side after the message arrives)', () => {
  const sentAt = '2026-11-15T10:00:00Z';
  const t0 = Date.parse(sentAt);

  it('is ready once mediaUrl is set', () => {
    expect(mediaAvailability(makeMessage({ messageType: 'image', mediaUrl: '/Images/WhatsApp/in/x.jpg', sentAt }), t0)).toBe('ready');
  });

  it('is loading while the server is still fetching the file', () => {
    for (const type of ['image', 'video', 'audio', 'voice', 'document', 'sticker']) {
      expect(mediaAvailability(makeMessage({ messageType: type as never, sentAt }), t0 + 5_000)).withContext(type).toBe('loading');
    }
  });

  it('gives up after the grace period (or on a reload of an old message)', () => {
    expect(mediaAvailability(makeMessage({ messageType: 'voice', sentAt }), t0 + MEDIA_DOWNLOAD_GRACE_MS + 1)).toBe('unavailable');
  });

  it('does not apply to text, templates or notes', () => {
    for (const type of ['text', 'template', 'location', 'reaction']) {
      expect(mediaAvailability(makeMessage({ messageType: type as never, sentAt }), t0)).withContext(type).toBe('none');
    }
  });
});
