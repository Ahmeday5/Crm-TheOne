import { TRANSLATIONS, interpolate, resolveKey } from '../../../core/i18n';
import { APP_TIME_ZONE } from '../../../core/constants/time-zone.const';
import { PaymentRequest } from '../models/payments.models';
import { publicPayUrl } from './pay-links.util';

type Lang = 'ar' | 'en';

export interface PaymentMessageOptions {
  lang: Lang;
  /** Company / trade name from the CRM settings — omitted lines when empty. */
  company?: string | null;
  /** The employee sending the link. */
  agent?: string | null;
  /** WhatsApp renders `*bold*`; Messenger / Instagram would show the asterisks. */
  rich?: boolean;
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Short human reference the customer writes in the transfer note (`#41`). */
export function paymentReference(request: Pick<PaymentRequest, 'id'>): string {
  return `#${request.id}`;
}

/**
 * The chat message that carries the link:
 *
 *   أهلاً Ahmed Ali 👋
 *   معاك Mohamed Fathy من *The One System*.
 *
 *   طلب دفع رقم *#41*
 *   • المبلغ: *1,000 ج.م*
 *   • مقابل: test
 *   • طريقة الدفع: انستاباي — باسم The One System
 *
 *   ادفع من الرابط ده (بيفتح التطبيق على طول):
 *   https://…/pay/…
 *
 *   📌 اكتب رقم الطلب #41 في ملاحظات التحويل.
 *   ⏳ الرابط صالح حتى 19 نوفمبر 2026.
 *
 *   لأي استفسار رد على الرسالة دي.
 *   شكراً لثقتك في The One System 🤝
 *
 * The URL sits alone on its line so WhatsApp makes it tappable (with a preview).
 */
export function buildPaymentMessage(request: PaymentRequest, options: PaymentMessageOptions): string {
  const { lang } = options;
  const dict = TRANSLATIONS[lang];
  const t = (key: string, params?: Record<string, string>) =>
    interpolate(resolveKey(dict, `payments.message.${key}`), params);
  const b = (value: string) => (options.rich && value ? `*${value}*` : value);

  const company = options.company?.trim() || '';
  const agent = options.agent?.trim() || '';
  const ref = paymentReference(request);
  const date = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    timeZone: APP_TIME_ZONE,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(request.expiresAt));
  const method = resolveKey(dict, `payments.providers.${request.method.type}`);
  const holder = request.method.accountName?.trim();

  const lines: string[] = [request.customerName ? t('hello', { name: request.customerName }) : t('helloNoName')];
  if (company) lines.push(agent ? t('intro', { agent, company: b(company) }) : t('introTeam', { company: b(company) }));

  lines.push('', t('title', { ref: b(ref) }), `• ${t('amount', { amount: b(`${formatAmount(request.amount)} ${t('currency')}`) })}`);
  if (request.description) lines.push(`• ${t('for', { description: request.description })}`);
  lines.push(`• ${holder ? t('viaHolder', { method, holder }) : t('via', { method })}`);

  lines.push('', t('link'), publicPayUrl(request.token), '', `📌 ${t('note', { ref })}`, `⏳ ${t('expires', { date })}`);

  lines.push('', t('help'));
  if (company) lines.push(t('thanks', { company }));
  return lines.join('\n');
}
