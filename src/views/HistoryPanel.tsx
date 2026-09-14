import { useState } from 'react';
import HistoryChart from '../components/HistoryChart';
import { tribeById } from '../data/tribes';
import { type RallyState } from '../lib/rally';
import { type SessionProfile } from '../lib/remote';

export default function HistoryPanel({ state, profile }: { state: RallyState; profile: SessionProfile | null }) {
  const [tribeId, setTribeId] = useState(profile?.role === 'leader' ? profile.tribeId ?? '' : state.config.activeTribeIds[0] ?? '');
  const visible = profile?.role === 'leader' ? state.config.activeTribeIds.filter((id) => id === profile.tribeId) : state.config.activeTribeIds;
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Evolução do desempenho</span><h2>Histórico de Pontuação</h2><p>Veja como a pontuação evolui ao longo das semanas.</p></div><select className="top-select" value={tribeId} onChange={(e) => setTribeId(e.target.value)}>{visible.map((id) => <option key={id} value={id}>{tribeById(id)?.name}</option>)}</select></div>{tribeId ? <HistoryChart scores={state.weeklyScores} tribeId={tribeId} totalWeeks={state.config.totalWeeks} /> : null}<div className="panel-card"><div className="table-wrap"><table><thead><tr><th>Semana</th><th>Status</th><th>Pontuação</th></tr></thead><tbody>{Array.from({ length: state.config.totalWeeks }, (_, index) => { const item = state.weeklyScores.find((score) => score.tribeId === tribeId && score.week === index + 1); return <tr key={index}><td>Semana {index + 1}</td><td><span className={`table-status ${item?.submitted ? 'ok' : ''}`}>{item?.submitted ? 'Enviado' : 'Pendente'}</span></td><td><strong>{item?.points ?? 0} pts</strong></td></tr>; })}</tbody></table></div></div></div>;
}
