
import { onDocumentUpdated, onDocumentCreated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const BASE_URL = 'https://api.football-data.org/v4';
const APP_URL = "https://alphabetleague.netlify.app";

/**
 * Sincroniza dados oficiais da API.
 */
export const syncBrasileiraoData = onSchedule({
  schedule: "every 15 minutes",
  memory: "256MiB",
  secrets: ["FOOTBALL_DATA_API_KEY"],
}, async (event) => {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    console.error("syncBrasileiraoData: FOOTBALL_DATA_API_KEY não configurada.");
    return;
  }

  try {
    const compRes = await fetch(`${BASE_URL}/competitions/BSA`, { headers: { 'X-Auth-Token': apiKey } });
    const compData = await compRes.json();
    const currentMatchday = compData.currentSeason?.currentMatchday;
    if (!currentMatchday) return;

    const matchesRes = await fetch(`${BASE_URL}/competitions/BSA/matches?matchday=${currentMatchday}`, { headers: { 'X-Auth-Token': apiKey } });
    const matchesData = await matchesRes.json();
    if (!matchesData.matches) return;

    const apiMatches = matchesData.matches.map((m: any) => {
      let status = 'upcoming';
      if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status)) status = 'live';
      else if (['FINISHED', 'AWARDED'].includes(m.status)) status = 'finished';
      else if (['POSTPONED', 'CANCELLED'].includes(m.status)) status = 'cancelled';
      
      return {
        id: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeScore: m.score.fullTime.home,
        awayScore: m.score.fullTime.away,
        utcDate: m.utcDate,
        status: status,
        matchday: m.matchday,
      };
    });

    const roundId = `round_${currentMatchday}`;
    const db = admin.firestore();
    const roundRef = db.collection("rounds").doc(roundId);
    const roundDoc = await roundRef.get();
    const existingData = roundDoc.exists ? roundDoc.data() : null;

    let finalMatches = apiMatches;
    if (existingData && existingData.matches) {
      finalMatches = apiMatches.map((apiMatch: any) => {
        const manualMatch = existingData.matches.find((mm: any) => mm.id === apiMatch.id);
        if (manualMatch && manualMatch.isManual === true) {
          return {
            ...manualMatch,
            utcDate: apiMatch.utcDate,
            homeTeam: apiMatch.homeTeam,
            awayTeam: apiMatch.awayTeam,
            matchday: apiMatch.matchday
          };
        }
        return apiMatch;
      });
    }

    await roundRef.set({
      id: roundId,
      roundNumber: currentMatchday,
      name: `Rodada ${currentMatchday}`,
      matches: finalMatches,
      dateUpdated: admin.firestore.FieldValue.serverTimestamp(),
      dateCreated: existingData ? existingData.dateCreated : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

  } catch (error) {
    console.error("syncBrasileiraoData: Erro fatal:", error);
  }
});

/**
 * Função interna para consolidar pontos e vencedores no histórico global.
 */
