import { TranslationFile } from '../i18n.types';

/** The vault page lock (separate vault password). */
const vaultLock: TranslationFile<'vaultLock'> = {
  vaultLock: {
    statusFailed: 'Couldn’t check the vault lock status',
    show: 'Show password',
    hide: 'Hide password',
    setup: {
      title: 'Set a vault password',
      subtitle: 'The vault holds sensitive data, so it gets its own password.',
      fact1: 'Anyone opening the vault — even another admin — will need this password.',
      fact2: 'It’s separate from your login password.',
      fact3: 'Keep it somewhere safe — it won’t be shown again.',
      password: 'Vault password',
      confirm: 'Confirm password',
      mismatch: 'Passwords don’t match',
      submit: 'Lock the vault with this password',
    },
    rules: {
      length: 'At least 8 characters',
      letter: 'Has a letter',
      digit: 'Has a number',
    },
    unlock: {
      title: 'The vault is locked',
      subtitle: 'Enter the vault password to open it',
      password: 'Vault password',
      submit: 'Open vault',
      raced: 'Another admin set the vault password first — use theirs.',
      forgot: 'Forgot it? Ask the admin who set it.',
    },
    session: {
      open: 'Vault open — locks automatically in',
      lockNow: 'Lock now',
    },
    change: {
      button: 'Change vault password',
      title: 'Change vault password',
      current: 'Current password',
      new: 'New password',
      hint: 'After the change the vault locks for everyone; they’ll need the new password.',
      done: 'Vault password changed',
      wrongCurrent: 'Current password is wrong',
    },
    errors: {
      wrong: 'Wrong password — {n} attempts left',
      lockedOut: 'Too many wrong attempts — try again in {n} seconds',
      weak: 'Password too weak — check the rules',
      generic: 'Something went wrong, please try again',
    },
  },
};

export default vaultLock;
