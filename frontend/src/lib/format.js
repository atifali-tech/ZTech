// Indian number/currency formatters — mirrors data.jsx helpers exactly

export function inr(n) {
  if (n == null || isNaN(n)) return '₹0';
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  if (n >= 1000)     return '₹' + Math.round(n / 100) / 10 + 'K';
  return '₹' + n;
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