async function consolidateRoundPoints(roundId: string) {
  const db = admin.firestore();
  const roundDoc = await db.collection("rounds").doc(roundId).get();
  const roundData = roundDoc.data();
  if (!roundData || !roundData.matches) return;

  const roundNumber = parseInt(roundData.roundNumber);
  if (!roundNumber || isNaN(roundNumber)) return;

  const betsSnapshot = await db.collection(`rounds/${roundId}/bets`).get();
  const betsByUser: Record<string, any[]> = {};
  betsSnapshot.forEach(doc => {
    const bet = doc.data();
    if (!betsByUser[bet.userId]) betsByUser[bet.userId] = [];
    betsByUser[bet.userId].push(bet);
  });

  const usersSnapshot = await db.collection("users").get();
  const users: any[] = [];
  usersSnapshot.forEach(doc => users.push(doc.data()));
  
  const pointsMap: Record<string, number> = {};
  const exactScoresMap: Record<string, number> = {};

  users.forEach(u => {
    pointsMap[u.id] = 0;
    exactScoresMap[u.id] = 0;
  });

  roundData.matches.forEach((match: any) => {
    if (match.status === 'cancelled') return;
    const rh = match.homeScore, ra = match.awayScore;
    if (rh === null || ra === null || rh === undefined || ra === undefined) return;

    users.forEach(u => {
      const userBets = betsByUser[u.id] || [];
      const bet = userBets.find(b => b.matchId === match.id);
      if (!bet) return;
      const ph = bet.homeScorePrediction, pa = bet.awayScorePrediction;
      if (ph !== null && pa !== null && ph !== undefined && pa !== undefined) {
        if (ph === rh && pa === ra) {
          pointsMap[u.id] += 3;
          exactScoresMap[u.id] += 1;
        } else if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) {
          pointsMap[u.id] += 1;
        }
      }
    });
  });

  const allFinished = roundData.matches.every((m: any) => m.status === 'finished' || m.status === 'cancelled');

  let winnerNames = "";
  if (allFinished) {
    const maxPts = Math.max(...Object.values(pointsMap), 0);
    if (maxPts > 0) {
      const playersWithMaxPts = users.filter(u => pointsMap[u.id] === maxPts);
      const maxExs = Math.max(...playersWithMaxPts.map(u => exactScoresMap[u.id] || 0), 0);
      const finalWinners = playersWithMaxPts.filter(u => (exactScoresMap[u.id] || 0) === maxExs);
      winnerNames = finalWinners.map(u => u.username || u.id).join(", ");
    }
  }

  const settingsRef = db.collection("app_settings").doc("championship");
  const settingsDoc = await settingsRef.get();
  const existingHistory = settingsDoc.exists ? settingsDoc.data()?.history : [];
  
  let history: any[] = Array.from({ length: 38 }, (_, i) => ({ 
    round: i + 1, winners: "", value: 6, pointsMap: {}, exactScoresMap: {} 
  }));

  if (Array.isArray(existingHistory)) {
    existingHistory.forEach(h => {
      if (h && h.round) history[h.round - 1] = h;
    });
  }

  const roundIndex = roundNumber - 1;
  if (roundIndex >= 0 && roundIndex < 38) {
    history[roundIndex] = {
      ...history[roundIndex],
      round: roundNumber,
      winners: winnerNames || history[roundIndex].winners || "",
      pointsMap: pointsMap,
      exactScoresMap: exactScoresMap
    };
    
    await settingsRef.set({ 
      history, 
      dateUpdated: admin.firestore.FieldValue.serverTimestamp() 
    }, { merge: true });
    
    console.log(`consolidateRoundPoints: Rodada ${roundNumber} atualizada.`);
  }

  // Notificação de Placares Revelados (exemplo de gatilho)
  if (roundData.isScoresHidden === false && !roundData.autoRevealProcessed) {
    const tokens: string[] = [];
    users.forEach(u => { if (u.fcmTokens) tokens.push(...u.fcmTokens); });
    if (tokens.length > 0) {
      await admin.messaging().sendEachForMulticast({
        notification: { title: "👀 Palpites Revelados!", body: `A rodada começou! Veja agora os palpites na ${roundData.name}.` },
        tokens,
        webpush: { fcmOptions: { link: `${APP_URL}/?tab=palpites` } }
      });
      await db.collection("rounds").doc(roundId).update({ autoRevealProcessed: true });
    }
  }
}

export const onRoundUpdateConsolidate = onDocumentUpdated("rounds/{roundId}", async (event) => {
  await consolidateRoundPoints(event.params.roundId);
});

export const onBetCreated = onDocumentCreated("rounds/{roundId}/bets/{betId}", async (event) => {
  await consolidateRoundPoints(event.params.roundId);
});

export const onBetUpdated = onDocumentUpdated("rounds/{roundId}/bets/{betId}", async (event) => {
  await consolidateRoundPoints(event.params.roundId);
});
