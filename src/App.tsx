import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Crown,
  Gauge,
  History,
  LayoutDashboard,
  LogIn,
  LogOut,
  Medal,
  Megaphone,
  Menu,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  UserRoundCheck,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import ConfirmDialog from './components/ConfirmDialog';
import HistoryChart from './components/HistoryChart';
import MetricCard from './components/MetricCard';
import TribeLogo from './components/TribeLogo';
import { TRIBES, tribeById } from './data/tribes';
import {
  buildFinalRanking,
  createDefaultMissions,
  loadLocalState,
  saveLocalState,
  scoreTotals,
  type Attendance,
  type Person,
  type PersonKind,
  type RallyConfig,
  type RallyState,
  type WeekMission,
} from './lib/rally';
import {
  createNewRally,
  finalizeRally,
  finalizeWeek,
  getSessionProfile,
  loadRemoteState,
  publishAnnouncement,
  removePerson,
  restartRally,
  saveAttendance,
  saveConfig,
  saveMission,
  savePerson,
  seedRemoteState,
  signIn,
  signOut,
  submitWeeklyScore,
  subscribeAuth,
  subscribeRemoteState,
  type SessionProfile,
} from './lib/remote';
import { formatRemaining, getSubmissionWindowStatus } from './lib/time';

type AdminTab = 'dashboard' | 'rally' | 'missions' | 'scores' | 'workers' | 'youth' | 'reports' | 'announcements' | 'history';
type DialogKind = 'restart' | 'finalize' | 'new-rally' | null;

const navItems: { id: AdminTab; label: string; icon: typeof Gauge; adminOnly?: boolean }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { id: 'rally', label: 'Configurar Rally', icon: Settings2, adminOnly: true },
  { id: 'missions', label: 'Missões', icon: Target },
  { id: 'scores', label: 'Pontuação Semanal', icon: Trophy },
  { id: 'history', label: 'Histórico', icon: History },
  { id: 'workers', label: 'Obreiros', icon: ShieldCheck, adminOnly: true },
  { id: 'youth', label: 'Jovens', icon: UsersRound, adminOnly: true },
  { id: 'reports', label: 'Relatórios', icon: CalendarCheck, adminOnly: true },
  { id: 'announcements', label: 'Comunicados', icon: Bell, adminOnly: true },
];

const makeId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

