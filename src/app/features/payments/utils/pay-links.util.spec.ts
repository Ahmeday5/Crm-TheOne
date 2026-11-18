import { PaymentMethodSnapshot } from '../models/payments.models';
import { detectPlatform, instapayUrl, localMobile, openAppUrl, publicPayUrl, ussdFor } from './pay-links.util';
import { providerOf } from './payment-providers.const';

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36';

function snapshot(patch: Partial<PaymentMethodSnapshot> = {}): PaymentMethodSnapshot {
  return {
    methodId: 1, type: 'InstaPay', accountName: 'The One', phoneNumber: null,
    instapayAddress: 'theone@instapay', instapayLink: null, instructions: null, ...patch,
  };
}

describe('pay-links', () => {
  describe('detectPlatform', () => {
    it('recognises Android, iPhone and desktop', () => {
      expect(detectPlatform(ANDROID_UA)).toBe('android');
      expect(detectPlatform(IPHONE_UA)).toBe('ios');
      expect(detectPlatform(WINDOWS_UA)).toBe('desktop');
    });
  });

  describe('localMobile', () => {
    it('normalises every Egyptian format to 01xxxxxxxxx', () => {
      expect(localMobile('+20 100 123 4567')).toBe('01001234567');
      expect(localMobile('201001234567')).toBe('01001234567');
      expect(localMobile('1001234567')).toBe('01001234567');
      expect(localMobile('01001234567')).toBe('01001234567');
      expect(localMobile(null)).toBe('');
    });
  });

  describe('openAppUrl', () => {
    const vf = providerOf('VodafoneCash');

    it('Android: launches the package and falls back to the Play Store', () => {
      const url = openAppUrl(vf, 'android');
      expect(url).toMatch(/^intent:#Intent;/);
      expect(url).toContain(`package=${vf.androidPackage};`);
      expect(url).toContain(`S.browser_fallback_url=${encodeURIComponent('https://play.google.com/store/apps/details?id=' + vf.androidPackage)}`);
      expect(url.endsWith(';end')).toBeTrue();
    });

    it('iOS: App Store search; desktop: Play Store page', () => {
      expect(openAppUrl(vf, 'ios')).toContain('apps.apple.com');
      expect(openAppUrl(vf, 'desktop')).toContain('play.google.com');
    });
  });

  describe('instapayUrl', () => {
    it('prefers the account’s https payment link (opens the recipient directly)', () => {
      const link = 'https://ipn.eg/S/theone/instapay/AbC123';
      expect(instapayUrl(snapshot({ instapayLink: link }), 'android')).toBe(link);
    });

    it('ignores a non-https link and opens the app instead', () => {
      expect(instapayUrl(snapshot({ instapayLink: 'javascript:alert(1)' }), 'android')).toMatch(/^intent:/);
      expect(instapayUrl(snapshot(), 'android')).toContain('package=com.egyptianbanks.instapay');
    });
  });

  describe('ussdFor', () => {
    it('Vodafone: one-shot code with number + whole-pound amount, # encoded for tel:', () => {
      const u = ussdFor('VodafoneCash', '+201001234567', 499.5)!;
      expect(u.code).toBe('*9*7*01001234567*500#');
      expect(u.telUrl).toBe('tel:*9*7*01001234567*500%23');
      expect(u.direct).toBeTrue();
    });

    it('wallets without a confirmed one-shot code dial their menu', () => {
      const u = ussdFor('EtisalatCash', '01001234567', 100)!;
      expect(u.code).toBe('*777#');
      expect(u.direct).toBeFalse();
    });

    it('falls back to the menu when the recipient number is missing', () => {
      expect(ussdFor('VodafoneCash', null, 100)!.code).toBe('*9#');
    });

    it('InstaPay has no USSD', () => {
      expect(ussdFor('InstaPay', '01001234567', 100)).toBeNull();
    });
  });

  it('publicPayUrl encodes the token on the given origin', () => {
    expect(publicPayUrl('a/b', 'https://crm.example')).toBe('https://crm.example/pay/a%2Fb');
  });
});
