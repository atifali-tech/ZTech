const RevenueSplits = () => {
  const totalDemo = REV_BY_DEMO.reduce((s,d)=>s+d.value,0);
  const totalCat = REV_BY_CATEGORY.reduce((s,d)=>s+d.value,0);
  const totalSrc = REV_BY_SOURCE.reduce((s,d)=>s+d.value,0);
  const totalPay = REV_BY_PAYMENT.reduce((s,d)=>s+d.value,0);
  return (
    <div className="grid-12">
      <div className="col-3">
        <Section title="Revenue · Demographic" sub={<>{inr(totalDemo)}</>} actions={<span className="tag teal">Adult-led</span>}>
          <Donut data={REV_BY_DEMO} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Category" sub={<>{inr(totalCat)}</>} actions={<span className="tag" title="One category has zero revenue">1 empty</span>}>
          <Donut data={REV_BY_CATEGORY} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Ticket Source" sub={<>{inr(totalSrc)}</>}>
          <Donut data={REV_BY_SOURCE} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Payment Mode" sub={<>{inr(totalPay)}</>} actions={<span className="tag teal">UPI 57%</span>}>
          <Donut data={REV_BY_PAYMENT} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
    </div>
  );
};

Object.assign(window, { RevenueSplits });
