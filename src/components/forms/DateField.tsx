// A date typed as dd-MMM-yyyy (Add and Edit, session 2; answer Q10; DESIGN.md line 130).
// A plain text box, not the browser's date picker, so every laptop shows the same format. On
// leaving the box, a date it understands is shown back in the standard form ("1-oct-2026" →
// "01-Oct-2026"); anything else is left as typed for the form's check to point out.
import { formatStandardDate, parseStandardDate } from '../../utils/dateUtils';
import { Field } from './Field';
import { INPUT_CLASS, inputBorder } from './fieldStyles';

export interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

export function DateField({ id, label, value, onChange, error, disabled }: DateFieldProps) {
  const tidy = () => {
    const parsed = parseStandardDate(value);
    if (parsed) onChange(formatStandardDate(parsed));
  };
  return (
    <Field id={id} label={label} help="dd-MMM-yyyy, e.g. 12-Mar-2026" error={error}>
      {(describedBy) => (
        <input
          id={id}
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="e.g. 12-Mar-2026"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={tidy}
          disabled={disabled}
          {...describedBy}
          className={`${INPUT_CLASS} ${inputBorder(error)} font-mono`}
        />
      )}
    </Field>
  );
}
