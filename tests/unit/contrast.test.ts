/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/index.css', 'utf8');
function resolve(value: string): string {
  const token = value.match(/var\((--[\w-]+)\)/)?.[1];
  if (token) {
    const declaration = css.match(new RegExp(`${token}:\\s*(#[a-fA-F0-9]{6})`))?.[1];
    if (!declaration) throw new Error(`Unresolved color token ${token}`);
    return declaration;
  }
  const literal = value.match(/#[a-fA-F0-9]{6}/)?.[0];
  if (literal) return literal;
  if (/\bwhite\b/.test(value)) return '#ffffff';
  throw new Error(`Unsupported color declaration ${value}`);
}
function color(selector: string, property: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rule = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`, 'm'))?.[1];
  const value = rule?.match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]+);`))?.[1];
  if (!value) throw new Error(`Missing ${property} in ${selector}`);
  return resolve(value);
}
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((value) =>
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  );
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}
function contrast(a: string, b: string): number {
  const values = [luminance(a), luminance(b)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}
const white = '#ffffff';
const navy = resolve('var(--navy)');
const surface = resolve('var(--surface)');
const textPairs = [
  ['body text', navy, white],
  ['primary action', color('.button-primary', 'color'), color('.button-primary', 'background')],
  ['destructive action', color('.button-danger', 'color'), color('.button-danger', 'background')],
  ['muted text', resolve('var(--muted)'), white],
  ['muted surface text', resolve('var(--muted)'), surface],
  ['error text', color('.field-error', 'color'), white],
  ['text action', color('.text-action', 'color'), white],
  ['hero eyebrow', color('.eyebrow', 'color'), color('.hero', 'background')],
  ['ratings', color('.rating', 'color'), white],
  ['review stars', color('.review-stars', 'color'), white],
  ['footer text', color('.store-footer', 'color'), navy],
  ['footer demo text', color('.footer-demo-note', 'color'), navy],
  ['demo banner', color('.demo-banner', 'color'), color('.demo-banner', 'background')],
  ['special offer label', color('.product-label', 'color'), color('.product-label', 'background')],
  [
    'default address badge',
    color('.default-badge', 'color'),
    color('.default-badge', 'background'),
  ],
  ['order status badge', color('.status-badge', 'color'), color('.status-badge', 'background')],
  ['navy on yellow accent', navy, resolve('var(--yellow)')],
  ['search placeholder', color('.input::placeholder', 'color'), surface],
] as const;

describe('actual stylesheet contrast pairs', () => {
  it('uses the WCAG sRGB reference endpoints', () => {
    expect(contrast('#000000', white)).toBe(21);
    expect(contrast(white, white)).toBe(1);
  });
  it.each(textPairs)('%s meets 4.5:1 for normal text', (_name, foreground, background) => {
    expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });
  it.each([white, surface])('keeps input boundaries at least 3:1 against %s', (background) => {
    expect(contrast(color('.input', 'border'), background)).toBeGreaterThanOrEqual(3);
    expect(
      contrast(color('.header-search input', 'border-color'), background),
    ).toBeGreaterThanOrEqual(3);
  });
  it.each([
    white,
    surface,
    navy,
    '#0b3a2d',
    '#edf3e8',
    '#f4b942',
    resolve('var(--green)'),
    color('.button-danger', 'background'),
  ])('keeps at least one focus-ring color visible against %s', (background) => {
    const outline = color(':focus-visible', 'outline');
    const halo = color(':focus-visible', 'box-shadow');
    expect(
      Math.max(contrast(outline, background), contrast(halo, background)),
    ).toBeGreaterThanOrEqual(3);
    expect(contrast(outline, halo)).toBeGreaterThanOrEqual(3);
  });
});