function App() {
  const [state, setState] = useState<RallyState>(() => loadLocalState());
  const [profile, setProfile] = useState<SessionProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncLabel, setSyncLabel] = useState('Conectando ao Firebase...');
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [mobileNav, setMobileNav] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(Date.now());

  const isAdmin = profile?.role === 'admin' || profile?.role === 'local-admin';
  const isLeader = profile?.role === 'leader';
  const isBackoffice = isAdmin || isLeader;

  const updateState = (next: RallyState) => {
    setState(next);
    saveLocalState(next);
  };

  useEffect(() => {
    const interval = window.setInterval(() => setTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let remoteUnsub: (() => void) | undefined;
    const authUnsub = subscribeAuth(async (user) => {
      try {
        const session = await getSessionProfile(user);
        setProfile(session);
        if (session?.role === 'leader') setTab('scores');
        if (session?.role === 'admin') {
          await seedRemoteState(state);
        }
        if (session) {
          const remote = await loadRemoteState();
          if (remote) updateState(remote);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setAuthReady(true);
      }
    });

    remoteUnsub = subscribeRemoteState((next) => {
      updateState(next);
      setSyncLabel('Sincronizado com Firebase');
    }, () => setSyncLabel('Firebase conectado — acesso parcial'));

    loadRemoteState()
      .then((remote) => {
        if (remote) {
          updateState(remote);
          setSyncLabel('Sincronizado com Firebase');
        } else {
          setSyncLabel('Firebase pronto — aguardando configuração inicial');
        }
      })
      .catch(() => setSyncLabel('Firebase conectado — aguardando autenticação'));

    return () => {
      authUnsub();
      remoteUnsub?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', state.config.theme.primary);
    document.documentElement.style.setProperty('--secondary', state.config.theme.secondary);
    document.documentElement.style.setProperty('--accent', state.config.theme.accent);
    document.title = state.config.title;
  }, [state.config]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const totals = useMemo(() => scoreTotals(state), [state]);
  const currentMission = state.missions.find((item) => item.week === state.config.currentWeek) ?? state.missions[0];
  const timeWindow = getSubmissionWindowStatus(new Date(tick));
  const effectiveControl = {
    systemLocked: state.control.systemLocked || (timeWindow.state === 'locked' && new Date().getDay() === 0 && new Date().getHours() >= 19),
    submissionOpen: state.control.submissionOpen || timeWindow.state === 'open',
  };

  const currentAttendance = state.attendance.filter((item) => item.week === state.config.currentWeek);
  const youthIds = new Set(state.people.filter((person) => person.kind === 'youth').map((person) => person.id));
  const encounterYouth = currentAttendance.filter((item) => item.meeting === 'encontro' && item.present && youthIds.has(item.personId)).length;
  const algoYouth = currentAttendance.filter((item) => item.meeting === 'algo_mais' && item.present && youthIds.has(item.personId)).length;
  const returnedYouth = currentAttendance.filter((item) => item.returned && youthIds.has(item.personId)).length;
  const workerHighlight = [...state.people].filter((person) => person.kind === 'worker').sort((a, b) => b.score - a.score)[0];
  const youthHighlight = [...state.people].filter((person) => person.kind === 'youth').sort((a, b) => b.score - a.score)[0];

  const runAction = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await action();
      const remote = await loadRemoteState();
      if (remote) updateState(remote);
      setToast(success);
    } catch (error) {
      console.error(error);
      setToast(error instanceof Error ? error.message : 'Não foi possível concluir a ação.');
    } finally {
      setBusy(false);
    }
  };

  const handleDialogConfirm = async () => {
    const kind = dialog;
    setDialog(null);
    if (kind === 'restart') {
      await runAction(() => restartRally(state.config), 'Pontuações zeradas. Cadastros preservados.');
    }
    if (kind === 'finalize') {
      await runAction(() => finalizeRally(buildFinalRanking(state)), 'Rally finalizado e ranking final salvo.');
    }
    if (kind === 'new-rally') {
      const nextConfig: RallyConfig = { ...state.config, id: `rally-${Date.now()}`, currentWeek: 1, finalized: false, finalRanking: [] };
      await runAction(() => createNewRally(state, nextConfig), 'Novo Rally criado. O evento anterior foi arquivado.');
    }
  };

  return (
    <div className="app-shell">
      {isBackoffice ? (
        <>
          <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
            <div className="brand-mark"><span>R</span><div><strong>RALLY FJU</strong><small>Central de gestão</small></div></div>
            <nav>
              {navItems.filter((item) => !item.adminOnly || isAdmin).map(({ id, label, icon: Icon }) => (
                <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setMobileNav(false); }}>
                  <Icon size={18} /><span>{label}</span><ChevronRight size={15} className="nav-arrow" />
                </button>
              ))}
            </nav>
            <div className="sidebar-footer">
              <span className="role-chip">{isAdmin ? 'ADMINISTRADOR' : 'LÍDER DE TRIBO'}</span>
              <small>{profile?.email}</small>
              <button onClick={() => signOut()}><LogOut size={17} /> Sair</button>
            </div>
          </aside>
          {mobileNav ? <button className="nav-scrim" aria-label="Fechar menu" onClick={() => setMobileNav(false)} /> : null}
          <main className="admin-main">
            <div className="admin-topbar">
              <button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu /></button>
              <div><span className="eyebrow">Semana {state.config.currentWeek} de {state.config.totalWeeks}</span><h1>{state.config.title}</h1></div>
              <div className="sync-pill"><span className="sync-dot" />{syncLabel}</div>
            </div>
            <div className="admin-content">
              {tab === 'dashboard' && isAdmin ? <Dashboard state={state} totals={totals} encounterYouth={encounterYouth} algoYouth={algoYouth} returnedYouth={returnedYouth} workerHighlight={workerHighlight} youthHighlight={youthHighlight} /> : null}
              {tab === 'rally' && isAdmin ? <RallySettings state={state} busy={busy} onState={updateState} onSave={(config) => runAction(() => saveConfig(config), 'Configurações do Rally salvas.')} onNew={() => setDialog('new-rally')} onRestart={() => setDialog('restart')} onFinalize={() => setDialog('finalize')} /> : null}
              {tab === 'missions' ? <Missions state={state} admin={isAdmin} busy={busy} onSave={(mission) => runAction(() => saveMission(mission), 'Missão salva.')} onFinalize={() => runAction(() => finalizeWeek(state), 'Semana finalizada e próxima semana liberada.')} /> : null}
              {tab === 'scores' ? <ScoreEntry state={state} profile={profile} busy={busy} timeWindow={timeWindow} systemLocked={effectiveControl.systemLocked} submissionOpen={effectiveControl.submissionOpen} onSubmit={(tribeId, points, details) => runAction(() => submitWeeklyScore(tribeId, state.config.currentWeek, points, details), 'Pontuação semanal enviada.')} /> : null}
              {tab === 'history' ? <HistoryPanel state={state} profile={profile} /> : null}
              {tab === 'workers' && isAdmin ? <PeoplePanel state={state} kind="worker" busy={busy} onRefresh={async () => { const remote = await loadRemoteState(); if (remote) updateState(remote); }} runAction={runAction} /> : null}
              {tab === 'youth' && isAdmin ? <PeoplePanel state={state} kind="youth" busy={busy} onRefresh={async () => { const remote = await loadRemoteState(); if (remote) updateState(remote); }} runAction={runAction} /> : null}
              {tab === 'reports' && isAdmin ? <Reports state={state} /> : null}
              {tab === 'announcements' && isAdmin ? <Announcements state={state} busy={busy} onPublish={(title, body) => runAction(() => publishAnnouncement(title, body), 'Comunicado publicado.')} /> : null}
            </div>
          </main>
        </>
      ) : (
        <PublicHome state={state} totals={totals} mission={currentMission} syncLabel={syncLabel} onLogin={() => setLoginOpen(true)} />
      )}

      {loginOpen ? <LoginModal onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} /> : null}
      <ConfirmDialog open={dialog !== null} title={dialog === 'restart' ? 'Reiniciar Rally?' : dialog === 'finalize' ? 'Finalizar Rally?' : 'Criar um novo Rally?'} description={dialog === 'restart' ? 'Todas as pontuações e frequências serão zeradas, mas os cadastros de obreiros e jovens serão mantidos.' : dialog === 'finalize' ? 'O ranking atual será salvo como resultado final. Esta ação encerra o evento atual.' : 'O Rally atual será arquivado e uma nova edição será criada usando o título, cores e tribos que estão configurados agora. Os cadastros serão preservados.'} confirmLabel={dialog === 'restart' ? 'Sim, reiniciar' : dialog === 'finalize' ? 'Finalizar evento' : 'Criar novo Rally'} danger={dialog === 'restart' || dialog === 'finalize'} onCancel={() => setDialog(null)} onConfirm={handleDialogConfirm} />
      {toast ? <div className="toast"><CheckCircle2 size={18} />{toast}</div> : null}
      {busy ? <div className="busy-bar" /> : null}
      {!authReady ? <div className="boot-screen"><div className="loader" /><span>Preparando o Rally...</span></div> : null}
    </div>
  );
}

