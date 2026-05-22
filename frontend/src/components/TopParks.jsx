'use client';
import TopParksPanel from './TopParksPanel';

export default function TopParksRow({ topParks, initialTab = 'Revenue', headerExtra = null }) {
  if (!topParks) return null;
  return <TopParksPanel topParks={topParks} initialTab={initialTab} headerExtra={headerExtra}/>;
}
