// An amount box (Add and Edit, session 2; plan 4c). The amount carries no currency: the symbol
// comes from `currency`, which only knows INR ("₹") today; the INR/USD choice joins it in the
// next step. Render this only for a user with values access (DESIGN.md line 165).
import { Field } from './Field';
import { INPUT_CLASS, inputBorder } from './fieldStyles';

const SYMBOLS: Record<string, string> = { INR: '₹' };

export interface MoneyInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency?: string;
  error?: string;
  disabled?: boolean;
}

export function MoneyInput({
  id,
  label,
  value,
  onChange,
  currency = 'INR',
  error,
  disabled,
}: MoneyInputProps) {
  const symbol = SYMBOLS[currency] ?? currency;
  return (
    <Field id={id} label={label} help="Optional. Leave empty if not agreed yet." error={error}>
      {(describedBy) => (
        <div className="relative">
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted font-mono"
          >
            {symbol}
          </span>
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="e.g. 4,50,000"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            {...describedBy}
            className={`${INPUT_CLASS} ${inputBorder(error)} pl-7 font-mono`}
          />
        </div>
      )}
    </Field>
  );
}
