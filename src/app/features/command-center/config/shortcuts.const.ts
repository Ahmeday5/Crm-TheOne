import { ShortcutDef } from '../models/command.models';

/**
 * Global keyboard shortcuts — single source of truth for the key handler and
 * the "?" help dialog. Keys are lower-case `KeyboardEvent.key` values;
 * sequences are typed one after the other (within 1.2s).
 *
 * Ctrl/⌘+K (command palette) is handled separately because it must work
 * even while typing in a field.
 */
export const SHORTCUTS: ReadonlyArray<ShortcutDef> = [
  { id: 'new-customer', keys: ['n'], labelKey: 'commandCenter.shortcuts.newCustomer', commandId: 'action.new-customer' },
  { id: 'go-pipeline', keys: ['g', 'p'], labelKey: 'commandCenter.shortcuts.goPipeline', commandId: 'page./leads/sales-pipeline' },
  { id: 'go-whatsapp', keys: ['g', 'w'], labelKey: 'commandCenter.shortcuts.goWhatsapp', commandId: 'page./whatsapp' },
  { id: 'go-chat', keys: ['g', 'c'], labelKey: 'commandCenter.shortcuts.goChat', commandId: 'page./team-chat' },
  { id: 'go-announcements', keys: ['g', 'a'], labelKey: 'commandCenter.shortcuts.goAnnouncements', commandId: 'page./announcements' },
  { id: 'go-home', keys: ['g', 'h'], labelKey: 'commandCenter.shortcuts.goHome', commandId: 'action.go-home' },
  { id: 'help', keys: ['?'], labelKey: 'commandCenter.shortcuts.help', commandId: 'action.shortcuts' },
];

/** Max gap between the keys of a sequence. */
export const SEQUENCE_TIMEOUT_MS = 1200;
