'use client';
import { useState, useRef, useEffect } from 'react';

const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parse(s) {
  const [y,m,d] = s.split('-').map(Number);
  return new Date(y, m-1, d);
}
function fmt(s) {
  if (!s) return '';
  const d = parse(s);
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS[d.getMonth()].slice(0,3)}-${d.getFullYear()}`;
}

export default function DatePicker({ value, onChange }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const anchor = value ? parse(value) : today;
  const [vy, setVY] = useState(anchor.getFullYear());
  const [vm, setVM] = useState(anchor.getMonth());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const prevM = () => { if (vm===0){setVM(11);setVY(y=>y-1);}else setVM(m=>m-1); };
  const nextM = () => { if (vm===11){setVM(0);setVY(y=>y+1);}else setVM(m=>m+1); };

  const dow0 = (new Date(vy,vm,1).getDay()+6)%7;
  const dim  = new Date(vy,vm+1,0).getDate();
  const cells = [...Array(dow0).fill(null), ...Array.from({length:dim},(_,i)=>new Date(vy,vm,i+1))];

  return (
    <div ref={wrapRef} className="picker-wrap">
      <button type="button" className={`picker-input${open?' open':''}`} onClick={()=>setOpen(o=>!o)}>
        {fmt(value) || 'Select date'}
      </button>
      {open && (
        <div className="picker-dropdown">
          <div className="picker-nav">
            <button type="button" onClick={prevM}>‹</button>
            <span className="nav-label">{MONTHS[vm]} {vy}</span>
            <button type="button" onClick={nextM}>›</button>
          </div>
          <div className="picker-cal">
            {DAYS.map(d=><div key={d} className="picker-cal-head">{d}</div>)}
            {cells.map((d,i)=>{
              const future = d && d>today;
              const sel    = d && toStr(d)===value;
              const tod    = d && toStr(d)===toStr(today);
              return (
                <div key={i}
                  onClick={()=>{ if(d&&!future){onChange(toStr(d));setOpen(false);} }}
                  className={`picker-cal-cell${!d?' empty':''}${future?' disabled':''}${sel?' selected':''}${tod&&!sel?' today':''}`}>
                  {d?.getDate()}
                </div>
              );
            })}
          </div>
          <button type="button" className="picker-today-btn"
            onClick={()=>{onChange(toStr(today));setOpen(false);}}>Today</button>
        </div>
      )}
    </div>
  );
}
