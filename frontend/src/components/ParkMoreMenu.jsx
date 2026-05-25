'use client';
import Icon from './Icon';

export default function ParkMoreMenu({ park, onEdit, onDelete, can }) {
  if (!can('parks.delete')) return null;
  return (
    <button
      className="btn btn-ghost btn-sm"
      style={{ color: 'var(--red)', fontSize: 11 }}
      title="Delete park"
      onClick={(e) => { e.stopPropagation(); onDelete(park); }}
    >
      <Icon name="trash" size={13} color="var(--red)"/>
    </button>
  );
}
