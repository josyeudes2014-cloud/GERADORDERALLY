import { TRIBES } from '../data/tribes';

export type RallyTheme = { primary: string; secondary: string; accent: string };
export type FinalRankingItem = { tribeId: string; points: number; position: number };

export type RallyConfig = {
  id: string;
  title: string;
  subtitle: string;
  theme: RallyTheme;
  activeTribeIds: string[];
  currentWeek: number;
  totalWeeks: number;
  finalized: boolean;
  finalRanking: FinalRankingItem[];
  finalizedAt?: string;
};

export type WeekMission = { week: number; title: string; body: string; finalized: boolean };
export type PersonKind = 'worker' | 'youth';
export type Person = {
  id: string;
  kind: PersonKind;
  name: string;
  church: string;
  whatsapp: string;
  tribeId?: string;
  status: 'active' | 'away';
  score: number;
};
export type Attendance = {
  id: string;
  personId: string;
  week: number;
  meeting: 'encontro' | 'algo_mais';
  present: boolean;
  guests: number;
  returned: boolean;
};
export type WeeklyScore = {
  tribeId: string;
  week: number;
  points: number;
  submitted: boolean;
  submittedAt?: string;
  details?: Record<string, unknown>;
};
export type RallyControl = {
  submissionOpen: boolean;
  systemLocked: boolean;
  lockedUntil?: string;
  lastClosedWeek?: number;
};
export type Announcement = { id: string; title: string; body: string; createdAt: string };

export type RallyState = {
  config: RallyConfig;
  missions: WeekMission[];
  people: Person[];
  attendance: Attendance[];
  weeklyScores: WeeklyScore[];
  control: RallyControl;
  announcements: Announcement[];
};

export const createDefaultMissions = (totalWeeks = 10): WeekMission[] =>
  Array.from({ length: totalWeeks }, (_, index) => ({
    week: index + 1,
    title: `Missão da Semana ${index + 1}`,
    body: '',
    finalized: false,
  }));

export const defaultState: RallyState = {
  config: {
    id: 'rally-atual',
    title: 'RALLY FJU',
    subtitle: 'Só os valentes fazem a diferença!',
    theme: { primary: '#103d8f', secondary: '#071d46', accent: '#f4b400' },
    activeTribeIds: TRIBES.map((tribe) => tribe.id),
    currentWeek: 1,
    totalWeeks: 10,
    finalized: false,
    finalRanking: [],
  },
  missions: createDefaultMissions(10),
  people: [],
  attendance: [],
  weeklyScores: [],
  control: { submissionOpen: false, systemLocked: false },
  announcements: [],
};

const STORAGE_KEY = 'rally-fju-platform:v2';

export function loadLocalState(): RallyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw) as Partial<RallyState>;
    return {
      ...structuredClone(defaultState),
      ...parsed,
      config: { ...structuredClone(defaultState.config), ...(parsed.config ?? {}) },
      control: { ...structuredClone(defaultState.control), ...(parsed.control ?? {}) },
    };
  } catch {
    return structuredClone(defaultState);
  }
}

export function saveLocalState(state: RallyState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetLocalState() {
  localStorage.removeItem(STORAGE_KEY);
}

export function scoreTotals(state: RallyState) {
  return state.config.activeTribeIds
    .map((tribeId) => ({
      tribeId,
      points: state.weeklyScores.filter((item) => item.tribeId === tribeId).reduce((sum, item) => sum + item.points, 0),
    }))
    .sort((a, b) => b.points - a.points);
}

export function buildFinalRanking(state: RallyState): FinalRankingItem[] {
  return scoreTotals(state).map((item, index) => ({ ...item, position: index + 1 }));
}
