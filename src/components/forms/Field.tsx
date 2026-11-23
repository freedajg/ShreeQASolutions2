// The frame every form field shares (Add and Edit, session 2; DESIGN.md line 130): label above,
// help text below, error text in the danger colour. The input gets `aria-invalid` and
// `aria-describedby` pointing at the help and error text. Tokens only, so both themes work.
// The input styles are in ./fieldStyles.ts.
import type { ReactNode } from 'react';

export interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: (describedBy: { 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode;
}

export function Field({ id, label, required, help, error, children }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-muted uppercase font-semibold text-[10px] mb-1">
        {label}
        {required && (
          <span aria-hidden="true" className="text-danger">
            {' '}
            *
          </span>
        )}
      </label>
      {children({ 'aria-invalid': !!error, 'aria-describedby': describedBy })}
      {help && (
        <p id={helpId} className="mt-1 text-[11px] text-text-secondary">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-[11px] text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
