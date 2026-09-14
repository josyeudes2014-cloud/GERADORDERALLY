import { tribeById } from '../data/tribes';
import type { WeeklyScore } from '../lib/rally';

export default function HistoryChart({ scores, tribeId, totalWeeks }: { scores: WeeklyScore[]; tribeId: string; totalWeeks: number }) {
  const tribe = tribeById(tribeId);
  const values = Array.from({ length: totalWeeks }, (_, index) => scores.find((item) => item.tribeId === tribeId && item.week === index + 1)?.points ?? 0);
  const max = Math.max(1, ...values);
  const points = values.map((value, index) => `${(index / Math.max(1, totalWeeks - 1)) * 100},${82 - (value / max) * 68}`).join(' ');

  return (
    <div className="chart-card">
      <div className="chart-heading">
        <div>
          <span className="eyebrow">Evolução semanal</span>
          <h3>{tribe?.name ?? 'Tribo'}</h3>
        </div>
        <span className="chart-total">{values.reduce((sum, value) => sum + value, 0).toLocaleString('pt-BR')} pts</span>
      </div>
      <div className="chart-wrap" aria-label={`Histórico de pontuação da tribo ${tribe?.name ?? ''}`}>
        <svg viewBox="0 0 100 90" preserveAspectRatio="none" role="img">
          {[18, 34, 50, 66, 82].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} className="chart-grid" />)}
          <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2.5" vectorEffect="non-scaling-stroke" className="chart-line" />
        </svg>
      </div>
      <div className="chart-labels">{values.map((value, index) => <span key={index}>S{index + 1}<small>{value}</small></span>)}</div>
    </div>
  );
}
