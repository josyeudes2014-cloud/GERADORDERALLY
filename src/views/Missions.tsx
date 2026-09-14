import { useEffect, useState } from 'react';
import { CheckCircle2, Plus, Save, Target, X } from 'lucide-react';
import { type MissionScoringItem, type RallyState, type WeekMission } from '../lib/rally';

const makeId = () => `mission-item-${crypto.randomUUID()}`;

type Props = { state: RallyState; admin: boolean; busy: boolean; onSave: (mission: WeekMission) => void; onFinalize: () => void };

export default function Missions({ state, admin, busy, onSave, onFinalize }: Props) {
  const [selectedWeek, setSelectedWeek] = useState(state.config.currentWeek);
  const emptyMission = (week: number): WeekMission => ({ week, title: '', body: '', finalized: false, items: [] });
  const [draft, setDraft] = useState<WeekMission>(() => state.missions.find((item) => item.week === selectedWeek) ?? emptyMission(selectedWeek));
  useEffect(() => { setDraft(state.missions.find((item) => item.week === selectedWeek) ?? emptyMission(selectedWeek)); }, [selectedWeek, state.missions]);

  const items = draft.items ?? [];
  const addItem = () => setDraft({ ...draft, items: [...items, { id: makeId(), label: '', points: 0, mode: 'quantity' }] });
  const updateItem = (id: string, patch: Partial<MissionScoringItem>) => setDraft({ ...draft, items: items.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const removeItem = (id: string) => setDraft({ ...draft, items: items.filter((item) => item.id !== id) });

  return <div className="page-stack">
    <div className="page-heading">
      <div><span className="eyebrow">{state.config.totalWeeks} semanas organizadas</span><h2>Missões do Rally</h2><p>Cada semana mantém sua própria missão, regras de pontuação, histórico e status.</p></div>
      {admin && selectedWeek === state.config.currentWeek && !draft.finalized ? <button className="button primary" disabled={busy} onClick={onFinalize}><CheckCircle2 size={17} /> Finalizar semana</button> : null}
    </div>
    <div className="mission-layout">
      <aside className="week-list">{Array.from({ length: state.config.totalWeeks }, (_, index) => index + 1).map((week) => { const mission = state.missions.find((item) => item.week === week); return <button key={week} className={week === selectedWeek ? 'active' : ''} onClick={() => setSelectedWeek(week)}><span>{String(week).padStart(2,'0')}</span><div><strong>Semana {week}</strong><small>{mission?.finalized ? 'Finalizada' : week === state.config.currentWeek ? 'Em andamento' : 'Programada'}</small></div>{mission?.finalized ? <CheckCircle2 size={16} /> : null}</button>; })}</aside>
      <section className="panel-card mission-editor">
        <div className="mission-editor-head"><span className="week-big">{String(selectedWeek).padStart(2,'0')}</span><div><span className="eyebrow">Semana {selectedWeek}</span><h3>{draft.title || 'Missão sem título'}</h3></div></div>
        {admin ? <>
          <label><span>Título da missão</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: O Chamado dos Valentes" /></label>
          <label><span>Descrição, metas e orientações</span><textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={9} placeholder="Escreva aqui toda a missão da semana..." /></label>
          <div className="scoring-editor-head"><div><span className="eyebrow">Cálculo automático</span><h4>Itens de pontuação</h4><p>Crie as regras que o líder preencherá. O total será calculado automaticamente.</p></div><button type="button" className="button secondary small" onClick={addItem}><Plus size={16} /> Adicionar item</button></div>
          <div className="scoring-rule-list">{items.length ? items.map((item, index) => <div className="scoring-rule" key={item.id}><span className="rule-index">{index + 1}</span><label><span>Atividade</span><input value={item.label} onChange={(e) => updateItem(item.id, { label: e.target.value })} placeholder="Ex.: Jovem presente no Encontro" /></label><label><span>Pontos</span><input type="number" min="0" value={item.points} onChange={(e) => updateItem(item.id, { points: Math.max(0, Number(e.target.value)) })} /></label><label><span>Forma de cálculo</span><select value={item.mode} onChange={(e) => updateItem(item.id, { mode: e.target.value as MissionScoringItem['mode'] })}><option value="quantity">Por quantidade</option><option value="fixed">Missão cumprida</option></select></label><button type="button" className="icon-button danger-text rule-remove" onClick={() => removeItem(item.id)} aria-label={`Remover item ${index + 1}`}><X size={17} /></button></div>) : <div className="empty-state compact-empty"><Target /><strong>Nenhum item de pontuação</strong><span>Adicione atividades para habilitar o cálculo automático do líder.</span></div>}</div>
          <button className="button primary" disabled={busy || draft.finalized} onClick={() => onSave({ ...draft, items })}><Save size={17} /> {draft.finalized ? 'Semana finalizada' : 'Salvar missão da semana'}</button>
        </> : <div className="mission-reading"><p>{draft.body || 'A missão ainda não foi publicada.'}</p>{items.length ? <div className="mission-public-rules"><strong>Como pontua</strong>{items.map((item) => <span key={item.id}>{item.label || 'Atividade'} <b>{item.points} pts {item.mode === 'quantity' ? 'por unidade' : 'ao cumprir'}</b></span>)}</div> : null}</div>}
      </section>
    </div>
  </div>;
}
