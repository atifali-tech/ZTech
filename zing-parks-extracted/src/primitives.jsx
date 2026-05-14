// ===== Tiny icon set (line, 16px) =====
const Icon = ({ name, size = 16, color = "currentColor", strokeWidth = 1.6 }) => {
  const paths = {
    grid:     <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    ticket:   <><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z"/><path d="M14 6v12" strokeDasharray="2 2"/></>,
    users:    <><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 20c0-2.5 1.7-4.5 4.5-4.5s4 1.5 4 3.5"/></>,
    chart:    <><path d="M3 20V4"/><path d="M3 20h18"/><path d="M7 16l4-5 3 3 5-7"/></>,
    sparkles: <><path d="M5 12l1.5-3.5L10 7 6.5 5.5 5 2 3.5 5.5 0 7l3.5 1.5L5 12z" transform="translate(2 2)"/><path d="M16 18l1-2 2-1-2-1-1-2-1 2-2 1 2 1 1 2z"/></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6"/></>,
    car:      <><path d="M5 16h14v-3l-2-5H7l-2 5v3z"/><circle cx="8" cy="17.5" r="1.5"/><circle cx="16" cy="17.5" r="1.5"/></>,
    coffee:   <><path d="M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2"/><path d="M7 4c0 1 1 1 1 2s-1 1-1 2"/><path d="M11 4c0 1 1 1 1 2s-1 1-1 2"/></>,
    file:     <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/></>,
    download: <><path d="M12 4v12"/><path d="M7 11l5 5 5-5"/><path d="M5 20h14"/></>,
    upload:   <><path d="M12 20V8"/><path d="M7 13l5-5 5 5"/><path d="M5 4h14"/></>,
    chevron:  <><path d="M6 9l6 6 6-6"/></>,
    chevronR: <><path d="M9 6l6 6-6 6"/></>,
    bell:     <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z"/><path d="M10 19a2 2 0 0 0 4 0"/></>,
    search:   <><circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/></>,
    filter:   <><path d="M3 5h18l-7 9v6l-4-2v-4L3 5z"/></>,
    refresh:  <><path d="M4 4v5h5"/><path d="M20 20v-5h-5"/><path d="M5 9a8 8 0 0 1 14-2"/><path d="M19 15a8 8 0 0 1-14 2"/></>,
    clock:    <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    info:     <><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="8" r=".5" fill={color}/></>,
    sun:      <><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></>,
    cog:      <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></>,
    logout:   <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>,
    table:    <><rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 10h18M3 16h18M9 4v16M15 4v16"/></>,
    swap:     <><path d="M7 4l-4 4 4 4"/><path d="M3 8h12"/><path d="M17 12l4 4-4 4"/><path d="M21 16H9"/></>,
    plus:     <><path d="M12 5v14M5 12h14"/></>,
    spark:    <><path d="M3 17l5-7 4 4 6-9 3 5"/></>,
    park:     <><path d="M12 3l5 7h-3l4 6h-4v5h-4v-5H6l4-6H7l5-7z"/></>,
    senior:   <><circle cx="12" cy="6" r="2.5"/><path d="M9 13l3-2 3 2v6m-6 0l3-3 3 3"/><path d="M14 11l3-1"/></>,
    toddler:  <><circle cx="12" cy="7" r="2.5"/><path d="M8 21v-5l-2-2 3-4h6l3 4-2 2v5"/></>,
    kid:      <><circle cx="12" cy="6" r="2.5"/><path d="M8 21v-7H6v-3l3-3h6l3 3v3h-2v7"/></>,
    adult:    <><circle cx="12" cy="6" r="2.5"/><path d="M7 21v-9l-2-2 3-2h8l3 2-2 2v9"/></>,
    eye:      <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    flag:     <><path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {paths[name] || null}
    </svg>
  );
};

// Sparkline (mini area + line)
const Sparkline = ({ data, color = "#0E7C66", width = 130, height = 40, fill = true }) => {
  if (!data || data.length === 0) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - 4 - ((v - min) / range) * (height - 8)]);
  const d = pts.map((p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
  const area = d + ` L ${width} ${height} L 0 ${height} Z`;
  const id = "g_" + color.replace("#","");
  return (
    <svg width={width} height={height} style={{display:"block"}}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${id})`} />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.4" fill={color}/>
    </svg>
  );
};

// Delta badge
const Delta = ({ value, suffix = "%" }) => {
  const up = value >= 0;
  return (
    <span className={"delta " + (up ? "up" : "down")}>
      <svg width="9" height="9" viewBox="0 0 9 9"><path d={up?"M4.5 1L8 6H1L4.5 1z":"M4.5 8L1 3h7L4.5 8z"} fill="currentColor"/></svg>
      {Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
};

// Card section wrapper
const Section = ({ title, sub, actions, children, padded = true, tight = false }) => (
  <div className="sec">
    {(title || actions) && (
      <div className="sec-head">
        {title && <div className="sec-title">{title}</div>}
        {sub && <div className="sec-sub">{sub}</div>}
        {actions && <div className="sec-actions">{actions}</div>}
      </div>
    )}
    {padded ? <div className={"sec-body" + (tight ? " tight" : "")}>{children}</div> : children}
  </div>
);

// Hover tooltip helper - tracks mouse pos relative to nearest .chart-area
function useTooltip() {
  const [tip, setTip] = React.useState(null);
  const wrap = React.useRef(null);
  return { tip, setTip, wrap };
}

Object.assign(window, { Icon, Sparkline, Delta, Section, useTooltip });
