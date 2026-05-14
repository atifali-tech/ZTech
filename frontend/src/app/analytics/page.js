import { api } from '../../lib/api';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import BottomNav from '../../components/BottomNav';
import AnalyticsClient from '../../components/AnalyticsClient';
import { dashboardFallback } from '../dashboardFallback';

export default async function AnalyticsPage() {
  const [demographics, revenueSplits, heatmap, weekendWeekday, comparative, topParks] =
    await Promise.allSettled([
      api.demographics(),
      api.revenueSplits(),
      api.heatmap(),
      api.weekendWeekday(),
      api.comparative(),
      api.topParks(),
    ]);

  const get = (r, k) => r.status === 'fulfilled' ? r.value : dashboardFallback[k];

  return (
    <div className="app">
      <Sidebar active="analytics"/>
      <div className="main">
        <Topbar current="Analytics" icon="chart"/>
        <div className="canvas">
          <AnalyticsClient
            demographics={get(demographics,    'demographics')}
            revenueSplits={get(revenueSplits,  'revenueSplits')}
            heatmap={get(heatmap,              'heatmap')}
            weekendWeekday={get(weekendWeekday,'weekendWeekday')}
            comparative={get(comparative,      'comparative')}
            topParks={get(topParks,            'topParks')}
          />
        </div>
      </div>
      <BottomNav active="analytics"/>
    </div>
  );
}
