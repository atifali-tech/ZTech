// ===== App shell =====
const Topbar = ({ liveCount }) => (
  <div className="topbar">
    <div className="crumbs">
      <Icon name="grid" size={13} color="var(--ink-3)"/>
      <span>Operations</span>
      <Icon name="chevronR" size={11} color="var(--ink-5)"/>
      <strong>Dashboard</strong>
    </div>
    <span className="tag">FY 2025–26 · Q1</span>

    <div className="topbar-right">
      <div className="live-pill">
        <span className="live-dot"/>
        <span><span className="mono" style={{color:"var(--ink)", fontWeight:600}}>{num(liveCount)}</span> in-park now</span>
      </div>
      <button className="icon-btn" title="Refresh"><Icon name="refresh" size={14}/></button>
      <button className="icon-btn" title="Notifications"><Icon name="bell" size={14}/></button>
      <button className="icon-btn" title="Settings"><Icon name="cog" size={14}/></button>
    </div>
  </div>
);

const App = () => {
  const [filters, setFilters] = React.useState({
    park: "All Parks", state: "All States", city: "All Cities",
    range: "Last 7 days", compare: false,
  });
  const [exportToast, setExportToast] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  const [liveCount, setLiveCount] = React.useState(1284);

  // simulate live count
  React.useEffect(() => {
    const t = setInterval(() => {
      setLiveCount(c => Math.max(0, c + Math.round((Math.random()-0.45)*8)));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  const showComparative = filters.range === "This Quarter" || filters.range === "This Year";

  const onApply = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 700);
  };
  const onExport = (kind) => {
    setExportToast(`Exporting ${kind}…`);
    setTimeout(() => setExportToast(null), 2200);
  };

  return (
    <div className="app">
      <Sidebar/>
      <div className="main">
        <Topbar liveCount={liveCount}/>
        <div className="canvas">
          <FilterBar filters={filters} setFilters={setFilters} onApply={onApply} onExport={onExport}/>

          <div style={{display:"flex", alignItems:"center", gap:10, fontSize:12, color:"var(--ink-3)"}}>
            <Icon name="info" size={13} color="var(--ink-4)"/>
            Showing data for <strong style={{color:"var(--ink)"}}>{filters.park === "All Parks" ? "all 5 parks" : filters.park}</strong> · {filters.range.toLowerCase()} · last refreshed <span className="mono">2 min ago</span>
            <span className="spacer"/>
            {loading && <span className="tag amber">Refreshing widgets…</span>}
            {filters.compare && <span className="tag teal">Comparing to previous period</span>}
          </div>

          <div style={{opacity: loading ? 0.55 : 1, transition: "opacity .25s"}}>
            <KpiRow/>
          </div>

          <DemographicsSection/>

          <RevenueSplits/>

          <HourlyChart/>

          <Heatmap/>

          <WeWdSection/>

          <ComparativeSection visible={showComparative}/>

          <TopParksRow/>

          <div style={{textAlign:"center", color:"var(--ink-5)", fontSize:11, marginTop:8}}>
            ZingParks Ops Console v1.0 · Phase 1 · © NovoStack 2026
          </div>
        </div>
      </div>

      {exportToast && (
        <div style={{position:"fixed", bottom:24, right:24, background:"var(--ink)", color:"#fff", padding:"10px 14px", borderRadius:6, fontSize:12.5, boxShadow:"0 8px 24px rgba(0,0,0,.18)", display:"flex", alignItems:"center", gap:8, zIndex:100}}>
          <Icon name="download" size={13} color="#fff"/> {exportToast}
        </div>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById("app")).render(<App/>);
