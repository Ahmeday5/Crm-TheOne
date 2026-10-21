import { TranslationFile } from '../i18n.types';

const account: TranslationFile<'account'> = {
  account: {
    title: 'حسابي',
    subtitle: 'بياناتك الشخصية وصورة الحساب',
    photo: {
      title: 'صورة الحساب',
      hint: 'تظهر صورتك في الشريط العلوي وبجوار اسمك في كل أنحاء النظام.',
      rules: 'صورة فقط (JPG أو PNG أو WebP) بحجم أقصى',
      change: 'تغيير الصورة',
      upload: 'رفع صورة',
      remove: 'حذف الصورة',
      save: 'حفظ الصورة',
      cancel: 'إلغاء',
      previewNotice: 'معاينة — اضغط «حفظ الصورة» لتطبيقها',
      uploaded: 'تم تحديث صورة الحساب بنجاح',
      uploadFailed: 'تعذر رفع الصورة',
      removed: 'تم حذف صورة الحساب',
      removeFailed: 'تعذر حذف الصورة',
      confirmRemoveTitle: 'حذف صورة الحساب',
      confirmRemoveMessage: 'هل تريد حذف صورة حسابك؟ سيظهر الحرف الأول من اسمك بدلاً منها.',
    },
    info: {
      title: 'بيانات الحساب',
      fullName: 'الاسم',
      email: 'البريد الإلكتروني',
      phone: 'الهاتف',
      role: 'الدور',
    },
  },
};

export default account;
