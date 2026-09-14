import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut as firebaseSignOut, type User } from 'firebase/auth';
import { auth, db } from '../integrations/firebase/client';
import { createDefaultMissions, defaultState, type Announcement, type Attendance, type Person, type RallyConfig, type RallyControl, type RallyState, type WeekMission, type WeeklyScore } from './rally';

export type UserRole = 'admin' | 'leader' | 'viewer' | 'local-admin';
export type SessionProfile = { id: string; role: UserRole; tribeId: string | null; church: string | null; email: string | null };

const rallyRef = doc(db, 'rallies', 'current');
const missionsRef = collection(db, 'rallies', 'current', 'missions');
const peopleRef = collection(db, 'rallies', 'current', 'people');
const attendanceRef = collection(db, 'rallies', 'current', 'attendance');
const scoresRef = collection(db, 'rallies', 'current', 'weeklyScores');
const announcementsRef = collection(db, 'rallies', 'current', 'announcements');
const controlRef = doc(db, 'system', 'rally-control');

const asIso = (value: unknown) => {
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'toDate' in value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
};

export async function loadRemoteState(): Promise<RallyState | null> {
  const [rallySnap, missionsSnap, peopleSnap, attendanceSnap, scoresSnap, controlSnap, announcementsSnap] = await Promise.all([
    getDoc(rallyRef),
    getDocs(missionsRef),
    auth.currentUser ? getDocs(peopleRef).catch(() => null) : Promise.resolve(null),
    auth.currentUser ? getDocs(attendanceRef).catch(() => null) : Promise.resolve(null),
    getDocs(scoresRef),
    getDoc(controlRef),
    getDocs(announcementsRef),
  ]);

  if (!rallySnap.exists()) return null;
  const rallyData = rallySnap.data() as RallyConfig & { finalizedAt?: unknown };
  const config: RallyConfig = {
    ...defaultState.config,
    ...rallyData,
    finalizedAt: asIso(rallyData.finalizedAt),
    finalRanking: rallyData.finalRanking ?? [],
  };

  const missions = missionsSnap.docs.map((item) => item.data() as WeekMission).sort((a, b) => a.week - b.week);
  const people = peopleSnap?.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Person, 'id'>) })) ?? [];
  const attendance = attendanceSnap?.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<Attendance, 'id'>) })) ?? [];
  const weeklyScores = scoresSnap.docs.map((item) => {
    const data = item.data() as WeeklyScore & { submittedAt?: unknown };
    return { ...data, submittedAt: asIso(data.submittedAt) } as WeeklyScore;
  });
  const control = controlSnap.exists()
    ? ({ ...defaultState.control, ...(controlSnap.data() as RallyControl), lockedUntil: asIso(controlSnap.data().lockedUntil) } as RallyControl)
    : defaultState.control;
  const announcements = announcementsSnap.docs
    .map((item) => {
      const data = item.data() as Announcement & { createdAt?: unknown };
      return { id: item.id, title: data.title, body: data.body, createdAt: asIso(data.createdAt) ?? new Date().toISOString() };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    config,
    missions: missions.length ? missions : createDefaultMissions(config.totalWeeks),
    people,
    attendance,
    weeklyScores,
    control,
    announcements,
  };
}

export function subscribeRemoteState(onChange: (state: RallyState) => void, onError?: (error: Error) => void): Unsubscribe {
  let timer: number | undefined;
  const refresh = () => {
    if (timer) window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      try {
        const state = await loadRemoteState();
        if (state) onChange(state);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Falha ao sincronizar o Rally.'));
      }
    }, 80);
  };
  const unsubs = [
    onSnapshot(rallyRef, refresh, (error) => onError?.(error)),
    onSnapshot(missionsRef, refresh, (error) => onError?.(error)),
    onSnapshot(scoresRef, refresh, (error) => onError?.(error)),
    onSnapshot(controlRef, refresh, (error) => onError?.(error)),
    onSnapshot(announcementsRef, refresh, (error) => onError?.(error)),
  ];
  return () => {
    if (timer) window.clearTimeout(timer);
    unsubs.forEach((unsubscribe) => unsubscribe());
  };
}

