// A dropdown over one list of choices (Add and Edit, session 2). The empty option is a real
// "nothing chosen" (value ''), never a guessed default (CLAUDE.md rule 7).
import type { Choice } from '../../lib/data/mappers';
import { Field } from './Field';
import { INPUT_CLASS, inputBorder } from './fieldStyles';

export interface LookupSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** undefined while the list is loading: the select is disabled and says so. */
  choices: readonly Choice[] | undefined;
  /** Text of the empty option, e.g. "Choose a certification" or "Not set". */
  emptyLabel: string;
  required?: boolean;
  help?: string;
  error?: string;
  disabled?: boolean;
}

export function LookupSelect({
  id,
  label,
  value,
  onChange,
  choices,
  emptyLabel,
  required,
  help,
  error,
  disabled,
}: LookupSelectProps) {
  return (
    <Field id={id} label={label} required={required} help={help} error={error}>
      {(describedBy) => (
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || choices === undefined}
          aria-required={required || undefined}
          {...describedBy}
          className={`${INPUT_CLASS} ${inputBorder(error)}`}
        >
          <option value="">{choices === undefined ? 'Loading…' : emptyLabel}</option>
          {choices?.map((choice) => (
            <option key={choice.value} value={choice.value}>
              {choice.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}
