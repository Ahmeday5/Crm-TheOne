/**
 * The three states any CRUD form can be in.
 *
 *   create — empty form, "Save" submits a POST
 *   edit   — pre-filled form, "Save" submits a PUT/PATCH
 *   view   — read-only display, no submit button
 */
export type FormMode = 'create' | 'edit' | 'view';
