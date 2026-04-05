const relativeTimeFormatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

function shortRelative(value: number, unit: Intl.RelativeTimeFormatUnit): string {
  const absValue = Math.abs(value);
  const full = relativeTimeFormatter.format(value, unit);
  const parts = full.split(' ');
  if (parts.length < 2) return full;
  const amount = parts[0];
  const word = parts[1];
  if (word.startsWith('minute')) return `${amount} min`;
  if (word.startsWith('hour'))  return `${amount} ${absValue === 1 ? 'hour' : 'hours'}`;
  if (word.startsWith('day'))   return `${amount} ${absValue === 1 ? 'day' : 'days'}`;
  if (word.startsWith('week'))  return `${amount} ${absValue === 1 ? 'week' : 'weeks'}`;
  if (word.startsWith('month')) return `${amount} ${absValue === 1 ? 'month' : 'months'}`;
  if (word.startsWith('year'))  return `${amount} ${absValue === 1 ? 'year' : 'years'}`;
  return full;
}

export function formatAge(mtimeMs: number): string {
  const diffSeconds = Math.max(0, Math.floor((Date.now() - mtimeMs) / 1000));
  if (diffSeconds < 60)      return `${diffSeconds} sec`;
  if (diffSeconds < 3600)    return shortRelative(-Math.floor(diffSeconds / 60), 'minute');
  if (diffSeconds < 86400)   return shortRelative(-Math.floor(diffSeconds / 3600), 'hour');
  if (diffSeconds < 604800)  return shortRelative(-Math.floor(diffSeconds / 86400), 'day');
  if (diffSeconds < 2629800) return shortRelative(-Math.floor(diffSeconds / 604800), 'week');
  if (diffSeconds < 31557600) return shortRelative(-Math.floor(diffSeconds / 2629800), 'month');
  return shortRelative(-Math.floor(diffSeconds / 31557600), 'year');
}
