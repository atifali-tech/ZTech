'use client';

const PATHS = {
  grid:     <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  ticket:   <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="M14 6v12" strokeDasharray="2 2"/></>,
  users:    <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 20c0-2.5 1.7-4.5 4.5-4.5s4 1.5 4 3.5"/></>,
  chart:    <><path d="M3 20V4"/><path d="M3 20h18"/><path d="M7 16l4-5 3 3 5-7"/></>,
  activity: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
  car:      <><path d="M5 16h14v-3l-2-5H7l-2 5v3z"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/></>,
  coffee:   <><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M7 4c0 1 1 1 1 2s-1 1-1 2"/><path d="M11 4c0 1 1 1 1 2s-1 1-1 2"/></>,
  file:     <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/></>,
  download: <><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
  chevron:  <><path d="M6 9l6 6 6-6"/></>,
  chevronR: <><path d="M9 6l6 6-6 6"/></>,
  chevronL: <><path d="M15 6l-6 6 6 6"/></>,
  bell:     <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 19a2 2 0 0 0 4 0"/></>,
  filter:   <><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></>,
  refresh:  <><path d="M4 4v5h5"/><path d="M20 20v-5h-5"/><path d="M5 9a8 8 0 0 1 14-2"/><path d="M19 15a8 8 0 0 1-14 2"/></>,
  clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  info:     <><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".5" fill="currentColor"/></>,
  cog:      <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
  logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>,
  table:    <><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 16h18M9 4v16M15 4v16"/></>,
  senior:   <><circle cx="12" cy="6" r="2.5"/><path d="M9 13l3-2 3 2v6m-6 0l3-3 3 3"/><path d="M14 11l3-1"/></>,
  toddler:  <><circle cx="12" cy="7" r="2.5"/><path d="M8 21v-5l-2-2 3-4h6l3 4-2 2v5"/></>,
  kid:      <><circle cx="12" cy="6" r="2.5"/><path d="M8 21v-7H6v-3l3-3h6l3 3v3h-2v7"/></>,
  adult:    <><circle cx="12" cy="6" r="2.5"/><path d="M7 21v-9l-2-2 3-2h8l3 2-2 2v9"/></>,
  shield:   <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></>,
  map:      <><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></>,
  key:      <><circle cx="8" cy="15" r="4"/><path d="M15 8l6 6"/><path d="M17.5 10.5L21 7"/><path d="M15 14l2-2"/></>,
  money:    <><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/></>,
  checkCircle: <><circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-5"/></>,
  xCircle:  <><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></>,
  lock:     <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>,
  unlock:   <><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0"/></>,
  warning:  <><path d="M12 2L2 20h20L12 2z"/><path d="M12 9v5"/><circle cx="12" cy="17.5" r=".5" fill="currentColor"/></>,
  arrowUp:  <><path d="M12 20V4M5 11l7-7 7 7"/></>,
  arrowDown:<><path d="M12 4v16M5 13l7 7 7-7"/></>,
  send:     <><path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/></>,
  trash:    <><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></>,
  check:    <><path d="M4 12l5 5L20 7"/></>,
  x:        <><path d="M18 6L6 18M6 6l12 12"/></>,
  plus:     <><path d="M12 5v14M5 12h14"/></>,
};

export default function Icon({ name, size = 16, color = 'currentColor', strokeWidth = 1.6 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {PATHS[name] || null}
    </svg>
  );
}
