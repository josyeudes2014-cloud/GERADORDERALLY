import { AlertTriangle, CheckCircle2, Plus, RotateCcw, Save, Settings2, Sparkles, Trophy, UsersRound } from 'lucide-react';
import TribeLogo from '../components/TribeLogo';
import { TRIBES } from '../data/tribes';
import { createDefaultMissions, type RallyConfig, type RallyState } from '../lib/rally';

type Props = {
  state: RallyState;
  busy: boolean;
  onState: (state: RallyState) => void;
  onSave: (config: RallyConfig) => void;
  onNew: () => void;
  onRestart: () => void;
  onFinalize: () => void;
};

export default function RallySettings({ state, busy, onState, onSave, onNew, onRestart, onFinalize }: Props) {
  const config = state.config;
  const patchConfig = (patch: Partial<RallyConfig>) => onState({ ...state, config: { ...config, ...patch } });
  const toggleTribe = (tribeId: string) => {
    const active = config.activeTribeIds.includes(tribeId);
    const next = active ? config.activeTribeIds.filter((id) => id !== tribeId) : [...config.activeTribeIds, tribeId];
    if (!next.length) return;
    patchConfig({ activeTribeIds: next });
  };
  const setTotalWeeks = (totalWeeks: number) => {
    const missions = createDefaultMissions(totalWeeks).map((mission) => state.missions.find((old) => old.week === mission.week) ?? mission);
    onState({ ...state, config: { ...config, totalWeeks, currentWeek: Math.min(config.currentWeek, totalWeeks) }, missions });
  };

  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">Evento reutilizável</span><h2>Configurar Rally</h2><p>Troque nome, identidade visual e tribos sem precisar criar outro site.</p></div><button className="button primary" disabled={busy} onClick={() => onSave(config)}><Save size={17} /> Salvar configuração</button></div>
    <section className="panel-card form-section"><div className="card-title"><div className="icon-tile"><Settings2 /></div><div><h3>Identidade do evento</h3><p>Essas informações aparecem automaticamente em toda a plataforma.</p></div></div><div className="form-grid two"><label><span>Título do Rally</span><input value={config.title} onChange={(e) => patchConfig({ title: e.target.value })} maxLength={64} /></label><label><span>Subtítulo</span><input value={config.subtitle} onChange={(e) => patchConfig({ subtitle: e.target.value })} maxLength={110} /></label><label><span>Total de semanas</span><select value={config.totalWeeks} onChange={(e) => setTotalWeeks(Number(e.target.value))}>{[5,6,7,8,9,10,11,12].map((week) => <option key={week} value={week}>{week} semanas</option>)}</select></label><label><span>Semana atual</span><select value={config.currentWeek} onChange={(e) => patchConfig({ currentWeek: Number(e.target.value) })}>{Array.from({ length: config.totalWeeks }, (_, index) => <option key={index + 1} value={index + 1}>Semana {index + 1}</option>)}</select></label></div></section>
    <section className="panel-card form-section"><div className="card-title"><div className="icon-tile"><Sparkles /></div><div><h3>Cores do Rally</h3><p>O sistema visual inteiro acompanha suas escolhas.</p></div></div><div className="color-grid">{([['primary','Cor principal'],['secondary','Cor escura'],['accent','Cor de destaque']] as const).map(([key,label]) => <label className="color-control" key={key}><input type="color" value={config.theme[key]} onChange={(e) => patchConfig({ theme: { ...config.theme, [key]: e.target.value } })} /><span>{label}<strong>{config.theme[key]}</strong></span></label>)}</div></section>
    <section className="panel-card form-section"><div className="card-title"><div className="icon-tile"><UsersRound /></div><div><h3>Tribos participantes</h3><p>As 12 tribos ficam cadastradas. Marque somente as que vão participar desta edição.</p></div><span className="count-chip">{config.activeTribeIds.length}/12 selecionadas</span></div><div className="tribe-selector">{TRIBES.map((tribe) => { const selected = config.activeTribeIds.includes(tribe.id); return <button type="button" className={selected ? 'selected' : ''} key={tribe.id} onClick={() => toggleTribe(tribe.id)}><TribeLogo tribeId={tribe.id} size={58} /><span><strong>{tribe.name}</strong><small>{tribe.description}</small></span><span className="tribe-check">{selected ? <CheckCircle2 /> : null}</span></button>; })}</div></section>
    <section className="new-rally-card"><div><span className="eyebrow">Próxima edição</span><h3>Quer reutilizar o site para outro Rally?</h3><p>Configure acima o novo título, cores e tribos. Depois crie uma nova edição. O Rally atual será arquivado e os cadastros serão preservados.</p></div><button className="button light" onClick={onNew}><Plus size={18} /> Criar novo Rally</button></section>
    <section className="danger-zone"><div className="danger-title"><AlertTriangle /><div><span className="eyebrow">Zona de perigo</span><h3>Ações permanentes do evento atual</h3></div></div><div className="danger-actions"><div><strong>Reiniciar Rally</strong><p>Zera pontuações e frequências, mantendo os cadastros.</p><button className="button danger-outline" onClick={onRestart}><RotateCcw size={17} /> Reiniciar Rally</button></div><div><strong>Finalizar Rally</strong><p>Encerra o evento e salva o ranking final permanentemente.</p><button className="button danger" disabled={config.finalized} onClick={onFinalize}><Trophy size={17} /> {config.finalized ? 'Rally finalizado' : 'Finalizar Rally'}</button></div></div></section>
  </div>;
}
