// ===== Hourly dual-axis chart =====
const HourlyChart = () => {
  const [ref, size] = useResize();
  const [hover, setHover] = React.useState(null);
  const w = Math.max(size.w, 600);
  const h = 280;
  const pad = { l: 50, r: 60, t: 24, b: 36 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const n = HOURS.length;
  const xStep = innerW / (n - 1);

  const maxFF = Math.max(...HOURLY_FOOTFALL);
  const maxRev = Math.max(...HOURLY_REVENUE);
  const yFF = (v) => pad.t + innerH - (v/maxFF)*innerH;
  const yRev = (v) => pad.t + innerH - (v/maxRev)*innerH;
  const xAt = (i) => pad.l + i*xStep;

  // gridlines (5)
  const gridY = [0, 0.25, 0.5, 0.75, 1].map(t => pad.t + innerH * (1 - t));

  const ffPath = HOURLY_FOOTFALL.map((v,i) => (i===0?"M":"L") + xAt(i) + " " + yFF(v)).join(" ");
  const ffArea = ffPath + ` L ${xAt(n-1)} ${pad.t+innerH} L ${pad.l} ${pad.t+innerH} Z`;
  const revPath = HOURLY_REVENUE.map((v,i) => (i===0?"M":"L") + xAt(i) + " " + yRev(v)).join(" ");

  const peakX = xAt(PEAK_HOUR_INDEX);
  const formatHour = (h) => h===12 ? "12PM" : (h>12 ? (h-12)+"PM" : h+"AM");

  function onMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    let idx = Math.round((x - pad.l) / xStep);
    idx = Math.max(0, Math.min(n-1, idx));
    setHover(idx);
  }

  return (
    <Section
      title="Hourly Footfall × Revenue"
      sub="6 AM — 10 PM · today"
      actions={<>
        <div style={{display:"flex", gap:14, alignItems:"center", marginRight:8}}>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,color:"var(--ink-3)"}}><span style={{width:14,height:2,background:"#0E7C66",display:"inline-block",borderRadius:1}}/>Footfall</span>
          <span style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:11,color:"var(--ink-3)"}}><span style={{width:14,height:2,borderTop:"2px dashed #D89614",display:"inline-block"}}/>Revenue</span>
        </div>
        <div className="toggle-group"><button className="on">Chart</button><button><Icon name="table" size={11}/> Table</button></div>
      </>}
      padded={false}
    >
      <div ref={ref} className="chart-area" style={{padding:"12px 4px 4px"}}>
        <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
          {/* gridlines */}
          {gridY.map((y,i) => (
            <line key={i} x1={pad.l} x2={pad.l+innerW} y1={y} y2={y} stroke="#EEF0F3" strokeWidth="1"/>
          ))}
          {/* peak vertical marker */}
          <line x1={peakX} x2={peakX} y1={pad.t} y2={pad.t+innerH} stroke="#D89614" strokeWidth="1" strokeDasharray="3 3" opacity="0.6"/>
          <g transform={`translate(${peakX}, ${pad.t-4})`}>
            <rect x="-44" y="-16" width="88" height="18" rx="3" fill="#D89614"/>
            <text x="0" y="-3" textAnchor="middle" fill="#fff" fontSize="10.5" fontWeight="600" fontFamily="'JetBrains Mono', monospace">PEAK · {formatHour(HOURS[PEAK_HOUR_INDEX])}</text>
          </g>
          {/* footfall area + line */}
          <defs>
            <linearGradient id="ffGrad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#0E7C66" stopOpacity="0.18"/>
              <stop offset="100%" stopColor="#0E7C66" stopOpacity="0"/>
            </linearGradient>
          </defs>
          <path d={ffArea} fill="url(#ffGrad)"/>
          <path d={ffPath} fill="none" stroke="#0E7C66" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          {/* revenue dashed */}
          <path d={revPath} fill="none" stroke="#D89614" strokeWidth="1.8" strokeDasharray="5 4" strokeLinecap="round"/>

          {/* axes */}
          <line x1={pad.l} x2={pad.l+innerW} y1={pad.t+innerH} y2={pad.t+innerH} stroke="var(--border-strong)"/>
          {/* y-left ticks (footfall) */}
          {[0, 0.25, 0.5, 0.75, 1].map((t,i) => {
            const v = Math.round(maxFF*t);
            const y = pad.t + innerH*(1-t);
            return <text key={i} x={pad.l-8} y={y+3} fontSize="10" fill="var(--ink-4)" textAnchor="end" fontFamily="'JetBrains Mono', monospace">{v}</text>;
          })}
          {/* y-right ticks (revenue) */}
          {[0, 0.5, 1].map((t,i) => {
            const v = maxRev*t;
            const y = pad.t + innerH*(1-t);
            return <text key={i} x={pad.l+innerW+8} y={y+3} fontSize="10" fill="var(--ink-4)" textAnchor="start" fontFamily="'JetBrains Mono', monospace">{inr(v)}</text>;
          })}
          {/* x ticks */}
          {HOURS.map((hr, i) => i%2===0 ? (
            <text key={i} x={xAt(i)} y={pad.t+innerH+16} fontSize="10" fill="var(--ink-4)" textAnchor="middle" fontFamily="'JetBrains Mono', monospace">{formatHour(hr)}</text>
          ) : null)}
          {/* axis labels */}
          <text x={pad.l-36} y={pad.t-8} fontSize="10" fill="var(--ink-4)" fontWeight="600" letterSpacing="0.04em">VISITORS</text>
          <text x={pad.l+innerW+8} y={pad.t-8} fontSize="10" fill="var(--ink-4)" fontWeight="600" letterSpacing="0.04em">REVENUE</text>

          {/* hover indicator */}
          {hover != null && (
            <g>
              <line x1={xAt(hover)} x2={xAt(hover)} y1={pad.t} y2={pad.t+innerH} stroke="var(--ink-3)" strokeWidth="1" strokeDasharray="2 3"/>
              <circle cx={xAt(hover)} cy={yFF(HOURLY_FOOTFALL[hover])} r="4" fill="#fff" stroke="#0E7C66" strokeWidth="2"/>
              <circle cx={xAt(hover)} cy={yRev(HOURLY_REVENUE[hover])} r="4" fill="#fff" stroke="#D89614" strokeWidth="2"/>
            </g>
          )}
        </svg>

        {hover != null && (
          <div className="tooltip" style={{left: xAt(hover) * (size.w/w || 1), top: 60}}>
            <div className="t-title">{formatHour(HOURS[hover])}</div>
            <div className="t-row"><span className="swatch" style={{background:"#0E7C66"}}/>{num(HOURLY_FOOTFALL[hover])} visitors</div>
            <div className="t-row"><span className="swatch" style={{background:"#D89614"}}/>{inr(HOURLY_REVENUE[hover])} revenue</div>
          </div>
        )}
      </div>
    </Section>
  );
};

Object.assign(window, { HourlyChart });