function PublicHome({ state, totals, mission, syncLabel, onLogin }: { state: RallyState; totals: ReturnType<typeof scoreTotals>; mission?: WeekMission; syncLabel: string; onLogin: () => void }) {
  const podium = totals.slice(0, 3);
  return (
    <main className="public-page">
      <section className="hero">
        <div className="hero-noise" />
        <header className="public-header">
          <div className="brand-mark light"><span>R</span><div><strong>RALLY FJU</strong><small>Plataforma oficial</small></div></div>
          <button className="button ghost" onClick={onLogin}><LogIn size={17} /> Entrar</button>
        </header>
        <div className="hero-copy">
          <span className="hero-badge"><Sparkles size={14} /> Semana {state.config.currentWeek} em andamento</span>
          <h1>{state.config.title}</h1>
          <p>{state.config.subtitle}</p>
          <div className="hero-meta"><span><Target size={16} /> {state.config.activeTribeIds.length} tribos participando</span><span><ShieldCheck size={16} /> {syncLabel}</span></div>
        </div>
      </section>

      <section className="public-content">
        {state.config.finalized && state.config.finalRanking.length ? <div className="final-banner"><Crown size={30} /><div><span>Rally finalizado</span><strong>Confira o ranking final</strong></div></div> : null}
        <div className="section-heading"><div><span className="eyebrow">Classificação geral</span><h2>Ranking das tribos</h2></div><span className="week-pill">SEMANA {state.config.currentWeek}</span></div>
        <div className="podium-grid">
          {podium.map((item, index) => {
            const tribe = tribeById(item.tribeId);
            return <article className={`podium-card place-${index + 1}`} key={item.tribeId}><span className="place-medal">{index === 0 ? <Trophy /> : <Medal />}</span><TribeLogo tribeId={item.tribeId} size={80} /><span className="place-label">{index + 1}º LUGAR</span><h3>{tribe?.name}</h3><strong>{item.points.toLocaleString('pt-BR')} <small>pts</small></strong></article>;
          })}
        </div>
        <div className="ranking-list">
          {totals.map((item, index) => <div className="ranking-row" key={item.tribeId}><span className="rank-position">{index + 1}</span><TribeLogo tribeId={item.tribeId} size={44} /><div className="rank-name"><strong>{tribeById(item.tribeId)?.name}</strong><small>{state.weeklyScores.filter((score) => score.tribeId === item.tribeId && score.submitted).length} semanas lançadas</small></div><strong className="rank-points">{item.points.toLocaleString('pt-BR')} pts</strong></div>)}
        </div>

        <div className="public-grid">
          <article className="mission-card"><span className="eyebrow">Missão atual</span><div className="mission-number">{state.config.currentWeek.toString().padStart(2, '0')}</div><h2>{mission?.title || `Semana ${state.config.currentWeek}`}</h2><p>{mission?.body || 'A missão desta semana será publicada pela administração.'}</p></article>
          <article className="announcement-card"><Megaphone size={24} /><span className="eyebrow">Último comunicado</span>{state.announcements[0] ? <><h3>{state.announcements[0].title}</h3><p>{state.announcements[0].body}</p></> : <><h3>Tudo pronto para o Rally</h3><p>Os comunicados oficiais aparecerão aqui assim que forem publicados.</p></>}</article>
        </div>
      </section>
    </main>
  );
}

