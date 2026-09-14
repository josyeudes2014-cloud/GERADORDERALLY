export type SubmissionWindow = {
  state: 'open' | 'locked' | 'pre-open';
  label: string;
  detail: string;
  remainingMs: number;
};

const SAO_PAULO_OFFSET_HOURS = -3;

function saoPauloParts(now = new Date()) {
  const shifted = new Date(now.getTime() + SAO_PAULO_OFFSET_HOURS * 60 * 60 * 1000);
  return { day: shifted.getUTCDay(), hour: shifted.getUTCHours(), minute: shifted.getUTCMinutes(), second: shifted.getUTCSeconds(), shifted };
}

function untilNextSundayAt(hour: number, now: Date) {
  const { shifted } = saoPauloParts(now);
  const target = new Date(shifted);
  const days = (7 - shifted.getUTCDay()) % 7;
  target.setUTCDate(shifted.getUTCDate() + days);
  target.setUTCHours(hour, 0, 0, 0);
  if (target <= shifted) target.setUTCDate(target.getUTCDate() + 7);
  return target.getTime() - shifted.getTime();
}

export function getSubmissionWindowStatus(now = new Date()): SubmissionWindow {
  const { day, hour, minute, second, shifted } = saoPauloParts(now);
  const currentMs = ((hour * 60 + minute) * 60 + second) * 1000;
  const openMs = 16 * 60 * 60 * 1000;
  const closeMs = 19 * 60 * 60 * 1000;

  if (day === 0 && currentMs >= openMs && currentMs < closeMs) {
    return { state: 'open', label: 'Lançamento aberto', detail: 'A janela semanal fecha hoje às 19h.', remainingMs: closeMs - currentMs };
  }
  if (day === 0 && currentMs < openMs) {
    return { state: 'pre-open', label: 'Abre hoje às 16h', detail: 'Os líderes poderão enviar a pontuação semanal a partir das 16h.', remainingMs: openMs - currentMs };
  }
  if (day === 0 && currentMs >= closeMs) {
    const monday7 = new Date(shifted);
    monday7.setUTCDate(monday7.getUTCDate() + 1);
    monday7.setUTCHours(7, 0, 0, 0);
    return { state: 'locked', label: 'Sistema fechado', detail: 'A rodada fechou às 19h e permanece bloqueada até segunda-feira às 7h.', remainingMs: monday7.getTime() - shifted.getTime() };
  }
  if (day === 1 && currentMs < 7 * 60 * 60 * 1000) {
    return { state: 'locked', label: 'Sistema fechado', detail: 'A rodada permanece bloqueada até hoje às 7h.', remainingMs: 7 * 60 * 60 * 1000 - currentMs };
  }
  return { state: 'locked', label: 'Aguardando próxima rodada', detail: 'O lançamento dos líderes abre aos domingos, das 16h às 19h.', remainingMs: untilNextSundayAt(16, now) };
}

export function isSystemLockWindow(now = new Date()) {
  const { day, hour, minute, second } = saoPauloParts(now);
  const currentMs = ((hour * 60 + minute) * 60 + second) * 1000;
  const closeMs = 19 * 60 * 60 * 1000;
  const mondayUnlockMs = 7 * 60 * 60 * 1000;
  return (day === 0 && currentMs >= closeMs) || (day === 1 && currentMs < mondayUnlockMs);
}

export function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
