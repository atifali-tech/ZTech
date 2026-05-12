'use client';
import { Section, Donut } from './Primitives';
import { inr } from '../lib/format';

export default function RevenueSplits({ data }) {
  if (!data) return null;

  const totalDemo = data.byDemographic.reduce((s, d) => s + d.value, 0);
  const totalCat  = data.byCategory.reduce((s, d) => s + d.value, 0);
  const totalSrc  = data.bySource.reduce((s, d) => s + d.value, 0);
  const totalPay  = data.byPayment.reduce((s, d) => s + d.value, 0);

  return (
    <div className="grid-12">
      <div className="col-3">
        <Section title="Revenue · Demographic" sub={inr(totalDemo)} actions={<span className="tag teal">Adult-led</span>}>
          <Donut data={data.byDemographic} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Category" sub={inr(totalCat)} actions={<span className="tag">1 empty</span>}>
          <Donut data={data.byCategory} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Ticket Source" sub={inr(totalSrc)}>
          <Donut data={data.bySource} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
      <div className="col-3">
        <Section title="Revenue · Payment Mode" sub={inr(totalPay)} actions={<span className="tag teal">UPI 57%</span>}>
          <Donut data={data.byPayment} totalLabel="Total" currency size={130}/>
        </Section>
      </div>
    </div>
  );
}
