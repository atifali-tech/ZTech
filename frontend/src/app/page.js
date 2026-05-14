import { api } from '../lib/api';
import Dashboard from '../components/Dashboard';
import { dashboardFallback } from './dashboardFallback';

export default async function Home() {
  // Fetch all data in parallel on the server
  const [kpis, demographics, revenueSplits, hourly, heatmap, weekendWeekday, comparative, topParks, revenueTrend] =
    await Promise.allSettled([
      api.kpis(),
      api.demographics(),
      api.revenueSplits(),
      api.hourly(),
      api.heatmap(),
      api.weekendWeekday(),
      api.comparative(),
      api.topParks(),
      api.revenueTrend(),
    ]);

  const getData = (result, key) => result.status === 'fulfilled' ? result.value : dashboardFallback[key];

  return (
    <Dashboard
      kpis={getData(kpis, 'kpis')}
      demographics={getData(demographics, 'demographics')}
      revenueSplits={getData(revenueSplits, 'revenueSplits')}
      hourly={getData(hourly, 'hourly')}
      heatmap={getData(heatmap, 'heatmap')}
      weekendWeekday={getData(weekendWeekday, 'weekendWeekday')}
      comparative={getData(comparative, 'comparative')}
      topParks={getData(topParks, 'topParks')}
      revenueTrend={getData(revenueTrend, 'revenueTrend')}
    />
  );
}
