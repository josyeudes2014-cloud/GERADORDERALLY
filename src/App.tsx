import { useEffect, useMemo, useState } from 'react';
import { Bell, CalendarCheck, CheckCircle2, ChevronRight, Gauge, History, LayoutDashboard, LogOut, Menu, Settings2, ShieldCheck, Target, Trophy, UsersRound } from 'lucide-react';
import ConfirmDialog from './components/ConfirmDialog';
import { buildFinalRanking, loadLocalState, saveLocalState, scoreTotals, type Person, type RallyConfig, type RallyState } from './lib/rally';
import { createNewRally, finalizeRally, finalizeWeek, getSessionProfile, loadRemoteState, publishAnnouncement, restartRally, saveConfig, saveMission, seedRemoteState, signOut, submitWeeklyScore, subscribeAuth, subscribeRemoteState, type SessionProfile } from './lib/remote';
import { getSubmissionWindowStatus, isSystemLockWindow } from './lib/time';
import Announcements from './views/Announcements';
import Dashboard from './views/Dashboard';
import HistoryPanel from './views/HistoryPanel';
import LoginModal from './views/LoginModal';
import Missions from './views/Missions';
import PeoplePanel from './views/PeoplePanel';
import PublicHome from './views/PublicHome';
import RallySettings from './views/RallySettings';
import Reports from './views/Reports';
import ScoreEntry from './views/ScoreEntry';

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

  const isAdmin = profile?.role === 'admin';
  const isLeader = profile?.role === 'leader';
  const isBackoffice = isAdmin || isLeader;
  const updateState = (next: RallyState) => { setState(next); saveLocalState(next); };

  useEffect(() => { const interval = window.setInterval(() => setTick(Date.now()), 1000); return () => window.clearInterval(interval); }, []);
  useEffect(() => {
    // O preview deve continuar utilizável mesmo quando o Firebase/Auth estiver lento ou indisponível.
    // A sincronização continua em segundo plano e assume o controle assim que responder.
    const timeout = window.setTimeout(() => {
      setAuthReady((ready) => {
        if (!ready) setSyncLabel('Modo local — sincronização pendente');
        return true;
      });
    }, 5000);
    return () => window.clearTimeout(timeout);
  }, []);
  useEffect(() => {
    let remoteUnsub: (() => void) | undefined;
    const authUnsub = subscribeAuth(async (user) => {
      try {
        const session = await getSessionProfile(user);
        setProfile(session);
        if (session?.role === 'leader') setTab('scores');
        if (session?.role === 'admin') await seedRemoteState(state);
        if (session) { const remote = await loadRemoteState(); if (remote) updateState(remote); }
      } catch (error) { console.error(error); } finally { setAuthReady(true); }
    });
    remoteUnsub = subscribeRemoteState((next) => { updateState(next); setSyncLabel('Sincronizado com Firebase'); }, () => setSyncLabel('Firebase conectado — acesso parcial'));
    loadRemoteState().then((remote) => { if (remote) { updateState(remote); setSyncLabel('Sincronizado com Firebase'); } else setSyncLabel('Firebase pronto — aguardando configuração inicial'); }).catch(() => setSyncLabel('Firebase conectado — aguardando autenticação'));
    return () => { authUnsub(); remoteUnsub?.(); };
    // estado inicial é usado somente para semear uma instalação vazia
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--primary', state.config.theme.primary);
    document.documentElement.style.setProperty('--secondary', state.config.theme.secondary);
    document.documentElement.style.setProperty('--accent', state.config.theme.accent);
    document.title = state.config.title;
  }, [state.config]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(null), 3600); return () => window.clearTimeout(timer); }, [toast]);

  const totals = useMemo(() => scoreTotals(state), [state]);
  const currentMission = state.missions.find((item) => item.week === state.config.currentWeek) ?? state.missions[0];
  const now = new Date(tick);
  const timeWindow = getSubmissionWindowStatus(now);
  const effectiveControl = { systemLocked: state.control.systemLocked || isSystemLockWindow(now), submissionOpen: state.control.submissionOpen || timeWindow.state === 'open' };
  const currentAttendance = state.attendance.filter((item) => item.week === state.config.currentWeek);
  const youthIds = new Set(state.people.filter((person) => person.kind === 'youth').map((person) => person.id));
  const encounterYouth = currentAttendance.filter((item) => item.meeting === 'encontro' && item.present && youthIds.has(item.personId)).length;
  const algoYouth = currentAttendance.filter((item) => item.meeting === 'algo_mais' && item.present && youthIds.has(item.personId)).length;
  const returnedYouth = currentAttendance.filter((item) => item.returned && youthIds.has(item.personId)).length;
  const personPerformance = (person: Person) => {
    const entries = state.attendance.filter((item) => item.personId === person.id);
    const presencePoints = entries.reduce((sum, item) => sum + (item.present ? (item.meeting === 'encontro' ? 2 : 1) : 0), 0);
    const guestPoints = person.kind === 'worker' ? entries.reduce((sum, item) => sum + (item.guests || 0), 0) : 0;
    const returnPoints = person.kind === 'youth' ? entries.filter((item) => item.returned).length * 2 : 0;
    return person.score + presencePoints + guestPoints + returnPoints;
  };
  const workerHighlight = state.people.filter((person) => person.kind === 'worker').map((person) => ({ ...person, score: personPerformance(person) })).sort((a, b) => b.score - a.score)[0];
  const youthHighlight = state.people.filter((person) => person.kind === 'youth').map((person) => ({ ...person, score: personPerformance(person) })).sort((a, b) => b.score - a.score)[0];

  const runAction = async (action: () => Promise<void>, success: string) => {
    setBusy(true);
    try { await action(); const remote = await loadRemoteState(); if (remote) updateState(remote); setToast(success); }
    catch (error) { console.error(error); setToast(error instanceof Error ? error.message : 'Não foi possível concluir a ação.'); }
    finally { setBusy(false); }
  };

  const handleDialogConfirm = async () => {
    const kind = dialog; setDialog(null);
    if (kind === 'restart') await runAction(() => restartRally(state.config), 'Pontuações zeradas. Cadastros preservados.');
    if (kind === 'finalize') await runAction(() => finalizeRally(buildFinalRanking(state)), 'Rally finalizado e ranking final salvo.');
    if (kind === 'new-rally') { const nextConfig: RallyConfig = { ...state.config, id: `rally-${Date.now()}`, currentWeek: 1, finalized: false, finalRanking: [] }; await runAction(() => createNewRally(state, nextConfig), 'Novo Rally criado. O evento anterior foi arquivado.'); }
  };

  return <div className="app-shell">
    {isBackoffice ? <>
      <aside className={`sidebar ${mobileNav ? 'open' : ''}`}>
        <div className="brand-mark"><span>R</span><div><strong>RALLY FJU</strong><small>Central de gestão</small></div></div>
        <nav>{navItems.filter((item) => !item.adminOnly || isAdmin).map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setMobileNav(false); }}><Icon size={18} /><span>{label}</span><ChevronRight size={15} className="nav-arrow" /></button>)}</nav>
        <div className="sidebar-footer"><span className="role-chip">{isAdmin ? 'ADMINISTRADOR' : 'LÍDER DE TRIBO'}</span><small>{profile?.email}</small><button onClick={() => signOut()}><LogOut size={17} /> Sair</button></div>
      </aside>
      {mobileNav ? <button className="nav-scrim" aria-label="Fechar menu" onClick={() => setMobileNav(false)} /> : null}
      <main className="admin-main">
        <div className="admin-topbar"><button className="icon-button mobile-menu" onClick={() => setMobileNav(true)} aria-label="Abrir menu"><Menu /></button><div><span className="eyebrow">Semana {state.config.currentWeek} de {state.config.totalWeeks}</span><h1>{state.config.title}</h1></div><div className="sync-pill"><span className="sync-dot" />{syncLabel}</div></div>
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
    </> : <PublicHome state={state} totals={totals} mission={currentMission} syncLabel={syncLabel} onLogin={() => setLoginOpen(true)} />}

    {loginOpen ? <LoginModal onClose={() => setLoginOpen(false)} onSuccess={() => setLoginOpen(false)} /> : null}
    <ConfirmDialog open={dialog !== null} title={dialog === 'restart' ? 'Reiniciar Rally?' : dialog === 'finalize' ? 'Finalizar Rally?' : 'Criar um novo Rally?'} description={dialog === 'restart' ? 'Todas as pontuações e frequências serão zeradas, mas os cadastros de obreiros e jovens serão mantidos.' : dialog === 'finalize' ? 'O ranking atual será salvo como resultado final. Esta ação encerra o evento atual.' : 'O Rally atual será arquivado e uma nova edição será criada usando o título, cores e tribos que estão configurados agora. Os cadastros serão preservados.'} confirmLabel={dialog === 'restart' ? 'Sim, reiniciar' : dialog === 'finalize' ? 'Finalizar evento' : 'Criar novo Rally'} danger={dialog === 'restart' || dialog === 'finalize'} onCancel={() => setDialog(null)} onConfirm={handleDialogConfirm} />
    {toast ? <div className="toast"><CheckCircle2 size={18} />{toast}</div> : null}
    {busy ? <div className="busy-bar" /> : null}
    {!authReady ? <div className="boot-screen"><div className="loader" /><span>Preparando o Rally...</span></div> : null}
  </div>;
}

export default App;
