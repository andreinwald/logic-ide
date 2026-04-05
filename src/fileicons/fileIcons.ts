import {
  SETI_DEFAULT_FILE_ICON,
  SETI_FILE_EXTENSION_ICON,
  SETI_FILE_NAME_ICON,
  SETI_ICON_GLYPHS,
  SETI_PALETTE
} from './vscodeSetiColors.js';

const extensionKeys = Object.keys(SETI_FILE_EXTENSION_ICON).sort((a, b) => b.length - a.length);

const SETI_EXTENSION_FALLBACK_ICON: Record<string, string> = {
  ts: '_typescript',
  tsx: '_typescript_1',
  html: '_html',
  htm: '_html',
  css: '_css'
};

function extractLastExtension(fileName: string): string {
  const normalized = fileName.toLowerCase().replace(/\s*\.\s*/g, '.');
  const index = normalized.lastIndexOf('.');
  if (index <= 0 || index === normalized.length - 1) return '';
  return normalized.slice(index + 1);
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function parseHexColor(hexColor: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{6})$/i.exec(hexColor);
  if (!m) return null;
  const n = m[1];
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function findSetiIconId(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  const normalized = lower.replace(/\s*\.\s*/g, '.');

  if (SETI_FILE_NAME_ICON[lower]) return SETI_FILE_NAME_ICON[lower];
  if (SETI_FILE_NAME_ICON[normalized]) return SETI_FILE_NAME_ICON[normalized];

  for (const ext of extensionKeys) {
    if (normalized === ext || normalized.endsWith(`.${ext}`) || (ext.startsWith('.') && normalized.endsWith(ext))) {
      return SETI_FILE_EXTENSION_ICON[ext];
    }
  }

  const lastExt = extractLastExtension(fileName);
  return lastExt ? (SETI_EXTENSION_FALLBACK_ICON[lastExt] ?? null) : null;
}

function getUniqueExtensionColor(fileName: string, theme: 'light' | 'dark'): string | null {
  const ext = extractLastExtension(fileName);
  if (!ext) return null;
  const hue = hashString(ext) % 360;
  const saturation = theme === 'dark' ? 68 : 72;
  const lightness = theme === 'dark' ? 62 : 40;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function mixWithUniqueExtensionHue(fileName: string, baseHex: string, theme: 'light' | 'dark'): string {
  const rgb = parseHexColor(baseHex);
  if (!rgb) return baseHex;
  const hue = hashString(extractLastExtension(fileName)) % 360;
  const sat = theme === 'dark' ? 65 : 70;
  const light = theme === 'dark' ? 60 : 42;
  return `color-mix(in srgb, hsl(${hue} ${sat}% ${light}%) 72%, rgb(${rgb[0]} ${rgb[1]} ${rgb[2]}) 28%)`;
}

export function getFileIconGlyph(fileName: string): string {
  const iconId = findSetiIconId(fileName) ?? SETI_DEFAULT_FILE_ICON;
  const glyph = SETI_ICON_GLYPHS[iconId] ?? SETI_ICON_GLYPHS[SETI_DEFAULT_FILE_ICON];
  if (!glyph) return '';
  const match = /^\\([a-f0-9]{4,6})$/i.exec(glyph);
  if (!match) return '';
  return String.fromCodePoint(parseInt(match[1], 16));
}

export function getFileColor(fileName: string, theme: 'light' | 'dark'): string | null {
  const iconId = findSetiIconId(fileName);
  if (!iconId) return getUniqueExtensionColor(fileName, theme);
  const pair = SETI_PALETTE[iconId];
  if (!pair) return getUniqueExtensionColor(fileName, theme);
  return mixWithUniqueExtensionHue(fileName, theme === 'dark' ? pair.dark : pair.light, theme);
}