export async function seedRemoteState(state: RallyState) {
  const snap = await getDoc(rallyRef);
  if (snap.exists()) return;
  const batch = writeBatch(db);
  batch.set(rallyRef, { ...state.config, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  state.missions.forEach((mission) => batch.set(doc(missionsRef, `week-${String(mission.week).padStart(2, '0')}`), mission));
  batch.set(controlRef, { ...state.control, updatedAt: serverTimestamp() });
  await batch.commit();
}

export async function saveConfig(config: RallyConfig) {
  await setDoc(rallyRef, { ...config, updatedAt: serverTimestamp() }, { merge: true });
}

export async function saveMission(mission: WeekMission) {
  await setDoc(doc(missionsRef, `week-${String(mission.week).padStart(2, '0')}`), mission, { merge: true });
}

export async function savePerson(person: Person) {
  const { id, ...payload } = person;
  await setDoc(doc(peopleRef, id), payload, { merge: true });
}

export async function removePerson(id: string) {
  await deleteDoc(doc(peopleRef, id));
}

export async function saveAttendance(entry: Attendance) {
  const { id, ...payload } = entry;
  await setDoc(doc(attendanceRef, id), payload, { merge: true });
}

export async function submitWeeklyScore(tribeId: string, week: number, points: number, details: Record<string, unknown> = {}) {
  await setDoc(
    doc(scoresRef, `${String(week).padStart(2, '0')}-${tribeId}`),
    { tribeId, week, points, details, submitted: true, submittedAt: serverTimestamp() },
    { merge: true },
  );
}

export async function publishAnnouncement(title: string, body: string) {
  await addDoc(announcementsRef, { title, body, createdAt: serverTimestamp() });
}

export async function finalizeWeek(state: RallyState) {
  const week = state.config.currentWeek;
  const mission = state.missions.find((item) => item.week === week);
  const batch = writeBatch(db);
  if (mission) batch.set(doc(missionsRef, `week-${String(week).padStart(2, '0')}`), { ...mission, finalized: true }, { merge: true });
  batch.set(rallyRef, { currentWeek: Math.min(state.config.totalWeeks, week + 1), updatedAt: serverTimestamp() }, { merge: true });
  await batch.commit();
}

export async function finalizeRally(finalRanking: RallyConfig['finalRanking']) {
  await setDoc(rallyRef, { finalized: true, finalRanking, finalizedAt: serverTimestamp(), updatedAt: serverTimestamp() }, { merge: true });
}

async function deleteCollectionDocuments(ref: ReturnType<typeof collection>) {
  const snap = await getDocs(ref);
  for (let index = 0; index < snap.docs.length; index += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(index, index + 400).forEach((item) => batch.delete(item.ref));
    await batch.commit();
  }
}

export async function restartRally(config: RallyConfig) {
  await Promise.all([deleteCollectionDocuments(scoresRef), deleteCollectionDocuments(attendanceRef)]);
  await setDoc(rallyRef, { ...config, currentWeek: 1, finalized: false, finalRanking: [], finalizedAt: null, updatedAt: serverTimestamp() }, { merge: true });
  const batch = writeBatch(db);
  const missionsSnap = await getDocs(missionsRef);
  missionsSnap.docs.forEach((item) => batch.set(item.ref, { finalized: false }, { merge: true }));
  await batch.commit();
}

export async function createNewRally(current: RallyState, nextConfig: RallyConfig) {
  const archivePayload = JSON.parse(JSON.stringify({ ...current, archivedAt: new Date().toISOString() })) as Record<string, unknown>;
  await addDoc(collection(db, 'rallyArchives'), archivePayload);
  await Promise.all([
    deleteCollectionDocuments(scoresRef),
    deleteCollectionDocuments(attendanceRef),
    deleteCollectionDocuments(missionsRef),
    deleteCollectionDocuments(announcementsRef),
  ]);
  const batch = writeBatch(db);
  batch.set(rallyRef, { ...nextConfig, currentWeek: 1, finalized: false, finalRanking: [], finalizedAt: null, updatedAt: serverTimestamp() }, { merge: false });
  createDefaultMissions(nextConfig.totalWeeks).forEach((mission) => batch.set(doc(missionsRef, `week-${String(mission.week).padStart(2, '0')}`), mission));
  await batch.commit();
}

export async function signIn(email: string, password: string) {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  await firebaseSignOut(auth);
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getSessionProfile(user?: User | null): Promise<SessionProfile | null> {
  const current = user ?? auth.currentUser;
  if (!current) return null;
  const snap = await getDoc(doc(db, 'users', current.uid));
  const data = snap.exists() ? snap.data() : {};
  const fallbackRole: UserRole = current.email === 'admin@rallyfju.com' ? 'admin' : 'viewer';
  return {
    id: current.uid,
    role: (data.role ?? fallbackRole) as UserRole,
    tribeId: data.tribeId ?? null,
    church: data.church ?? null,
    email: current.email,
  };
}

export async function saveUserProfile(uid: string, profile: { role: UserRole; tribeId?: string | null; church?: string | null; email?: string | null }) {
  await setDoc(doc(db, 'users', uid), profile, { merge: true });
}

export async function setSystemControl(control: Partial<RallyControl>) {
  await updateDoc(controlRef, { ...control, updatedAt: serverTimestamp() });
}
