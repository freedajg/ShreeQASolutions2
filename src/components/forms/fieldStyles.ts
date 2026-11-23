// Shared input styles for the form fields (Add and Edit, session 2). In their own file so
// Field.tsx exports only a component (react-refresh). Tokens only, so both themes work.

export const INPUT_CLASS =
  'w-full px-3 py-2 rounded-xl bg-bg border text-text text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed';

/** Border colour: the danger colour when the field has an error. */
export const inputBorder = (error: string | undefined) =>
  error ? 'border-danger' : 'border-line/16';
