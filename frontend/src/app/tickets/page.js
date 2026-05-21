import Sidebar      from '../../components/Sidebar';
import Topbar       from '../../components/Topbar';
import TicketsClient from '../../components/TicketsClient';

export default function TicketsPage() {
  return (
    <div className="app">
      <Sidebar active="tickets"/>
      <div className="main">
        <Topbar current="Tickets" icon="ticket"/>
        <div className="canvas">
          <TicketsClient initialData={null} parks={[]}/>
        </div>
      </div>
    </div>
  );
}
