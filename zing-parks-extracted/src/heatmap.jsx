const Heatmap = () => {
  const [hover, setHover] = React.useState(null);
  const formatHour = (h) => h===12 ? "12PM" : (h>12 ? (h-12)+"PM" : h+"AM");
  const colorFor = (v) => {
    const t = v / HM_MAX;
    // blend white -> teal-50 -> teal-100 -> teal -> teal-700
    if (t < 0.05) return "#FAFBFC";
    const stops = [
      [0.05, [235,245,241]], [0.25, [214,237,230]],
      [0.55, [111,183,164]], [0.85, [14,124,102]], [1.0, [10,94,77]],
    ];
    for (let i=0; i<stops.length-1; i++) {
      const [p0, c0] = stops[i], [p1, c1] = stops[i+1];
      if (t <= p1) {
        const f = (t - p0)/(p1 - p0);
        const r = Math.round(c0[0] + (c1[0]-c0[0])*f);
        const g = Math.round(c0[1] + (c1[1]-c0[1])*f);
        const b = Math.round(c0[2] + (c1[2]-c0[2])*f);
        return `rgb(${r},${g},${b})`;
      }
    }
    return "rgb(10,94,77)";
  };

  const dayTotals = HEATMAP.map(row => row.reduce((s,v)=>s+v,0));
  const peakDayIdx = dayTotals.indexOf(Math.max(...dayTotals));

  return (
    <Section
      title="Peak Hour Heatmap"
      sub="7-day rolling · footfall density"
      actions={<span className="tag teal">Sat 6PM hottest</span>}
    >
      <div style={{position:"relative"}}>
        <div className="heatmap" style={{gridTemplateColumns:"54px repeat(17, 1fr)"}}>
          <div/>
          {HOURS.map((hr,i) => <div key={i} className="hm-col-label">{i%2===0 ? formatHour(hr) : ""}</div>)}
          {DAYS.map((d, di) => (
            <React.Fragment key={d}>
              <div className="hm-row-label" style={{fontWeight: di===peakDayIdx ? 700 : 500, color: di===peakDayIdx ? "var(--ink)" : "var(--ink-4)"}}>{d}</div>
              {HEATMAP[di].map((v, hi) => (
                <div key={hi} className="hm-cell"
                  style={{
                    background: colorFor(v),
                    border: hover && hover.di===di && hover.hi===hi ? "1.5px solid var(--ink)" : "1px solid rgba(15,19,32,0.04)",
                  }}
                  onMouseEnter={() => setHover({di, hi, v})}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
            </React.Fragment>
          ))}
        </div>
        {hover && (
          <div className="tooltip" style={{
            left: `calc(54px + ${(hover.hi + 0.5) * (100/17)}% * (1 - 54/100))`,
            top: 28 + hover.di * 31,
          }}>
            <div className="t-title">{DAYS[hover.di]} · {formatHour(HOURS[hover.hi])}</div>
            <div className="t-row"><span className="swatch" style={{background: colorFor(hover.v)}}/>{num(hover.v)} visitors</div>
          </div>
        )}
      </div>
      <div style={{display:"flex", alignItems:"center", marginTop:14}}>
        <div className="legend-bar">
          <span className="mono">0</span>
          <span className="legend-grad"/>
          <span className="mono">{num(HM_MAX)}</span>
          <span style={{marginLeft:8, color:"var(--ink-4)"}}>visitors / hour</span>
        </div>
        <div style={{marginLeft:"auto", fontSize:11, color:"var(--ink-4)"}}>
          Hover any cell · darkest cells = peak demand windows
        </div>
      </div>
    </Section>
  );
};

Object.assign(window, { Heatmap });
