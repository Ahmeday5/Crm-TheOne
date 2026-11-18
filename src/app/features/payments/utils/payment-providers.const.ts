import { PaymentMethodType } from '../models/payments.models';

/**
 * How the payer's phone reaches each provider. Everything a provider may
 * change (app package, USSD menu) lives here — one place to fix.
 *
 * ⚠ Verify on a real phone before go-live (and after any provider update):
 *   - `androidPackage` = the id in the Play Store URL of the app.
 *   - `ussdDirect` is used only when filled: `{phone}` / `{amount}` are
 *     replaced. Leave it `null` when the one-shot code isn't confirmed — the
 *     page then dials `ussdMenu` and lists the steps instead.
 */
export interface PaymentProvider {
  type: PaymentMethodType;
  /** Translation key under `payments.providers.<type>`. */
  key: string;
  /** Short mark for the logo tile. */
  mark: string;
  /** Solid brand colour of the provider (logo tile only). */
  color: string;
  /** The app the payer opens — e.g. "Ana Vodafone". */
  appName: string;
  androidPackage: string;
  /** App Store search term (no hard-coded App Store ids). */
  iosSearch: string;
  /** Dialable menu, e.g. `*9#`. `null` = no USSD (InstaPay). */
  ussdMenu: string | null;
  /** One-shot transfer code template, e.g. `*9*7*{phone}*{amount}#`. */
  ussdDirect: string | null;
}

export const PAYMENT_PROVIDERS: Record<PaymentMethodType, PaymentProvider> = {
  InstaPay: {
    type: 'InstaPay',
    key: 'InstaPay',
    mark: 'IP',
    color: '#4b2c82',
    appName: 'InstaPay',
    androidPackage: 'com.egyptianbanks.instapay',
    iosSearch: 'InstaPay Egypt',
    ussdMenu: null,
    ussdDirect: null,
  },
  VodafoneCash: {
    type: 'VodafoneCash',
    key: 'VodafoneCash',
    mark: 'VF',
    color: '#e60000',
    appName: 'Ana Vodafone',
    androidPackage: 'com.emeint.android.myservices',
    iosSearch: 'Ana Vodafone',
    ussdMenu: '*9#',
    ussdDirect: '*9*7*{phone}*{amount}#',
  },
  EtisalatCash: {
    type: 'EtisalatCash',
    key: 'EtisalatCash',
    mark: 'e&',
    color: '#e00800',
    appName: 'e& money',
    androidPackage: 'com.etisalat',
    iosSearch: 'My Etisalat Egypt',
    ussdMenu: '*777#',
    ussdDirect: null,
  },
  OrangeCash: {
    type: 'OrangeCash',
    key: 'OrangeCash',
    mark: 'OR',
    color: '#ff7900',
    appName: 'My Orange',
    androidPackage: 'com.orange.mobinilandme',
    iosSearch: 'My Orange Egypt',
    ussdMenu: '#7115#',
    ussdDirect: null,
  },
  WePay: {
    type: 'WePay',
    key: 'WePay',
    mark: 'WE',
    color: '#5c2d91',
    appName: 'My WE',
    androidPackage: 'com.ucare.we',
    iosSearch: 'My WE',
    ussdMenu: '*551#',
    ussdDirect: null,
  },
};

export function providerOf(type: PaymentMethodType): PaymentProvider {
  return PAYMENT_PROVIDERS[type];
}
