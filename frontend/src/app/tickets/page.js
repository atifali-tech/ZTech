import { api } from '../../lib/api';
import Sidebar from '../../components/Sidebar';
import Topbar from '../../components/Topbar';
import TicketsClient from '../../components/TicketsClient';

async function safeFetch(fn) {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export default async function TicketsPage() {
  const [initialData, parks] = await Promise.all([
    safeFetch(() => api.tickets({ page: 1, limit: 50 })),
    safeFetch(api.parks),
  ]);

  return (
    <div className="app">
      <Sidebar active="tickets"/>
      <div className="main">
        <Topbar current="Tickets" icon="ticket"/>
        <div className="canvas">
          <TicketsClient initialData={initialData} parks={parks || []}/>
        </div>
      </div>
    </div>
  );
}
