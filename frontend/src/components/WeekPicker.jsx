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
function getMon(d) {
  const c = new Date(d); c.setHours(0,0,0,0);
  c.setDate(c.getDate() - (c.getDay()+6)%7);
  return c;
}
function fmtRange(start, end) {
  const s = parse(start), e = parse(end);
  const sm = MONTHS[s.getMonth()].slice(0,3), em = MONTHS[e.getMonth()].slice(0,3);
  const sy = s.getFullYear(), ey = e.getFullYear();
  if (sy !== ey) return `${s.getDate()} ${sm} ${sy} – ${e.getDate()} ${em} ${ey}`;
  if (sm !== em)  return `${s.getDate()} ${sm} – ${e.getDate()} ${em} ${sy}`;
  return `${s.getDate()}–${e.getDate()} ${sm} ${sy}`;
}

function buildCells(vy, vm) {
  const firstDow = (new Date(vy,vm,1).getDay()+6)%7;
  const dim = new Date(vy,vm+1,0).getDate();
  const cells = [];
  for (let i=firstDow;i>0;i--) cells.push({d:new Date(vy,vm,1-i),other:true});
  for (let d=1;d<=dim;d++)      cells.push({d:new Date(vy,vm,d),other:false});
  while (cells.length%7!==0) {
    const last=cells[cells.length-1].d;
    const nxt=new Date(last); nxt.setDate(last.getDate()+1);
    cells.push({d:nxt,other:true});
  }
  return cells;
}

export default function WeekPicker({ value, valueEnd, onChange }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const anchor = value ? parse(value) : today;
  const [vy, setVY] = useState(anchor.getFullYear());
  const [vm, setVM] = useState(anchor.getMonth());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const h=(e)=>{if(wrapRef.current&&!wrapRef.current.contains(e.target))setOpen(false);};
    document.addEventListener('mousedown',h);
    return ()=>document.removeEventListener('mousedown',h);
  },[]);

  const prevM = ()=>{ if(vm===0){setVM(11);setVY(y=>y-1);}else setVM(m=>m-1); };
  const nextM = ()=>{ if(vm===11){setVM(0);setVY(y=>y+1);}else setVM(m=>m+1); };

  const cells = buildCells(vy, vm);
  const weeks = Array.from({length:cells.length/7},(_,i)=>cells.slice(i*7,i*7+7));
  const selMonStr = value ? toStr(getMon(parse(value))) : null;
  const todayStr  = toStr(today);

  const selectWeek = (week) => {
    const mon = getMon(week[0].d);
    const sun = new Date(mon); sun.setDate(mon.getDate()+6);
    const end = sun>today ? today : sun;
    onChange(toStr(mon), toStr(end));
    setOpen(false);
  };

  const display = value&&valueEnd ? fmtRange(value, valueEnd) : 'Select week';

  return (
    <div ref={wrapRef} className="picker-wrap">
      <button type="button" className={`picker-input${open?' open':''}`} onClick={()=>setOpen(o=>!o)}>
        {display}
      </button>
      {open && (
        <div className="picker-dropdown" style={{minWidth:264}}>
          <div className="picker-nav">
            <button type="button" onClick={prevM}>‹</button>
            <span className="nav-label">{MONTHS[vm]} {vy}</span>
            <button type="button" onClick={nextM}>›</button>
          </div>
          <div className="picker-cal-head-row">
            {DAYS.map(d=><div key={d} className="picker-cal-head">{d}</div>)}
          </div>
          <div className="picker-week-rows">
            {weeks.map((week,wi)=>{
              const allFuture = week.every(c=>c.d>today);
              const monStr = toStr(getMon(week[0].d));
              const sel = monStr===selMonStr;
              return (
                <div key={wi}
                  className={`picker-week-row${sel?' selected':''}${allFuture?' disabled':''}`}
                  onClick={()=>!allFuture&&selectWeek(week)}>
                  {week.map((c,di)=>{
                    const future = c.d>today;
                    const tod = toStr(c.d)===todayStr;
                    return (
                      <div key={di}
                        className={`picker-cal-cell${c.other?' other-month':''}${future?' disabled':''}${tod?' today':''}`}>
                        {c.d.getDate()}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <button type="button" className="picker-today-btn" onClick={()=>{
            const mon=getMon(today);
            const sun=new Date(mon);sun.setDate(mon.getDate()+6);
            onChange(toStr(mon),toStr(sun>today?today:sun));
            setOpen(false);
          }}>This week</button>
        </div>
      )}
    </div>
  );
}