function Dashboard({ state, totals, encounterYouth, algoYouth, returnedYouth, workerHighlight, youthHighlight }: { state: RallyState; totals: ReturnType<typeof scoreTotals>; encounterYouth: number; algoYouth: number; returnedYouth: number; workerHighlight?: Person; youthHighlight?: Person }) {
  const leader = totals[0];
  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">Visão operacional</span><h2>Dashboard do Rally</h2><p>Acompanhe os números da semana e quem está se destacando.</p></div><span className="status-badge"><span /> AO VIVO</span></div>
    <div className="metrics-grid">
      <MetricCard icon={Users} label="Jovens no Encontro" value={encounterYouth} helper={`Semana ${state.config.currentWeek}`} />
      <MetricCard icon={UserRoundCheck} label="Jovens no Algo a Mais" value={algoYouth} helper={`Semana ${state.config.currentWeek}`} />
      <MetricCard icon={RefreshCcw} label="Afastados que voltaram" value={returnedYouth} helper="Registrados nesta semana" />
      <MetricCard icon={Trophy} label="Tribo líder" value={leader ? tribeById(leader.tribeId)?.name ?? '-' : '-'} helper={leader ? `${leader.points.toLocaleString('pt-BR')} pontos` : 'Sem pontuação'} />
    </div>
    <div className="dashboard-grid">
      <article className="spotlight-card"><span className="eyebrow">Obreiro destaque</span><div className="spotlight-avatar">{workerHighlight?.name?.slice(0, 1) ?? '—'}</div><h3>{workerHighlight?.name ?? 'Ainda sem dados'}</h3><p>{workerHighlight ? `${workerHighlight.score} pontos de desempenho` : 'Cadastre e acompanhe os obreiros para gerar o destaque.'}</p></article>
      <article className="spotlight-card youth"><span className="eyebrow">Jovem destaque</span><div className="spotlight-avatar">{youthHighlight?.name?.slice(0, 1) ?? '—'}</div><h3>{youthHighlight?.name ?? 'Ainda sem dados'}</h3><p>{youthHighlight ? `${youthHighlight.score} pontos de desempenho` : 'O destaque aparece automaticamente pelo desempenho.'}</p></article>
      <article className="progress-card"><div className="progress-head"><div><span className="eyebrow">Progresso do evento</span><h3>Semana {state.config.currentWeek} de {state.config.totalWeeks}</h3></div><strong>{Math.round((state.config.currentWeek / state.config.totalWeeks) * 100)}%</strong></div><div className="progress-track"><span style={{ width: `${Math.min(100, (state.config.currentWeek / state.config.totalWeeks) * 100)}%` }} /></div><div className="week-dots">{Array.from({ length: state.config.totalWeeks }, (_, index) => <span key={index} className={index + 1 <= state.config.currentWeek ? 'done' : ''}>{index + 1}</span>)}</div></article>
    </div>
  </div>;
}

function RallySettings({ state, busy, onState, onSave, onNew, onRestart, onFinalize }: { state: RallyState; busy: boolean; onState: (state: RallyState) => void; onSave: (config: RallyConfig) => void; onNew: () => void; onRestart: () => void; onFinalize: () => void }) {
  const config = state.config;
  const patchConfig = (patch: Partial<RallyConfig>) => onState({ ...state, config: { ...config, ...patch } });
  const toggleTribe = (tribeId: string) => {
    const active = config.activeTribeIds.includes(tribeId);
    const next = active ? config.activeTribeIds.filter((id) => id !== tribeId) : [...config.activeTribeIds, tribeId];
    if (!next.length) return;
    patchConfig({ activeTribeIds: next });
  };
  return <div className="page-stack">
    <div className="page-heading"><div><span className="eyebrow">Evento reutilizável</span><h2>Configurar Rally</h2><p>Troque nome, identidade visual e tribos sem precisar criar outro site.</p></div><button className="button primary" disabled={busy} onClick={() => onSave(config)}><Save size={17} /> Salvar configuração</button></div>
    <section className="panel-card form-section"><div className="card-title"><div className="icon-tile"><Settings2 /></div><div><h3>Identidade do evento</h3><p>Essas informações aparecem automaticamente em toda a plataforma.</p></div></div><div className="form-grid two"><label><span>Título do Rally</span><input value={config.title} onChange={(e) => patchConfig({ title: e.target.value })} maxLength={64} /></label><label><span>Subtítulo</span><input value={config.subtitle} onChange={(e) => patchConfig({ subtitle: e.target.value })} maxLength={110} /></label><label><span>Total de semanas</span><select value={config.totalWeeks} onChange={(e) => { const totalWeeks = Number(e.target.value); patchConfig({ totalWeeks }); onState({ ...state, config: { ...config, totalWeeks }, missions: createDefaultMissions(totalWeeks).map((mission) => state.missions.find((old) => old.week === mission.week) ?? mission) }); }}>{[5,6,7,8,9,10,11,12].map((week) => <option key={week} value={week}>{week} semanas</option>)}</select></label><label><span>Semana atual</span><select value={config.currentWeek} onChange={(e) => patchConfig({ currentWeek: Number(e.target.value) })}>{Array.from({ length: config.totalWeeks }, (_, index) => <option key={index + 1} value={index + 1}>Semana {index + 1}</option>)}</select></label></div></section>
    <section className="panel-card form-section"><div className="card-title"><div className="icon-tile"><Sparkles /></div><div><h3>Cores do Rally</h3><p>O sistema visual inteiro acompanha suas escolhas.</p></div></div><div className="color-grid">{([['primary','Cor principal'],['secondary','Cor escura'],['accent','Cor de destaque']] as const).map(([key,label]) => <label className="color-control" key={key}><input type="color" value={config.theme[key]} onChange={(e) => patchConfig({ theme: { ...config.theme, [key]: e.target.value } })} /><span>{label}<strong>{config.theme[key]}</strong></span></label>)}</div></section>
    <section className="panel-card form-section"><div className="card-title"><div className="icon-tile"><UsersRound /></div><div><h3>Tribos participantes</h3><p>As 12 tribos ficam cadastradas. Marque somente as que vão participar desta edição.</p></div><span className="count-chip">{config.activeTribeIds.length}/12 selecionadas</span></div><div className="tribe-selector">{TRIBES.map((tribe) => { const selected = config.activeTribeIds.includes(tribe.id); return <button type="button" className={selected ? 'selected' : ''} key={tribe.id} onClick={() => toggleTribe(tribe.id)}><TribeLogo tribeId={tribe.id} size={58} /><span><strong>{tribe.name}</strong><small>{tribe.description}</small></span><span className="tribe-check">{selected ? <CheckCircle2 /> : null}</span></button>; })}</div></section>
    <section className="new-rally-card"><div><span className="eyebrow">Próxima edição</span><h3>Quer reutilizar o site para outro Rally?</h3><p>Configure acima o novo título, cores e tribos. Depois crie uma nova edição. O Rally atual será arquivado e os cadastros serão preservados.</p></div><button className="button light" onClick={onNew}><Plus size={18} /> Criar novo Rally</button></section>
    <section className="danger-zone"><div className="danger-title"><AlertTriangle /><div><span className="eyebrow">Zona de perigo</span><h3>Ações permanentes do evento atual</h3></div></div><div className="danger-actions"><div><strong>Reiniciar Rally</strong><p>Zera pontuações e frequências, mantendo os cadastros.</p><button className="button danger-outline" onClick={onRestart}><RotateCcw size={17} /> Reiniciar Rally</button></div><div><strong>Finalizar Rally</strong><p>Encerra o evento e salva o ranking final permanentemente.</p><button className="button danger" disabled={config.finalized} onClick={onFinalize}><Trophy size={17} /> {config.finalized ? 'Rally finalizado' : 'Finalizar Rally'}</button></div></div></section>
  </div>;
}

