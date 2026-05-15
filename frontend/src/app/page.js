import { api } from '../lib/api';
import Dashboard from '../components/Dashboard';

async function safeFetch(fn) {
  try { return await fn(); } catch { return null; }
}

export default async function Home() {
  const [kpis, revenueSplits, hourly, topParks] = await Promise.all([
    safeFetch(() => api.kpis()),
    safeFetch(() => api.revenueSplits()),
    safeFetch(() => api.hourly()),
    safeFetch(() => api.topParks()),
  ]);

  return (
    <Dashboard
      kpis={kpis}
      revenueSplits={revenueSplits}
      hourly={hourly}
      topParks={topParks}
    />
  );
}
