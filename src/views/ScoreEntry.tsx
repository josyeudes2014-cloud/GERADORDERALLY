import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clock3, Save } from 'lucide-react';
import HistoryChart from '../components/HistoryChart';
import TribeLogo from '../components/TribeLogo';
import { tribeById } from '../data/tribes';
import { type RallyState } from '../lib/rally';
import { type SessionProfile } from '../lib/remote';
import { formatRemaining, type SubmissionWindow } from '../lib/time';

type Props = { state: RallyState; profile: SessionProfile | null; busy: boolean; timeWindow: SubmissionWindow; systemLocked: boolean; submissionOpen: boolean; onSubmit: (tribeId: string, points: number, details: Record<string, unknown>) => void };

export default function ScoreEntry({ state, profile, busy, timeWindow, systemLocked, submissionOpen, onSubmit }: Props) {
  const admin = profile?.role === 'admin';
  const available = useMemo(() => admin ? state.config.activeTribeIds : state.config.activeTribeIds.filter((id) => id === profile?.tribeId), [admin, profile?.tribeId, state.config.activeTribeIds]);
  const [tribeId, setTribeId] = useState(available[0] ?? '');
  const [manualPoints, setManualPoints] = useState('');
  const [notes, setNotes] = useState('');
  const [values, setValues] = useState<Record<string, number | boolean>>({});
  const mission = state.missions.find((item) => item.week === state.config.currentWeek);
  const rules = mission?.items ?? [];

  useEffect(() => { if (!available.includes(tribeId)) setTribeId(available[0] ?? ''); }, [available, tribeId]);
  useEffect(() => { setValues({}); setManualPoints(''); setNotes(''); }, [tribeId, state.config.currentWeek]);

  const calculatedPoints = rules.reduce((total, rule) => {
    const value = values[rule.id];
    if (rule.mode === 'fixed') return total + (value === true ? rule.points : 0);
    return total + Math.max(0, Number(value) || 0) * rule.points;
  }, 0);
  const finalPoints = rules.length ? calculatedPoints : Math.max(0, Number(manualPoints) || 0);
  const canSubmit = Boolean(tribeId) && !systemLocked && (admin || submissionOpen) && !state.config.finalized;
  const existing = state.weeklyScores.find((item) => item.tribeId === tribeId && item.week === state.config.currentWeek);
  const breakdown = rules.map((rule) => ({ id: rule.id, label: rule.label, points: rule.points, mode: rule.mode, value: values[rule.id] ?? (rule.mode === 'fixed' ? false : 0), subtotal: rule.mode === 'fixed' ? (values[rule.id] === true ? rule.points : 0) : Math.max(0, Number(values[rule.id]) || 0) * rule.points }));

  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">Função do líder de tribo</span><h2>Lançamento de Pontuação Semanal</h2><p>Preencha as atividades da missão. O sistema calcula o total e atualiza o ranking ao enviar.</p></div></div>
    <div className={`window-banner ${systemLocked ? 'locked' : submissionOpen ? 'open' : ''}`}><div className="window-icon"><Clock3 /></div><div><strong>{systemLocked ? 'Sistema bloqueado' : timeWindow.label}</strong><p>{systemLocked ? 'O bloqueio automático protege os dados entre domingo 19h e segunda 7h.' : timeWindow.detail}</p></div><span className="countdown">{formatRemaining(timeWindow.remainingMs)}</span></div>
    <div className="score-layout">
      <section className="panel-card score-form">
        <label><span>Tribo</span><select value={tribeId} disabled={!admin} onChange={(e) => setTribeId(e.target.value)}>{available.map((id) => <option key={id} value={id}>{tribeById(id)?.name}</option>)}</select></label>
        {tribeId ? <div className="selected-tribe"><TribeLogo tribeId={tribeId} size={70} /><div><span>Semana {state.config.currentWeek}</span><strong>{tribeById(tribeId)?.name}</strong><small>{existing?.submitted ? `Último envio: ${existing.points} pontos` : 'Aguardando lançamento'}</small></div></div> : null}
        {rules.length ? <div className="auto-score-list"><div className="auto-score-head"><div><span className="eyebrow">Missão da semana</span><h3>{mission?.title}</h3></div><span className="auto-badge">CÁLCULO AUTOMÁTICO</span></div>{rules.map((rule) => <div className="auto-score-row" key={rule.id}><div><strong>{rule.label || 'Atividade sem nome'}</strong><small>{rule.points} pontos {rule.mode === 'quantity' ? 'por unidade' : 'ao cumprir'}</small></div>{rule.mode === 'fixed' ? <label className="mission-check"><input type="checkbox" checked={values[rule.id] === true} onChange={(e) => setValues((current) => ({ ...current, [rule.id]: e.target.checked }))} /><span>{values[rule.id] === true ? 'Cumprida' : 'Não cumprida'}</span></label> : <div className="quantity-control"><input type="number" min="0" inputMode="numeric" value={Number(values[rule.id] ?? 0)} onChange={(e) => setValues((current) => ({ ...current, [rule.id]: Math.max(0, Number(e.target.value)) }))} /><span>× {rule.points}</span></div>}</div>)}<div className="score-total"><span>Total calculado</span><strong>{calculatedPoints.toLocaleString('pt-BR')} <small>PTS</small></strong></div></div> : <label><span>Pontuação total</span><div className="points-input"><input type="number" min="0" value={manualPoints} onChange={(e) => setManualPoints(e.target.value)} placeholder="0" /><span>PTS</span></div><small className="form-hint">Esta semana ainda não possui itens de cálculo configurados pelo administrador.</small></label>}
        <label><span>Observações</span><textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações importantes sobre o lançamento..." /></label>
        <button className="button primary full" disabled={!canSubmit || busy || (!rules.length && manualPoints === '')} onClick={() => onSubmit(tribeId, finalPoints, { notes, missionTitle: mission?.title ?? '', breakdown })}><Save size={18} /> Salvar e Enviar Pontuação da Semana</button>
        {!canSubmit ? <p className="form-warning"><AlertTriangle size={15} /> O envio está indisponível neste momento.</p> : null}
      </section>
      <aside className="score-side"><article className="panel-card compact"><span className="eyebrow">Regra automática</span><h3>Domingo, 16h → 19h</h3><p>Às 19h o Supabase fecha a rodada. Tribos sem lançamento recebem zero automaticamente e o sistema fica bloqueado até segunda, 7h.</p></article>{tribeId ? <HistoryChart scores={state.weeklyScores} tribeId={tribeId} totalWeeks={state.config.totalWeeks} /> : null}</aside>
    </div>
  </div>;
}
