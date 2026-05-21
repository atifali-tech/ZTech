import Sidebar        from '../../components/Sidebar';
import Topbar         from '../../components/Topbar';
import BottomNav      from '../../components/BottomNav';
import AnalyticsClient from '../../components/AnalyticsClient';

export default function AnalyticsPage() {
  return (
    <div className="app">
      <Sidebar active="analytics"/>
      <div className="main">
        <Topbar current="Analytics" icon="chart"/>
        <div className="canvas">
          <AnalyticsClient
            demographics={null}
            revenueSplits={null}
            heatmap={null}
            weekendWeekday={null}
            comparative={null}
            topParks={null}
          />
        </div>
      </div>
      <BottomNav active="analytics"/>
    </div>
  );
}
