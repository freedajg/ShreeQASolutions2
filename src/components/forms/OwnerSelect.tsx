// The owner dropdown (Add and Edit, session 2; answer Q14): "No owner" plus the active team
// members with a role, from `team_members` (toOwnerChoices). No hard-coded names.
import { useOwnerChoices } from '../../lib/data/hooks';
import { NO_OWNER } from '../../lib/data/mappers';
import { LookupSelect } from './LookupSelect';

export interface OwnerSelectProps {
  id: string;
  /** '' = no owner. */
  value: string;
  onChange: (value: string) => void;
  /** An owner the form already holds, shown even if since deactivated (edit forms). */
  keep?: string | null;
  error?: string;
  disabled?: boolean;
}

export function OwnerSelect({
  id,
  value,
  onChange,
  keep = null,
  error,
  disabled,
}: OwnerSelectProps) {
  const choices = useOwnerChoices(keep);
  return (
    <LookupSelect
      id={id}
      label="Owner"
      value={value}
      onChange={onChange}
      choices={choices}
      emptyLabel={NO_OWNER}
      error={error}
      disabled={disabled}
    />
  );
}
