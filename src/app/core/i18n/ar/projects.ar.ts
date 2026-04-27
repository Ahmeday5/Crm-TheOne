import { TranslationFile } from '../i18n.types';

const projects: TranslationFile<'projects'> = {
  projects: {
    title: 'المشاريع والمهام',
    subtitle: 'مرحباً بك! إليك ما يحدث اليوم.',
    tabs: {
      projects: 'لوحة المشاريع',
      tasks: 'إدارة المهام',
    },
    manage: { title: 'إدارة المشاريع' },
    project: {
      name: 'اسم المشروع',
      client: 'العميل',
      manager: 'مدير المشروع',
      startDate: 'تاريخ البداية',
      deadline: 'الموعد النهائي',
      progress: 'التقدم',
      status: 'الحالة',
      team: 'الفريق',
      statuses: { planning: 'تخطيط', active: 'نشط', onHold: 'معلق', completed: 'مكتمل' },
    },
    tasks: {
      title: 'إدارة المهام',
      add: 'إضافة مهمة',
      name: 'اسم المهمة',
      assignee: 'المسؤول',
      dueDate: 'تاريخ الاستحقاق',
      priority: 'الأولوية',
      status: 'الحالة',
      statuses: { todo: 'قائمة المهام', inProgress: 'قيد التنفيذ', review: 'مراجعة', done: 'مكتملة' },
    },
  },
};

export default projects;
