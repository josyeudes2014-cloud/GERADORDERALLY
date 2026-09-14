import { Crown, LogIn, Medal, Megaphone, ShieldCheck, Sparkles, Target, Trophy } from 'lucide-react';
import TribeLogo from '../components/TribeLogo';
import { tribeById } from '../data/tribes';
import { scoreTotals, type RallyState, type WeekMission } from '../lib/rally';

type Props = {
  state: RallyState;
  totals: ReturnType<typeof scoreTotals>;
  mission?: WeekMission;
  syncLabel: string;
  onLogin: () => void;
};

export default function PublicHome({ state, totals, mission, syncLabel, onLogin }: Props) {
  const podium = totals.slice(0, 3);
  const weekLabel = state.config.finalized ? 'Evento finalizado' : `Semana ${state.config.currentWeek} em andamento`;

  return (
    <main className="public-page">
      <section className="hero">
        <div className="hero-noise" />
        <header className="public-header">
          <div className="brand-mark light"><span>R</span><div><strong>RALLY FJU</strong><small>Plataforma oficial</small></div></div>
          <button className="button ghost" onClick={onLogin}><LogIn size={17} /> Entrar</button>
        </header>
        <div className="hero-copy">
          <span className="hero-badge"><Sparkles size={14} /> {weekLabel}</span>
          <h1>{state.config.title}</h1>
          <p>{state.config.subtitle}</p>
          <div className="hero-meta">
            <span><Target size={16} /> {state.config.activeTribeIds.length} tribos participando</span>
            <span><ShieldCheck size={16} /> {syncLabel}</span>
          </div>
        </div>
      </section>

      <section className="public-content">
        {state.config.finalized && state.config.finalRanking.length ? (
          <div className="final-banner"><Crown size={30} /><div><span>Rally finalizado</span><strong>Confira o ranking final</strong></div></div>
        ) : null}

        <div className="section-heading">
          <div><span className="eyebrow">Classificação geral</span><h2>Ranking das tribos</h2></div>
          <span className="week-pill">SEMANA {state.config.currentWeek}</span>
        </div>

        <div className="podium-grid">
          {podium.map((item, index) => {
            const tribe = tribeById(item.tribeId);
            return (
              <article className={`podium-card place-${index + 1}`} key={item.tribeId}>
                <span className="place-medal">{index === 0 ? <Trophy /> : <Medal />}</span>
                <TribeLogo tribeId={item.tribeId} size={80} />
                <span className="place-label">{index + 1}º LUGAR</span>
                <h3>{tribe?.name}</h3>
                <strong>{item.points.toLocaleString('pt-BR')} <small>pts</small></strong>
              </article>
            );
          })}
        </div>

        <div className="ranking-list">
          {totals.map((item, index) => (
            <div className="ranking-row" key={item.tribeId}>
              <span className="rank-position">{index + 1}</span>
              <TribeLogo tribeId={item.tribeId} size={44} />
              <div className="rank-name">
                <strong>{tribeById(item.tribeId)?.name}</strong>
                <small>{state.weeklyScores.filter((score) => score.tribeId === item.tribeId && score.submitted).length} semanas lançadas</small>
              </div>
              <strong className="rank-points">{item.points.toLocaleString('pt-BR')} pts</strong>
            </div>
          ))}
        </div>

        <div className="public-grid">
          <article className="mission-card">
            <span className="eyebrow">Missão atual</span>
            <div className="mission-number">{state.config.currentWeek.toString().padStart(2, '0')}</div>
            <h2>{mission?.title || `Semana ${state.config.currentWeek}`}</h2>
            <p>{mission?.body || 'A missão desta semana será publicada pela administração.'}</p>
          </article>
          <article className="announcement-card">
            <Megaphone size={24} /><span className="eyebrow">Último comunicado</span>
            {state.announcements[0] ? <><h3>{state.announcements[0].title}</h3><p>{state.announcements[0].body}</p></> : <><h3>Tudo pronto para o Rally</h3><p>Os comunicados oficiais aparecerão aqui assim que forem publicados.</p></>}
          </article>
        </div>
      </section>
    </main>
  );
}