function Missions({ state, admin, busy, onSave, onFinalize }: { state: RallyState; admin: boolean; busy: boolean; onSave: (mission: WeekMission) => void; onFinalize: () => void }) {
  const [selectedWeek, setSelectedWeek] = useState(state.config.currentWeek);
  const [draft, setDraft] = useState<WeekMission>(() => state.missions.find((item) => item.week === selectedWeek) ?? { week: selectedWeek, title: '', body: '', finalized: false });
  useEffect(() => { setDraft(state.missions.find((item) => item.week === selectedWeek) ?? { week: selectedWeek, title: '', body: '', finalized: false }); }, [selectedWeek, state.missions]);
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">10 semanas organizadas</span><h2>Missões do Rally</h2><p>Cada semana mantém sua própria missão, histórico e status.</p></div>{admin && selectedWeek === state.config.currentWeek ? <button className="button primary" disabled={busy} onClick={onFinalize}><CheckCircle2 size={17} /> Finalizar semana</button> : null}</div><div className="mission-layout"><aside className="week-list">{Array.from({ length: state.config.totalWeeks }, (_, index) => index + 1).map((week) => { const mission = state.missions.find((item) => item.week === week); return <button key={week} className={week === selectedWeek ? 'active' : ''} onClick={() => setSelectedWeek(week)}><span>{String(week).padStart(2,'0')}</span><div><strong>Semana {week}</strong><small>{mission?.finalized ? 'Finalizada' : week === state.config.currentWeek ? 'Em andamento' : 'Programada'}</small></div>{mission?.finalized ? <CheckCircle2 size={16} /> : null}</button>; })}</aside><section className="panel-card mission-editor"><div className="mission-editor-head"><span className="week-big">{String(selectedWeek).padStart(2,'0')}</span><div><span className="eyebrow">Semana {selectedWeek}</span><h3>{draft.title || 'Missão sem título'}</h3></div></div>{admin ? <><label><span>Título da missão</span><input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Ex.: O Chamado dos Valentes" /></label><label><span>Missão, metas e pontuações</span><textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={14} placeholder="Escreva aqui toda a missão da semana..." /></label><button className="button primary" disabled={busy} onClick={() => onSave(draft)}><Save size={17} /> Salvar missão da semana</button></> : <div className="mission-reading"><p>{draft.body || 'A missão ainda não foi publicada.'}</p></div>}</section></div></div>;
}

