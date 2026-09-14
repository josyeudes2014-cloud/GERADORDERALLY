import type { LucideIcon } from 'lucide-react';

export default function MetricCard({ icon: Icon, label, value, helper }: { icon: LucideIcon; label: string; value: string | number; helper?: string }) {
  return (
    <article className="metric-card">
      <div className="metric-icon"><Icon size={21} /></div>
      <div>
        <p className="metric-label">{label}</p>
        <strong className="metric-value">{value}</strong>
        {helper ? <p className="metric-helper">{helper}</p> : null}
      </div>
    </article>
  );
}
