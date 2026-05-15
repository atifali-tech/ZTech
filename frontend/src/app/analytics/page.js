import { api } from '../../lib/api';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import BottomNav from '../../components/BottomNav';
import AnalyticsClient from '../../components/AnalyticsClient';

async function safeFetch(fn) {
  try { return await fn(); } catch { return null; }
}

export default async function AnalyticsPage() {
  const [demographics, revenueSplits, heatmap, weekendWeekday, comparative, topParks] = await Promise.all([
    safeFetch(() => api.demographics()),
    safeFetch(() => api.revenueSplits()),
    safeFetch(() => api.heatmap()),
    safeFetch(() => api.weekendWeekday()),
    safeFetch(() => api.comparative()),
    safeFetch(() => api.topParks()),
  ]);

  return (
    <div className="app">
      <Sidebar active="analytics"/>
      <div className="main">
        <Topbar current="Analytics" icon="chart"/>
        <div className="canvas">
          <AnalyticsClient
            demographics={demographics}
            revenueSplits={revenueSplits}
            heatmap={heatmap}
            weekendWeekday={weekendWeekday}
            comparative={comparative}
            topParks={topParks}
          />
        </div>
      </div>
      <BottomNav active="analytics"/>
    </div>
  );
}
