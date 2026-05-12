import { api } from '../lib/api';
import Dashboard from '../components/Dashboard';

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

  const getData = (result) => result.status === 'fulfilled' ? result.value : null;

  return (
    <Dashboard
      kpis={getData(kpis)}
      demographics={getData(demographics)}
      revenueSplits={getData(revenueSplits)}
      hourly={getData(hourly)}
      heatmap={getData(heatmap)}
      weekendWeekday={getData(weekendWeekday)}
      comparative={getData(comparative)}
      topParks={getData(topParks)}
      revenueTrend={getData(revenueTrend)}
    />
  );
}
