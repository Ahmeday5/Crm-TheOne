import { TRANSLATIONS, interpolate, resolveKey } from '../../../core/i18n';
import { APP_TIME_ZONE } from '../../../core/constants/time-zone.const';
import { DiscountApproval } from '../models/discount-approvals.models';
import { approvalPageUrl, formatMoney, formatPercent } from './discount.util';

type Lang = 'ar' | 'en';

function translator(lang: Lang) {
  const dict = TRANSLATIONS[lang];
  return (key: string, params?: Record<string, string>) => interpolate(resolveKey(dict, `discounts.${key}`), params);
}

/**
 * The text a rep sends their manager (WhatsApp `*bold*`):
 *
 *   *طلب موافقة على خصم #12*
 *   • النوع: عرض سعر
 *   • العميل: Ahmed Ali
 *   • المبلغ قبل الخصم: 5,000 ج.م
 *   • الخصم: 750 ج.م (15%)
 *   • بعد الخصم: 4,250 ج.م
 *   • مقدّم الطلب: Mohamed
 *
 *   للموافقة أو الرفض:
 *   https://…/discount-approvals/12
 */
export function buildApprovalRequestText(a: DiscountApproval, lang: Lang, requesterName: string | null): string {
  const t = translator(lang);
  const money = (n: number) => `${formatMoney(n)} ${t('currency')}`;
  const lines = [
    `*${t('request.title')} #${a.id}*`,
    `• ${t('request.type', { type: t(`types.${a.type}`) })}`,
    `• ${t('request.customer', { name: a.customerName })}`,
    `• ${t('request.amount', { amount: money(a.amount) })}`,
    `• ${t('request.discount', { discount: money(a.discount), percent: formatPercent(a.percent) })}`,
    `• ${t('request.net', { net: money(a.netAmount) })}`,
  ];
  const requester = requesterName?.trim() || (a.requestedByName !== '—' ? a.requestedByName : '');
  if (requester) lines.push(`• ${t('request.requester', { name: requester })}`);
  lines.push('', t('request.link'), approvalPageUrl(a.id));
  return lines.join('\n');
}

/** The text an Admin sends back with the code. */
export function buildApprovalCodeText(a: DiscountApproval, lang: Lang): string {
  const t = translator(lang);
  const money = (n: number) => `${formatMoney(n)} ${t('currency')}`;
  const date = a.validUntil
    ? new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG' : 'en-GB', {
        timeZone: APP_TIME_ZONE,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }).format(new Date(a.validUntil))
    : '';
  return [
    t('codeMessage.title', { code: `*${a.code ?? ''}*` }),
    t('codeMessage.detail', {
      type: t(`types.${a.type}`),
      customer: a.customerName,
      discount: money(a.discount),
      percent: formatPercent(a.percent),
    }),
    t('codeMessage.valid', { date }),
  ].join('\n');
}
