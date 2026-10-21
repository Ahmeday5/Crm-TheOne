import { TranslationFile } from '../i18n.types';

const account: TranslationFile<'account'> = {
  account: {
    title: 'My account',
    subtitle: 'Your personal details and profile photo',
    photo: {
      title: 'Profile photo',
      hint: 'Your photo appears in the top bar and next to your name across the system.',
      rules: 'Images only (JPG, PNG or WebP), up to',
      change: 'Change photo',
      upload: 'Upload photo',
      remove: 'Remove photo',
      save: 'Save photo',
      cancel: 'Cancel',
      previewNotice: 'Preview — press “Save photo” to apply it',
      uploaded: 'Profile photo updated',
      uploadFailed: 'Could not upload the photo',
      removed: 'Profile photo removed',
      removeFailed: 'Could not remove the photo',
      confirmRemoveTitle: 'Remove profile photo',
      confirmRemoveMessage: 'Remove your profile photo? Your initial will be shown instead.',
    },
    info: {
      title: 'Account details',
      fullName: 'Name',
      email: 'Email',
      phone: 'Phone',
      role: 'Role',
    },
  },
};

export default account;
