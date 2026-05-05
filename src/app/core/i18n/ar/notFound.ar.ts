import { TranslationFile } from '../i18n.types';

const notFound: TranslationFile<'notFound'> = {
  notFound: {
    title: 'الصفحة غير موجودة',
    message: 'الصفحة التي تحاول الوصول إليها غير موجودة، أو ربما تم نقلها أو حذفها.',
    back: 'الرجوع للخلف',
    home: 'الذهاب إلى الرئيسية',
    hint: 'تأكد من العنوان أو ارجع إلى الصفحة الرئيسية لمتابعة العمل.',
  },
};

export default notFound;
