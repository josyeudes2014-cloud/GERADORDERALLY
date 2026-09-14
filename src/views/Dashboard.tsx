import { RefreshCcw, Trophy, UserRoundCheck, Users } from 'lucide-react';
import MetricCard from '../components/MetricCard';
import { tribeById } from '../data/tribes';
import { scoreTotals, type Person, type RallyState } from '../lib/rally';

type Props = {
  state: RallyState;
  totals: ReturnType<typeof scoreTotals>;
  encounterYouth: number;
  algoYouth: number;
  returnedYouth: number;
  workerHighlight?: Person;
  youthHighlight?: Person;
};

export default function Dashboard({ state, totals, encounterYouth, algoYouth, returnedYouth, workerHighlight, youthHighlight }: Props) {
  const leader = totals[0];
  return (
    <div className="page-stack">
      <div className="page-heading"><div><span className="eyebrow">Visão operacional</span><h2>Dashboard do Rally</h2><p>Acompanhe os números da semana e quem está se destacando.</p></div><span className="status-badge"><span /> AO VIVO</span></div>
      <div className="metrics-grid">
        <MetricCard icon={Users} label="Jovens no Encontro" value={encounterYouth} helper={`Semana ${state.config.currentWeek}`} />
        <MetricCard icon={UserRoundCheck} label="Jovens no Algo a Mais" value={algoYouth} helper={`Semana ${state.config.currentWeek}`} />
        <MetricCard icon={RefreshCcw} label="Afastados que voltaram" value={returnedYouth} helper="Registrados nesta semana" />
        <MetricCard icon={Trophy} label="Tribo líder" value={leader ? tribeById(leader.tribeId)?.name ?? '-' : '-'} helper={leader ? `${leader.points.toLocaleString('pt-BR')} pontos` : 'Sem pontuação'} />
      </div>
      <div className="dashboard-grid">
        <article className="spotlight-card"><span className="eyebrow">Obreiro destaque</span><div className="spotlight-avatar">{workerHighlight?.name?.slice(0, 1) ?? '—'}</div><h3>{workerHighlight?.name ?? 'Ainda sem dados'}</h3><p>{workerHighlight ? `${workerHighlight.score} pontos de participação` : 'Cadastre e acompanhe os obreiros para gerar o destaque.'}</p></article>
        <article className="spotlight-card youth"><span className="eyebrow">Jovem destaque</span><div className="spotlight-avatar">{youthHighlight?.name?.slice(0, 1) ?? '—'}</div><h3>{youthHighlight?.name ?? 'Ainda sem dados'}</h3><p>{youthHighlight ? `${youthHighlight.score} pontos de participação` : 'O destaque aparece automaticamente pelo envolvimento no Rally.'}</p></article>
        <article className="progress-card"><div className="progress-head"><div><span className="eyebrow">Progresso do evento</span><h3>Semana {state.config.currentWeek} de {state.config.totalWeeks}</h3></div><strong>{Math.round((state.config.currentWeek / state.config.totalWeeks) * 100)}%</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, (state.config.currentWeek / state.config.totalWeeks) * 100)}%` }} /></div><div className="week-dots">{Array.from({ length: state.config.totalWeeks }, (_, index) => <span key={index} className={index + 1 <= state.config.currentWeek ? 'done' : ''}>{index + 1}</span>)}</div></article>
      </div>
    </div>
  );
}
