// ===== KPI Summary Row =====

const KpiCard = ({ label, value, unit, spark, sparkColor, delta, deltaLabel = "vs yesterday", legend, mini, icon }) => (
  <div className="sec kpi">
    <div className="kpi-label">
      {icon && <Icon name={icon} size={13} color="var(--ink-4)"/>}
      {label}
    </div>
    <div className="row" style={{alignItems:"flex-end", marginTop:4, gap:14}}>
      <div className="kpi-val">
        {value}{unit && <span className="unit">{unit}</span>}
      </div>
      <div style={{marginLeft:"auto"}}>
        {spark && <Sparkline data={spark} color={sparkColor} width={120} height={36}/>}
        {mini && mini}
      </div>
    </div>
    <div className="kpi-row">
      {delta != null && <Delta value={delta}/>}
      <span style={{color:"var(--ink-4)", fontSize:11}}>{deltaLabel}</span>
      <span className="spacer"/>
      <span style={{fontSize:10.5, color:"var(--ink-4)", letterSpacing:".04em", textTransform:"uppercase", fontWeight:600}}>7-day trend</span>
    </div>
    {legend && (
      <div className="legend-dots">
        {legend.map((l, i) => (
          <span key={i}><span className="dot" style={{background:l.color}}/>{l.name} <span className="mono" style={{color:"var(--ink-4)", marginLeft:3}}>{l.val}</span></span>
        ))}
      </div>
    )}
  </div>
);

const KpiRow = () => {
  const parkLegend = PARKS.slice(0,3).map(p => ({ name: p.name.split(" ")[0], color: p.color, val: ({jt:"38%",ud:"22%",dp:"18%"})[p.id] }));
  const peakHour = PEAK_HOUR_INDEX + 6;
  const peakLabel = (peakHour > 12 ? (peakHour-12) + ":00 PM" : peakHour + ":00 AM");

  return (
    <div className="grid-12">
      <div className="col-3">
        <KpiCard
          label="Total Visitors"
          icon="users"
          value={num(2940)}
          spark={sparkVisitors}
          sparkColor="#0E7C66"
          delta={5.8}
          legend={parkLegend}
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Total Revenue"
          icon="chart"
          value={inrFull(489200)}
          spark={sparkRevenue}
          sparkColor="#5A6BCF"
          delta={-7.4}
          legend={[{name:"Tickets", color:"#0E7C66", val:"64%"},{name:"Activities", color:"#D89614", val:"18%"},{name:"F&B", color:"#E5604D", val:"10%"}]}
        />
      </div>
      <div className="col-3">
        <KpiCard
          label="Total Tickets"
          icon="ticket"
          value={num(980)}
          spark={sparkTickets}
          sparkColor="#D89614"
          delta={6.0}
          legend={[{name:"Counter", color:"#0E7C66", val:"54%"},{name:"Web", color:"#5A6BCF", val:"32%"},{name:"WhatsApp", color:"#D89614", val:"14%"}]}
        />
      </div>
      <div className="col-3">
        <div className="sec kpi" style={{background:"linear-gradient(180deg, #FFFFFF 0%, #F6FBF9 100%)"}}>
          <div className="kpi-label"><Icon name="clock" size={13} color="var(--ink-4)"/> Peak Hour</div>
          <div className="row" style={{alignItems:"flex-end", marginTop:4, gap:10}}>
            <div className="kpi-val mono" style={{fontSize:30}}>
              {peakLabel.split(" ")[0]}<span className="unit">{peakLabel.split(" ")[1]}</span>
            </div>
            <div style={{marginLeft:"auto", textAlign:"right"}}>
              <div style={{fontFamily:"'JetBrains Mono', monospace", fontWeight:600, fontSize:18, color:"var(--teal)", lineHeight:1}}>{HOURLY_FOOTFALL[PEAK_HOUR_INDEX]}</div>
              <div style={{fontSize:10, color:"var(--ink-4)", letterSpacing:".04em", textTransform:"uppercase", fontWeight:600, marginTop:3}}>visitors</div>
            </div>
          </div>
          <div className="kpi-row">
            <span className="tag teal">Today's Peak</span>
            <span style={{color:"var(--ink-4)"}}>•  {inr(HOURLY_REVENUE[PEAK_HOUR_INDEX])} revenue this hour</span>
          </div>
          <div style={{marginTop:12, display:"flex", alignItems:"end", gap:2, height:28}}>
            {sparkPeak.map((v,i) => {
              const max = Math.max(...sparkPeak);
              const h = (v/max)*100;
              return <div key={i} style={{flex:1, height:h+"%", background: i===sparkPeak.length-1 ? "var(--teal)" : "var(--teal-100)", borderRadius:1.5}}/>;
            })}
          </div>
          <div style={{display:"flex", justifyContent:"space-between", fontSize:10, color:"var(--ink-4)", marginTop:4, fontFamily:"'JetBrains Mono', monospace"}}>
            <span>Sat</span><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Today</span>
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { KpiRow });
