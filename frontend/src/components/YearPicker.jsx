'use client';
import { useState, useRef, useEffect } from 'react';

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function YearPicker({ value, onChange }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const selYear = value ? new Date(value+'T00:00:00').getFullYear() : today.getFullYear();
  const [decade, setDecade] = useState(Math.floor(selYear/10)*10);
  const [open, setOpen]   = useState(false);
  const wrapRef = useRef(null);

  useEffect(()=>{
    const h=(e)=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);

  // decade-1 … decade+10  (12 cells like the screenshot)
  const years = Array.from({length:12},(_,i)=>decade-1+i);

  const pick = (y) => {
    if (y>today.getFullYear()) return;
    const start = new Date(y,0,1);
    const end0  = new Date(y,11,31);
    onChange(toStr(start), toStr(end0>today?today:end0));
    setOpen(false);
  };

  const display = value ? new Date(value+'T00:00:00').getFullYear().toString() : 'Select year';

  return (
    <div ref={wrapRef} className="picker-wrap">
      <button type="button" className={`picker-input${open?' open':''}`} onClick={()=>setOpen(o=>!o)}>
        {display}
      </button>
      {open && (
        <div className="picker-dropdown" style={{minWidth:240}}>
          <div className="picker-nav">
            <button type="button" onClick={()=>setDecade(d=>d-10)}>‹</button>
            <span className="nav-label">{decade}–{decade+9}</span>
            <button type="button" onClick={()=>setDecade(d=>d+10)}>›</button>
          </div>
          <div className="picker-grid-3x4">
            {years.map(y=>{
              const future  = y>today.getFullYear();
              const sel     = y===selYear;
              const curr    = y===today.getFullYear();
              const out     = y<decade || y>decade+9;
              return (
                <button key={y} type="button"
                  className={`picker-grid-btn${sel?' selected':''}${future?' disabled':''}${curr&&!sel?' current':''}${out&&!sel?' out-decade':''}`}
                  onClick={()=>pick(y)}>{y}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