function ScoreEntry({ state, profile, busy, timeWindow, systemLocked, submissionOpen, onSubmit }: { state: RallyState; profile: SessionProfile | null; busy: boolean; timeWindow: ReturnType<typeof getSubmissionWindowStatus>; systemLocked: boolean; submissionOpen: boolean; onSubmit: (tribeId: string, points: number, details: Record<string, unknown>) => void }) {
  const admin = profile?.role === 'admin' || profile?.role === 'local-admin';
  const available = admin ? state.config.activeTribeIds : state.config.activeTribeIds.filter((id) => id === profile?.tribeId);
  const [tribeId, setTribeId] = useState(available[0] ?? '');
  const [points, setPoints] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => { if (!available.includes(tribeId)) setTribeId(available[0] ?? ''); }, [available, tribeId]);
  const canSubmit = Boolean(tribeId) && !systemLocked && (admin || submissionOpen) && !state.config.finalized;
  const existing = state.weeklyScores.find((item) => item.tribeId === tribeId && item.week === state.config.currentWeek);
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Função do líder de tribo</span><h2>Lançamento de Pontuação Semanal</h2><p>Preencha, confira e envie a pontuação da semana. O ranking atualiza automaticamente.</p></div></div><div className={`window-banner ${systemLocked ? 'locked' : submissionOpen ? 'open' : ''}`}><div className="window-icon"><Clock3 /></div><div><strong>{systemLocked ? 'Sistema bloqueado' : timeWindow.label}</strong><p>{systemLocked ? 'O bloqueio automático protege os dados entre domingo 19h e segunda 7h.' : timeWindow.detail}</p></div><span className="countdown">{formatRemaining(timeWindow.remainingMs)}</span></div><div className="score-layout"><section className="panel-card score-form"><label><span>Tribo</span><select value={tribeId} disabled={!admin} onChange={(e) => setTribeId(e.target.value)}>{available.map((id) => <option key={id} value={id}>{tribeById(id)?.name}</option>)}</select></label>{tribeId ? <div className="selected-tribe"><TribeLogo tribeId={tribeId} size={70} /><div><span>Semana {state.config.currentWeek}</span><strong>{tribeById(tribeId)?.name}</strong><small>{existing?.submitted ? `Já enviado: ${existing.points} pontos` : 'Aguardando lançamento'}</small></div></div> : null}<label><span>Pontuação total calculada</span><div className="points-input"><input type="number" min="0" value={points} onChange={(e) => setPoints(e.target.value)} placeholder="0" /><span>PTS</span></div></label><label><span>Observações / composição da pontuação</span><textarea rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: presença, convidados, missões cumpridas..." /></label><button className="button primary full" disabled={!canSubmit || busy || !points} onClick={() => onSubmit(tribeId, Math.max(0, Number(points)), { notes })}><Save size={18} /> Salvar e Enviar Pontuação da Semana</button>{!canSubmit ? <p className="form-warning"><AlertTriangle size={15} /> O envio está indisponível neste momento.</p> : null}</section><aside className="score-side"><article className="panel-card compact"><span className="eyebrow">Regra automática</span><h3>Domingo, 16h → 19h</h3><p>Às 19h o Firebase fecha a rodada. Tribos sem lançamento recebem zero automaticamente e o sistema fica bloqueado até segunda, 7h.</p></article>{tribeId ? <HistoryChart scores={state.weeklyScores} tribeId={tribeId} totalWeeks={state.config.totalWeeks} /> : null}</aside></div></div>;
}

function HistoryPanel({ state, profile }: { state: RallyState; profile: SessionProfile | null }) {
  const [tribeId, setTribeId] = useState(profile?.role === 'leader' ? profile.tribeId ?? '' : state.config.activeTribeIds[0] ?? '');
  const visible = profile?.role === 'leader' ? state.config.activeTribeIds.filter((id) => id === profile.tribeId) : state.config.activeTribeIds;
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Evolução do desempenho</span><h2>Histórico de Pontuação</h2><p>Veja como a pontuação evolui ao longo das semanas.</p></div><select className="top-select" value={tribeId} onChange={(e) => setTribeId(e.target.value)}>{visible.map((id) => <option key={id} value={id}>{tribeById(id)?.name}</option>)}</select></div>{tribeId ? <HistoryChart scores={state.weeklyScores} tribeId={tribeId} totalWeeks={state.config.totalWeeks} /> : null}<div className="panel-card"><div className="table-wrap"><table><thead><tr><th>Semana</th><th>Status</th><th>Pontuação</th></tr></thead><tbody>{Array.from({ length: state.config.totalWeeks }, (_, index) => { const item = state.weeklyScores.find((score) => score.tribeId === tribeId && score.week === index + 1); return <tr key={index}><td>Semana {index + 1}</td><td><span className={`table-status ${item?.submitted ? 'ok' : ''}`}>{item?.submitted ? 'Enviado' : 'Pendente'}</span></td><td><strong>{item?.points ?? 0} pts</strong></td></tr>; })}</tbody></table></div></div></div>;
}

