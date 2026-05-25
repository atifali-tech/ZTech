/**
 * Centralized park color palette.
 * Every park has a fixed, globally unique color used across all charts, badges, legends, and exports.
 * Add new parks here — do not define park colors anywhere else.
 *
 * Colors chosen for maximum visual distinction and color-blind accessibility
 * (distinguishable under deuteranopia, protanopia, and tritanopia).
 */
export const PARK_COLOR_MAP = {
  'Jungle Trail':  '#16A34A', // Emerald Green
  'UP Darshan':    '#2563EB', // Royal Blue
  'Harmony':       '#F59E0B', // Amber
  'Gautam Buddha': '#DC2626', // Red
  'World Park':    '#7C3AED', // Purple
  'Shivalaya':     '#06B6D4', // Cyan
  'Saat Ajoobe':   '#EC4899', // Pink
};

/** Lookup by park id as stored in DB / fallback data. */
export const PARK_ID_COLOR_MAP = {
  jt: '#16A34A', // Jungle Trail
  ud: '#2563EB', // UP Darshan
  ha: '#F59E0B', // Harmony
  gb: '#DC2626', // Gautam Buddha
  wp: '#7C3AED', // World Park
  sh: '#06B6D4', // Shivalaya
  sa: '#EC4899', // Saat Ajoobe
};

/**
 * Returns the canonical color for a park.
 * Accepts a park object with { name, parkId, id } or just a name/id string.
 */
export function getParkColor(parkOrName, fallback = '#8A92A3') {
  if (!parkOrName) return fallback;
  if (typeof parkOrName === 'string') {
    return PARK_COLOR_MAP[parkOrName]
      || PARK_ID_COLOR_MAP[parkOrName]
      || fallback;
  }
  return PARK_COLOR_MAP[parkOrName.name]
    || PARK_ID_COLOR_MAP[parkOrName.parkId]
    || PARK_ID_COLOR_MAP[parkOrName.id]
    || parkOrName.color
    || fallback;
}

/** Ordered array of all park colors (same order as PARK_COLOR_MAP). */
export const PARK_COLORS_ORDERED = Object.values(PARK_COLOR_MAP);
