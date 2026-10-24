const base = 'https://bdsolarenergy.invalid';
export function safeReturnPath(input: string | null | undefined, fallback = '/account'): string {
  if (!input) return fallback;
  let inspected = input;
  for (let round = 0; round < 4; round++) {
    if (
      !inspected.startsWith('/') ||
      inspected.startsWith('//') ||
      inspected.includes('\\') ||
      [...inspected].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
    )
      return fallback;
    try {
      const parsed = new URL(inspected, base);
      if (
        parsed.origin !== base ||
        ['/login', '/register', '/logout', '/forgot-password', '/reset-password'].includes(
          parsed.pathname,
        )
      )
        return fallback;
      const decoded = decodeURIComponent(inspected);
      if (decoded === inspected) return input;
      inspected = decoded;
    } catch {
      return fallback;
    }
  }
  return fallback;
}
