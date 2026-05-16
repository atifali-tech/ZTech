'use client';
import { useState, useRef, useEffect } from 'react';

const QS = ['Q1','Q2','Q3','Q4'];
const Q_STARTS = [0,3,6,9];

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export default function QuarterPicker({ value, onChange }) {
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
  const selQ    = value ? Math.floor(new Date(value+'T00:00:00').getMonth()/3) : null;
  const currQ   = Math.floor(today.getMonth()/3);

  const pick = (qi) => {
    const sm    = Q_STARTS[qi];
    const start = new Date(vy,sm,1);
    const end0  = new Date(vy,sm+3,0);
    onChange(toStr(start), toStr(end0>today?today:end0));
    setOpen(false);
  };

  const display = value
    ? `${new Date(value+'T00:00:00').getFullYear()}-Q${Math.floor(new Date(value+'T00:00:00').getMonth()/3)+1}`
    : 'Select quarter';

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
          <div style={{display:'flex',gap:6,paddingTop:4}}>
            {QS.map((q,qi)=>{
              const future = new Date(vy,Q_STARTS[qi],1)>today;
              const sel    = selYear===vy && selQ===qi;
              const curr   = today.getFullYear()===vy && currQ===qi;
              return (
                <button key={q} type="button"
                  className={`picker-grid-btn${sel?' selected':''}${future?' disabled':''}${curr&&!sel?' current':''}`}
                  style={{flex:1,padding:'10px 4px'}}
                  onClick={()=>!future&&pick(qi)}>{q}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
