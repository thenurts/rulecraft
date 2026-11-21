// Keep the platform's native picker, with a wrapping view of the selected wording.
export function ChoiceSelect({ label, value, choices, placeholder, disabled, onChange }: {
  label: string;
  value: string;
  choices: readonly { readonly value: string; readonly label: string }[];
  placeholder?: string;
  disabled?: boolean;
  onChange(value: string): void;
}) {
  const chosen = choices.find((item) => item.value === value)?.label ?? placeholder;
  return <label>{label}
    <span className="choice-select">
      <span className="choice-value" aria-hidden="true">{chosen}</span>
      <select value={value} disabled={disabled} onChange={({ target }) => onChange(target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {choices.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
      </select>
    </span>
  </label>;
}
