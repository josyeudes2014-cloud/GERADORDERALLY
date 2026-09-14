const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();
const region = 'southamerica-east1';
const timeZone = 'America/Sao_Paulo';

const controlRef = db.doc('system/rally-control');
const rallyRef = db.doc('rallies/current');

exports.openWeeklySubmissionWindow = onSchedule(
  { schedule: '0 16 * * 0', timeZone, region },
  async () => {
    const rallySnap = await rallyRef.get();
    if (!rallySnap.exists || rallySnap.data().finalized) return;
    await controlRef.set({
      submissionOpen: true,
      systemLocked: false,
      openedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  },
);

exports.closeWeeklySubmissionWindow = onSchedule(
  { schedule: '0 19 * * 0', timeZone, region },
  async () => {
    const rallySnap = await rallyRef.get();
    if (!rallySnap.exists || rallySnap.data().finalized) return;

    const rally = rallySnap.data();
    const week = Number(rally.currentWeek || 1);
    const activeTribes = Array.isArray(rally.activeTribeIds) ? rally.activeTribeIds : [];
    const scores = db.collection('rallies/current/weeklyScores');
    const batch = db.batch();

    for (const tribeId of activeTribes) {
      const scoreRef = scores.doc(`${String(week).padStart(2, '0')}-${tribeId}`);
      const scoreSnap = await scoreRef.get();
      if (!scoreSnap.exists) {
        batch.set(scoreRef, {
          tribeId,
          week,
          points: 0,
          submitted: false,
          autoClosed: true,
          submittedAt: FieldValue.serverTimestamp(),
          details: { reason: 'Fechamento automático sem lançamento até 19h.' },
        });
      }
    }

    const now = new Date();
    const lockedUntil = new Date(now.getTime());
    lockedUntil.setDate(lockedUntil.getDate() + 1);
    lockedUntil.setHours(7, 0, 0, 0);

    batch.set(controlRef, {
      submissionOpen: false,
      systemLocked: true,
      lastClosedWeek: week,
      closedAt: FieldValue.serverTimestamp(),
      lockedUntil: Timestamp.fromDate(lockedUntil),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await batch.commit();
  },
);

exports.unlockSystemMondayMorning = onSchedule(
  { schedule: '0 7 * * 1', timeZone, region },
  async () => {
    await controlRef.set({
      submissionOpen: false,
      systemLocked: false,
      lockedUntil: null,
      unlockedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  },
);
