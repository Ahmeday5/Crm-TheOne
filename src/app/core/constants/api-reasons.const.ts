/**
 * Backend `data.reason` codes (Client Portal v2 contract §2) → UI messages.
 * `errorInterceptor` uses these instead of the raw server text, filling
 * `{param}` from `error.data` (`{mmss}` comes from Retry-After).
 */
export const API_REASON_MESSAGES: Record<string, { ar: string; en: string }> = {
  allocation_total_must_be_100: { ar: 'مجموع النسب لازم يبقى 100% (دلوقتي {total}%)', en: 'Shares must total exactly 100% (now {total}%)' },
  share_completion_required: { ar: 'اكتب نسبة الإنجاز من الجزء بتاعك', en: 'Enter how much of your part is done' },
  share_completion_below_current: { ar: 'نسبتك الحالية {current}% — مينفعش تقل عنها', en: "Your current completion is {current}% — it can't go down" },
  only_latest_report_progress_editable: { ar: 'النسبة بتتعدل في آخر تقرير بس', en: 'Progress can only be edited on your latest report' },
  report_date_in_future: { ar: 'مينفعش تكتب تقرير ليوم لسه مجاش', en: "You can't report for a future date" },
  report_date_outside_project: { ar: 'التاريخ برا مدة المشروع', en: 'The date is outside the project period' },
  non_working_day: { ar: 'الجمعة والسبت أجازة', en: 'Friday and Saturday are days off' },
  already_reported_today: { ar: 'كتبت تقرير النهارده بالفعل — عدّله', en: 'You already reported today — edit it instead' },
  adjust_reason_required: { ar: 'اكتب سبب التعديل (5 حروف على الأقل)', en: 'Enter a reason (at least 5 characters)' },
  milestone_due_outside_project: { ar: 'ميعاد المرحلة لازم يكون جوه مدة المشروع', en: 'The due date must be within the project period' },
  project_closed: { ar: 'المشروع مقفول — مينفعش تعدّل مراحله', en: "The project is closed — milestones can't change" },
  milestone_delete_admin_only: { ar: 'مسح المراحل للأدمن بس', en: 'Only an admin can delete milestones' },
  project_not_found: { ar: 'المشروع مش موجود أو مش متاح ليك', en: 'Project not found or not available to you' },
  link_invalid: { ar: 'الرابط ده مش صحيح', en: 'This link is not valid' },
  link_revoked: { ar: 'الرابط ده اتلغى — كلّمنا عشان رابط جديد', en: 'This link was revoked — contact us for a new one' },
  link_expired: { ar: 'صلاحية الرابط انتهت — كلّمنا عشان رابط جديد', en: 'This link has expired — contact us for a new one' },
  pin_required: { ar: 'الرابط محمي برقم سري', en: 'This link is protected by a PIN' },
  pin_invalid: { ar: 'الرقم السري غلط', en: 'Wrong PIN' },
  pin_locked: { ar: 'محاولات كتير — جرّب بعد {mmss}', en: 'Too many attempts — try again in {mmss}' },
  rate_limited: { ar: 'طلبات كتير — جرّب بعد {mmss}', en: 'Too many requests — try again in {mmss}' },
  customer_inactive: { ar: 'الحساب ده مش متاح دلوقتي', en: 'This account is not available' },
  invalid_link_scope: { ar: 'اختار مشروع واحد على الأقل من مشاريع العميل', en: "Select at least one of this customer's projects" },
  invalid_pin_format: { ar: 'الرقم السري من 4 لـ 6 أرقام', en: 'The PIN must be 4–6 digits' },
  client_access_replaced_by_link: { ar: 'حسابات العملاء اتشالت — استخدم رابط العميل', en: 'Client accounts were replaced by client links' },
  invalid_url: { ar: 'الرابط لازم يبدأ بـ http:// أو https://', en: 'The URL must start with http:// or https://' },
  aab_not_installable: { ar: 'ملف ‎.aab‎ مبيتسطبش على الموبايل — ارفع ‎.apk', en: ".aab files can't be installed — upload an .apk" },
  invalid_apk_file: { ar: 'الملف ده مش APK سليم', en: 'This is not a valid APK file' },
  file_type_not_allowed: { ar: 'نوع الملف ده مش مسموح للمنصة دي', en: "This file type isn't allowed for this platform" },
  file_too_large: { ar: 'الملف أكبر من {max}', en: 'The file is larger than {max}' },
  file_or_external_url_required: { ar: 'ارفع ملف أو حط رابط خارجي', en: 'Upload a file or add an external link' },
  invalid_version_name: { ar: 'رقم النسخة حروف/أرقام و . - _ بس', en: 'Version may only contain letters, digits, . - _' },
  version_exists: { ar: 'النسخة دي موجودة بالفعل على المنصة دي', en: 'This version already exists for this platform' },
  duplicate_release_file: { ar: 'نفس الملف ده اترفع قبل كده', en: 'This exact file was already uploaded' },
  release_delete_not_allowed: { ar: 'المسح للأدمن أو لصاحب النسخة خلال 24 ساعة', en: 'Only an admin, or the uploader within 24 h, can delete' },
  release_has_no_file: { ar: 'النسخة دي رابط خارجي — افتح الرابط', en: 'This release is an external link' },
  download_link_expired: { ar: 'لينك التحميل انتهى — اطلب واحد جديد', en: 'The download link expired — get a new one' },
  concurrency_conflict: { ar: 'حد عدّل البيانات دي في نفس الوقت — هنحدّث الصفحة', en: 'Someone changed this at the same time — reloading' },
};

export function reasonMessage(reason: string | undefined, data: Record<string, unknown> | undefined, isAr: boolean, retryAfterSec?: number): string | null {
  const entry = reason ? API_REASON_MESSAGES[reason] : undefined;
  if (!entry) return null;
  const secs = Math.max(0, Math.round(retryAfterSec ?? Number(data?.['retryAfterSeconds'] ?? 0)));
  const params: Record<string, unknown> = {
    ...data,
    mmss: `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`,
  };
  return (isAr ? entry.ar : entry.en).replace(/\{(\w+)\}/g, (m, k) => (params[k] ?? '') === '' ? m : String(params[k]));
}
