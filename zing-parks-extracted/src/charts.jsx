// ===== Chart helpers =====

// Donut chart with optional empty-slice support
const Donut = ({ data, size = 140, thickness = 22, totalLabel = "Total", currency = false }) => {
  const cx = size/2, cy = size/2;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const sum = data.reduce((s, d) => s + d.value, 0);
  let acc = 0;
  const slices = data.map((d, i) => {
    const frac = sum > 0 ? d.value / sum : 0;
    const len = frac * circ;
    const dash = `${len} ${circ - len}`;
    const offset = -acc;
    acc += len;
    return { ...d, frac, dash, offset, isEmpty: d.value === 0 };
  });
  const totalText = currency ? inr(sum) : num(sum);
  return (
    <div className="donut-wrap">
      <svg className="donut-svg" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F2F5" strokeWidth={thickness}/>
        {sum > 0 && slices.map((s, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={s.dash}
            strokeDashoffset={s.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{transition: "stroke-dasharray .5s"}}
          />
        ))}
        <g className="donut-center" transform={`translate(${cx} ${cy})`}>
          <text className="total" y="-6">{totalLabel.toUpperCase()}</text>
          <text className="val"   y="12">{totalText}</text>
        </g>
      </svg>
      <div className="donut-legend">
        {slices.map((s, i) => (
          <div className="row" key={i}>
            <span className="dot" style={{background: s.isEmpty ? "transparent" : s.color, border: s.isEmpty ? "1px dashed var(--ink-5)" : "0"}}/>
            <span className="name">{s.name}</span>
            {s.isEmpty
              ? <span className="empty-slice" style={{marginLeft:"auto"}}>no data</span>
              : <>
                  <span className="val">{currency ? inr(s.value) : num(s.value)}</span>
                  <span className="pct">{(s.frac*100).toFixed(1)}%</span>
                </>}
          </div>
        ))}
      </div>
    </div>
  );
};

// useResize hook with ResizeObserver — fixes the -1px container bug
function useResize() {
  const ref = React.useRef(null);
  const [size, setSize] = React.useState({ w: 0, h: 0 });
  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const cr = e.contentRect;
        if (cr.width > 0 && cr.height > 0) {
          setSize({ w: cr.width, h: cr.height });
        }
      }
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

Object.assign(window, { Donut, useResize });
