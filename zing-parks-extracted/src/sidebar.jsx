const Sidebar = () => {
  const items = [
    { id: "dash",  label: "Dashboard",         icon: "grid",     active: true },
    { id: "tix",   label: "Tickets",           icon: "ticket",   active: false, enabled: true },
  ];
  const soon = [
    { id: "ff",   label: "Footfall Analytics", icon: "users" },
    { id: "rev",  label: "Revenue Analytics",  icon: "chart" },
    { id: "act",  label: "Activities",         icon: "activity" },
    { id: "park", label: "Parking",            icon: "car" },
    { id: "fnb",  label: "F&B",                icon: "coffee" },
    { id: "rep",  label: "Reports & Exports",  icon: "file" },
  ];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">Z</div>
        <div>
          <div className="brand-name">ZingParks</div>
          <div className="brand-sub">Ops Console</div>
        </div>
      </div>

      <div className="sidebar-section">Live</div>
      <div className="sidebar-nav">
        {items.map(it => (
          <div key={it.id} className={"nav-item" + (it.active ? " active" : "")}>
            <Icon name={it.icon} size={15} />
            <span>{it.label}</span>
          </div>
        ))}
      </div>

      <div className="sidebar-section">Roadmap · Q3 · Q4</div>
      <div className="sidebar-nav">
        {soon.map(it => (
          <div key={it.id} className="nav-item disabled">
            <Icon name={it.icon} size={15} />
            <span>{it.label}</span>
            <span className="nav-soon">Soon</span>
          </div>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="avatar">RS</div>
        <div style={{minWidth:0, flex:1}}>
          <div style={{fontWeight:600, color:"#fff", fontSize:12, lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis"}}>Rohan Sahay</div>
          <div style={{color:"var(--sidebar-ink-dim)", fontSize:10}}>Super Admin · 5 parks</div>
        </div>
        <Icon name="logout" size={14} color="var(--sidebar-ink-dim)" />
      </div>
    </aside>
  );
};

Object.assign(window, { Sidebar });
