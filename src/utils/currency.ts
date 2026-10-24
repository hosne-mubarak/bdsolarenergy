const formatter = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'narrowSymbol',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Keep integer poisha exact even at the safe-integer boundary; convert only for display. */
export function formatMoney(poisha: number) {
  if (!Number.isSafeInteger(poisha) || poisha < 0)
    throw new RangeError('Use nonnegative safe integer poisha.');
  const value = BigInt(poisha);
  const whole = formatter.format(value / 100n);
  const remainder = value % 100n;
  return remainder === 0n
    ? whole
    : `${whole}.${String(remainder).padStart(2, '0').replace(/0$/, '')}`;
}
