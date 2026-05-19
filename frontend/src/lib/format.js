// Indian number/currency formatters — mirrors data.jsx helpers exactly

export function downloadCSV(filename, headers, rows) {
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function inr(n) {
  if (n == null || isNaN(n)) return '₹0';
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  if (n >= 1000)     return '₹' + Math.round(n / 100) / 10 + 'K';
  return '₹' + Math.round(n);
}

export function inrFull(n) {
  if (n == null || isNaN(n)) return '₹0';
  const s = String(Math.round(n));
  if (s.length <= 3) return '₹' + s;
  const last3 = s.slice(-3);
  const rest  = s.slice(0, -3);
  return '₹' + rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + last3;
}

export function num(n) {
  if (n == null || isNaN(n)) return '0';
  return Number(n).toLocaleString('en-IN');
}

export function formatHour(h) {
  if (h === 12) return '12PM';
  return h > 12 ? (h - 12) + 'PM' : h + 'AM';
}

export function compareLabel(range) {
  const MAP = {
    'Daily':          'vs previous day',
    'Weekly':         'vs previous week',
    'Monthly':        'vs previous month',
    'Quarterly':      'vs previous quarter',
    'Yearly':         'vs previous year',
    'Last 3 Months':  'vs previous 3 months',
    'Last 6 Months':  'vs previous 6 months',
    'Last 12 Months': 'vs previous 12 months',
    'Custom Range':   'vs previous period',
  };
  return MAP[range] || 'vs previous period';
}

// Returns "vs yesterday (May 17, 2026)" / "vs prev week (May 5 – 11, 2026)" etc.
export function prevPeriodLabel(range, date, dateEnd) {
  const MO = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const parse = (s) => {
    if (!s) return new Date();
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const addDays   = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const addMonths = (d, n) => { const r = new Date(d); r.setMonth(r.getMonth() + n); return r; };
  const addYears  = (d, n) => { const r = new Date(d); r.setFullYear(r.getFullYear() + n); return r; };

  const fmt1 = (d) => `${MO[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  const fmtRange = (s, e) => {
    const sy = s.getFullYear(), ey = e.getFullYear();
    if (s.toDateString() === e.toDateString()) return fmt1(s);
    if (sy === ey) {
      // Full single month: "Apr 2026"
      if (s.getMonth() === e.getMonth() && s.getDate() === 1 &&
          e.getDate() === new Date(sy, e.getMonth() + 1, 0).getDate()) {
        return `${MO[s.getMonth()]} ${sy}`;
      }
      // Same month, partial: "May 5 – 11, 2026"
      if (s.getMonth() === e.getMonth()) {
        return `${MO[s.getMonth()]} ${s.getDate()} – ${e.getDate()}, ${sy}`;
      }
      // Clean month range (1st to last): "Jan – Mar 2026"
      if (s.getDate() === 1 && e.getDate() === new Date(sy, e.getMonth() + 1, 0).getDate()) {
        return `${MO[s.getMonth()]} – ${MO[e.getMonth()]} ${sy}`;
      }
      // Mixed: "Apr 1 – May 11, 2026"
      return `${MO[s.getMonth()]} ${s.getDate()} – ${MO[e.getMonth()]} ${e.getDate()}, ${sy}`;
    }
    // Cross-year: "Nov 17, 2025 – Feb 17, 2026"
    return `${MO[s.getMonth()]} ${s.getDate()}, ${sy} – ${MO[e.getMonth()]} ${e.getDate()}, ${ey}`;
  };

  const d = parse(date), de = parse(dateEnd);

  switch (range) {
    case 'Daily': {
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const label = d.getTime() === today.getTime() ? 'vs yesterday' : 'vs previous day';
      return `${label} (${fmt1(addDays(d, -1))})`;
    }
    case 'Weekly': {
      // Always show full Mon–Sun of previous week (d is Monday; d-1 is last Sunday)
      return `vs previous week (${fmtRange(addDays(d, -7), addDays(d, -1))})`;
    }
    case 'Monthly': {
      return `vs previous month (${fmtRange(addMonths(d, -1), addMonths(de, -1))})`;
    }
    case 'Quarterly': {
      return `vs previous quarter (${fmtRange(addMonths(d, -3), addMonths(de, -3))})`;
    }
    case 'Yearly': {
      return `vs previous year (${addYears(d, -1).getFullYear()})`;
    }
    case 'Last 3 Months': {
      const pe = addDays(d, -1);
      return `vs previous 3 months (${fmtRange(addMonths(pe, -3), pe)})`;
    }
    case 'Last 6 Months': {
      const pe = addDays(d, -1);
      return `vs previous 6 months (${fmtRange(addMonths(pe, -6), pe)})`;
    }
    case 'Last 12 Months': {
      const pe = addDays(d, -1);
      return `vs previous 12 months (${fmtRange(addYears(pe, -1), pe)})`;
    }
    case 'Custom Range': {
      const days = Math.round((de - d) / 86400000) + 1;
      const pe = addDays(d, -1);
      return `vs previous period (${fmtRange(addDays(pe, -(days - 1)), pe)})`;
    }
    default:
      return 'vs previous period';
  }
}
