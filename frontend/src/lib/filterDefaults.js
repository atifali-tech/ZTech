// Shared filter state utilities used by Dashboard, AnalyticsClient, and FilterBar.
// This is a plain module (no hooks) — safe to import from any component or lib file.

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Compute the correct start/end dates for a given range label.
// Exported so FilterBar can use it for onRangeChange without duplicating logic.
export function computeDefaultDates(range) {
  const today = new Date(); today.setHours(0,0,0,0);
  const ts = toStr(today);
  switch (range) {
    case 'Daily':   return { date: ts, dateEnd: ts };
    case 'Weekly': {
      const mon = new Date(today); mon.setDate(today.getDate() - (today.getDay() + 6) % 7);
      return { date: toStr(mon), dateEnd: ts };
    }
    case 'Monthly': {
      const s = new Date(today.getFullYear(), today.getMonth(), 1);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Quarterly': {
      const s = new Date(today.getFullYear(), Math.floor(today.getMonth() / 3) * 3, 1);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Yearly':
      return { date: `${today.getFullYear()}-01-01`, dateEnd: ts };
    case 'Last 3 Months': {
      const s = new Date(today); s.setMonth(s.getMonth() - 3);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Last 6 Months': {
      const s = new Date(today); s.setMonth(s.getMonth() - 6);
      return { date: toStr(s), dateEnd: ts };
    }
    case 'Last 12 Months': {
      const s = new Date(today); s.setFullYear(s.getFullYear() - 1);
      return { date: toStr(s), dateEnd: ts };
    }
    default: return { date: ts, dateEnd: ts };
  }
}

// Canonical default filter state. Call this function — do not inline the object —
// so the dates are always computed fresh relative to today, not module-load time.
export function makeDefaultFilters() {
  const { date, dateEnd } = computeDefaultDates('Monthly');
  return {
    parks: [], state: 'All States', cities: [],
    range: 'Monthly', date, dateEnd, compare: false,
  };
}
