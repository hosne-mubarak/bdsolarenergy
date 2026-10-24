import { useId } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '../common/primitives';
export function QuantitySelector({
  value,
  onChange,
  max,
  disabled = false,
  label = 'Quantity',
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  disabled?: boolean;
  label?: string;
}) {
  const quantityId = useId();
  const actionLabel = label.charAt(0).toLowerCase() + label.slice(1);
  return (
    <div className="quantity-control">
      <Button
        variant="secondary"
        aria-label={`Decrease ${actionLabel}`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={16} aria-hidden="true" />
      </Button>
      <label className="sr-only" htmlFor={quantityId}>
        {label}
      </label>
      <input
        id={quantityId}
        aria-label={label}
        type="number"
        min="1"
        max={max}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isSafeInteger(next) && next >= 1 && next <= max) onChange(next);
        }}
      />
      <Button
        variant="secondary"
        aria-label={`Increase ${actionLabel}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}