function PeoplePanel({ state, kind, busy, onRefresh, runAction }: { state: RallyState; kind: PersonKind; busy: boolean; onRefresh: () => Promise<void>; runAction: (action: () => Promise<void>, success: string) => Promise<void> }) {
  const [name, setName] = useState(''); const [church, setChurch] = useState(''); const [whatsapp, setWhatsapp] = useState(''); const [tribeId, setTribeId] = useState(state.config.activeTribeIds[0] ?? '');
  const people = state.people.filter((person) => person.kind === kind).sort((a,b) => a.name.localeCompare(b.name));
  const title = kind === 'worker' ? 'Obreiros' : 'Jovens';
  const addPerson = async () => { if (!name.trim()) return; const person: Person = { id: makeId(kind), kind, name: name.trim(), church: church.trim() || 'Não informado', whatsapp: whatsapp.trim(), tribeId, status: 'active', score: 0 }; await runAction(() => savePerson(person), `${kind === 'worker' ? 'Obreiro' : 'Jovem'} cadastrado.`); setName(''); setWhatsapp(''); await onRefresh(); };
  const register = async (person: Person, meeting: Attendance['meeting'], present: boolean, returned = false) => { const entry: Attendance = { id: `${state.config.currentWeek}-${meeting}-${person.id}`, personId: person.id, week: state.config.currentWeek, meeting, present, guests: 0, returned }; await runAction(() => saveAttendance(entry), 'Frequência atualizada.'); await onRefresh(); };
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Gestão de pessoas</span><h2>{title}</h2><p>Cadastros, igreja, tribo, contato e frequência semanal em um só lugar.</p></div><span className="count-chip">{people.length} cadastrados</span></div><section className="panel-card quick-add"><div className="form-grid four"><label><span>Nome completo</span><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" /></label><label><span>Igreja / localidade</span><input value={church} onChange={(e) => setChurch(e.target.value)} placeholder="Ex.: Fonseca" /></label><label><span>WhatsApp</span><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="(21) 99999-9999" /></label><label><span>Tribo</span><select value={tribeId} onChange={(e) => setTribeId(e.target.value)}>{state.config.activeTribeIds.map((id) => <option value={id} key={id}>{tribeById(id)?.name}</option>)}</select></label></div><button className="button primary" disabled={busy || !name.trim()} onClick={addPerson}><Plus size={17} /> Adicionar {kind === 'worker' ? 'obreiro' : 'jovem'}</button></section><section className="panel-card"><div className="table-wrap"><table><thead><tr><th>Nome</th><th>Igreja</th><th>Tribo</th><th>Encontro</th><th>Algo a Mais</th>{kind === 'youth' ? <th>Retornou</th> : null}<th>Ações</th></tr></thead><tbody>{people.length ? people.map((person) => { const encontro = state.attendance.find((item) => item.personId === person.id && item.week === state.config.currentWeek && item.meeting === 'encontro'); const algo = state.attendance.find((item) => item.personId === person.id && item.week === state.config.currentWeek && item.meeting === 'algo_mais'); return <tr key={person.id}><td><strong>{person.name}</strong><small>{person.whatsapp || 'Sem WhatsApp'}</small></td><td>{person.church}</td><td><span className="tribe-inline"><TribeLogo tribeId={person.tribeId ?? ''} size={28} />{tribeById(person.tribeId ?? '')?.name ?? '—'}</span></td><td><PresenceButtons value={encontro?.present} onSelect={(value) => register(person, 'encontro', value, encontro?.returned)} /></td><td><PresenceButtons value={algo?.present} onSelect={(value) => register(person, 'algo_mais', value)} /></td>{kind === 'youth' ? <td><button className={`mini-toggle ${encontro?.returned ? 'on' : ''}`} onClick={() => register(person, 'encontro', encontro?.present ?? true, !encontro?.returned)}>{encontro?.returned ? 'Sim' : 'Não'}</button></td> : null}<td><div className="row-actions">{person.whatsapp ? <a className="icon-button" href={`https://wa.me/${person.whatsapp.replace(/\D/g,'')}`} target="_blank" rel="noreferrer" title="WhatsApp"><Megaphone size={17} /></a> : null}<button className="icon-button danger-text" onClick={() => runAction(() => removePerson(person.id), 'Cadastro removido.').then(onRefresh)} title="Excluir"><X size={17} /></button></div></td></tr>; }) : <tr><td colSpan={kind === 'youth' ? 7 : 6}><div className="empty-state"><UsersRound /><strong>Nenhum cadastro ainda</strong><span>Use o formulário acima para começar.</span></div></td></tr>}</tbody></table></div></section></div>;
}

function PresenceButtons({ value, onSelect }: { value?: boolean; onSelect: (value: boolean) => void }) { return <div className="presence-buttons"><button className={value === true ? 'yes active' : 'yes'} onClick={() => onSelect(true)}>P</button><button className={value === false ? 'no active' : 'no'} onClick={() => onSelect(false)}>F</button></div>; }

