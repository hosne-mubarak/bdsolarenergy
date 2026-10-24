export class RuleError extends Error {
  readonly code: 'validation' | 'conflict' | 'not_found';
  constructor(code: RuleError['code'], message: string) {
    super(message);
    this.name = 'RuleError';
    this.code = code;
  }
}

export function assertMoney(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new RuleError('validation', 'A monetary amount is invalid.');
}

export function safeAmount(value: bigint): number {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new RuleError('validation', 'The calculated amount is too large.');
  return Number(value);
}

export function addMoney(left: number, right: number): number {
  assertMoney(left);
  assertMoney(right);
  return safeAmount(BigInt(left) + BigInt(right));
}

export function multiplyMoney(price: number, quantity: number): number {
  assertMoney(price);
  if (!Number.isSafeInteger(quantity) || quantity < 1)
    throw new RuleError('validation', 'Quantity must be a positive whole number.');
  return safeAmount(BigInt(price) * BigInt(quantity));
}
