/**
 * Public surface of the sales playbook feature — the shell and other
 * features import from here, never from the feature's internals.
 */
export { SALES_PLAYBOOK_ROUTES } from './sales-playbook.routes';
export { SalesPlaybookStore } from './state/sales-playbook.store';
export {
  QuickReplyPickerComponent,
  SALES_PLAYBOOK_PATH,
} from './components/quick-reply-picker/quick-reply-picker.component';
export { fillReplyPlaceholders } from './utils/playbook.util';
