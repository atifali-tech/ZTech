import Dashboard from '../components/Dashboard';

// Server-side prefetch removed — Dashboard client component fetches
// with auth cookie once the browser renders.
export default function Home() {
  return <Dashboard kpis={null} revenueSplits={null} topParks={null}/>;
}
