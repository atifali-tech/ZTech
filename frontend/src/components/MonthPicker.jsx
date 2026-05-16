'use client';
import { useState, useRef, useEffect } from 'react';

const MS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function MonthPicker({ value, onChange }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const refD = value ? new Date(value+'T00:00:00') : today;
  const [vy, setVY] = useState(refD.getFullYear());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(()=>{
    const h=(e)=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);

  const selYear = value ? new Date(value+'T00:00:00').getFullYear() : null;
  const selMon  = value ? new Date(value+'T00:00:00').getMonth()    : null;

  const pick = (mi) => {
    const start = new Date(vy,mi,1);
    const last  = new Date(vy,mi+1,0);
    onChange(toStr(start), toStr(last>today?today:last));
    setOpen(false);
  };

  const display = value
    ? `${MS[new Date(value+'T00:00:00').getMonth()]}-${new Date(value+'T00:00:00').getFullYear()}`
    : 'Select month';

  return (
    <div ref={wrapRef} className="picker-wrap">
      <button type="button" className={`picker-input${open?' open':''}`} onClick={()=>setOpen(o=>!o)}>
        {display}
      </button>
      {open && (
        <div className="picker-dropdown" style={{minWidth:220}}>
          <div className="picker-nav">
            <button type="button" onClick={()=>setVY(y=>y-1)}>‹</button>
            <span className="nav-label">{vy}</span>
            <button type="button" onClick={()=>setVY(y=>y+1)}>›</button>
          </div>
          <div className="picker-grid-3x4">
            {MS.map((m,i)=>{
              const future = new Date(vy,i,1)>today;
              const sel    = selYear===vy && selMon===i;
              const curr   = today.getMonth()===i && today.getFullYear()===vy;
              return (
                <button key={m} type="button"
                  className={`picker-grid-btn${sel?' selected':''}${future?' disabled':''}${curr&&!sel?' current':''}`}
                  onClick={()=>!future&&pick(i)}>{m}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