function Reports({ state }: { state: RallyState }) {
  const churches = Array.from(new Set(state.people.map((person) => person.church).filter(Boolean))).sort();
  const youth = state.people.filter((person) => person.kind === 'youth');
  const current = state.attendance.filter((item) => item.week === state.config.currentWeek);
  const summaryFor = (church?: string) => { const ids = new Set(youth.filter((person) => !church || person.church === church).map((person) => person.id)); const encontro = current.filter((item) => ids.has(item.personId) && item.meeting === 'encontro' && item.present).length; const algo = current.filter((item) => ids.has(item.personId) && item.meeting === 'algo_mais' && item.present).length; const afastados = current.filter((item) => ids.has(item.personId) && item.returned).length; return { encontro, algo, afastados, total: ids.size }; };
  const share = (church?: string) => { const data = summaryFor(church); const text = `*RELATÓRIO FJU – ${state.config.title}*\n*Semana ${state.config.currentWeek}*${church ? `\n*Igreja:* ${church}` : ''}\n\nJovens cadastrados: ${data.total}\nEncontro Jovem: ${data.encontro}\nAlgo a Mais: ${data.algo}\nAfastados que retornaram: ${data.afastados}`; window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank'); };
  const overall = summaryFor();
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Relatórios completos</span><h2>Resultados do Encontro Jovem</h2><p>Visão total, por igreja e pronta para compartilhar pelo WhatsApp.</p></div><button className="button whatsapp" onClick={() => share()}><Megaphone size={17} /> Compartilhar geral</button></div><div className="metrics-grid"><MetricCard icon={UsersRound} label="Jovens cadastrados" value={overall.total} /><MetricCard icon={UserRoundCheck} label="Encontro Jovem" value={overall.encontro} /><MetricCard icon={Sparkles} label="Algo a Mais" value={overall.algo} /><MetricCard icon={RefreshCcw} label="Retornaram" value={overall.afastados} /></div><section className="panel-card"><div className="card-title"><div><span className="eyebrow">Relatório por localidade</span><h3>Igrejas participantes</h3></div></div><div className="church-grid">{churches.length ? churches.map((church) => { const data = summaryFor(church); return <article key={church}><div><strong>{church}</strong><small>{data.total} jovens cadastrados</small></div><div className="church-numbers"><span><b>{data.encontro}</b> EJ</span><span><b>{data.algo}</b> A+</span><span><b>{data.afastados}</b> retornos</span></div><button className="button secondary small" onClick={() => share(church)}>Enviar WhatsApp</button></article>; }) : <div className="empty-state"><Users /><strong>Nenhuma igreja cadastrada</strong><span>Os relatórios serão separados automaticamente conforme os cadastros.</span></div>}</div></section><section className="panel-card"><div className="card-title"><div><span className="eyebrow">Individual</span><h3>Desempenho por jovem</h3></div></div><div className="table-wrap"><table><thead><tr><th>Jovem</th><th>Igreja</th><th>EJ</th><th>Algo a Mais</th><th>Retorno</th></tr></thead><tbody>{youth.map((person) => { const entries = current.filter((item) => item.personId === person.id); return <tr key={person.id}><td><strong>{person.name}</strong></td><td>{person.church}</td><td>{entries.find((item) => item.meeting === 'encontro')?.present ? 'Presente' : '—'}</td><td>{entries.find((item) => item.meeting === 'algo_mais')?.present ? 'Presente' : '—'}</td><td>{entries.some((item) => item.returned) ? 'Sim' : '—'}</td></tr>; })}</tbody></table></div></section></div>;
}

function Announcements({ state, busy, onPublish }: { state: RallyState; busy: boolean; onPublish: (title: string, body: string) => void }) {
  const [title, setTitle] = useState(''); const [body, setBody] = useState('');
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">Comunicação</span><h2>Comunicados do Rally</h2><p>Publique avisos que aparecem imediatamente na página pública.</p></div></div><section className="panel-card announcement-form"><label><span>Título do comunicado</span><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Atenção para a missão de domingo" /></label><label><span>Mensagem</span><textarea rows={7} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Escreva o comunicado..." /></label><button className="button primary" disabled={busy || !title.trim() || !body.trim()} onClick={() => { onPublish(title.trim(), body.trim()); setTitle(''); setBody(''); }}><Bell size={17} /> Publicar comunicado</button><p className="form-hint">Push notification poderá usar esta mesma base quando o Firebase Cloud Messaging for habilitado.</p></section><section className="panel-card"><div className="card-title"><div><span className="eyebrow">Histórico</span><h3>Últimos comunicados</h3></div></div><div className="announcement-list">{state.announcements.length ? state.announcements.map((item) => <article key={item.id}><span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span><h4>{item.title}</h4><p>{item.body}</p></article>) : <div className="empty-state"><Bell /><strong>Nenhum comunicado</strong><span>As mensagens publicadas aparecerão aqui.</span></div>}</div></section></div>;
}

function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await signIn(email, password); onSuccess(); } catch { setError('Não foi possível entrar. Confira o e-mail e a senha.'); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="login-modal" onMouseDown={(e) => e.stopPropagation()}><button className="icon-button modal-close" onClick={onClose}><X /></button><div className="login-brand"><span>R</span></div><span className="eyebrow">Área administrativa</span><h2>Entre no Rally</h2><p>Administradores e líderes usam o mesmo acesso. As permissões são aplicadas pelo Firebase.</p><form onSubmit={submit}><label><span>E-mail</span><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label><label><span>Senha</span><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>{error ? <div className="login-error">{error}</div> : null}<button className="button primary full" disabled={busy}>{busy ? 'Entrando...' : 'Entrar no painel'}</button></form></div></div>;
}

export default App;
