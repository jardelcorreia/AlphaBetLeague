import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const APP_URL = "https://alphabetleague.netlify.app";
const BASE_URL = 'https://api.football-data.org/v4';

function isQuietHours(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  });
  const hour = parseInt(formatter.format(now));
  return hour >= 22 || hour < 8;
}

function getValidMatchesCount(matches: any[]): number {
  if (!matches || matches.length === 0) return 0;
  const matchesToProcess = matches.slice(0, 10);
  const dateCounts: Record<string, number> = {};
  
  matchesToProcess.forEach(m => {
    if (m.utcDate) {
      const date = m.utcDate.split('T')[0];
      dateCounts[date] = (dateCounts[date] || 0) + 1;
    }
  });

  let mainDateStr = "";
  let maxCount = -1;
  for (const date in dateCounts) {
    if (dateCounts[date] > maxCount) {
      maxCount = dateCounts[date];
      mainDateStr = date;
    }
  }

  if (!mainDateStr) return matchesToProcess.filter(m => m.status !== 'cancelled').length;

  const mainDate = new Date(`${mainDateStr}T12:00:00Z`).getTime();
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

  return matchesToProcess.filter(m => {
    if (m.status === 'cancelled') return false;
    if (!m.utcDate) return true;
    const matchTime = new Date(m.utcDate).getTime();
    const diff = Math.abs(matchTime - mainDate);
    return diff <= (threeDaysInMs + 12 * 60 * 60 * 1000);
  }).length;
}

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

    let isScoresHidden = existingData ? (existingData.isScoresHidden ?? true) : true;
    let autoRevealProcessed = existingData ? (existingData.autoRevealProcessed ?? false) : false;

    const now = Date.now();
    const firstMatchTime = apiMatches
      .filter((m: any) => m.status !== 'cancelled' && m.utcDate)
      .reduce((earliest: number, m: any) => {
        const d = new Date(m.utcDate).getTime();
        return (d > 0 && d < earliest) ? d : earliest;
      }, Infinity);

    if (isScoresHidden && !autoRevealProcessed && Number.isFinite(firstMatchTime) && now >= (firstMatchTime - 5 * 60 * 1000)) {
      isScoresHidden = false;
      autoRevealProcessed = true;
    }

    await roundRef.set({
      id: roundId,
      roundNumber: currentMatchday,
      name: `Rodada ${currentMatchday}`,
      matches: finalMatches,
      isScoresHidden: isScoresHidden,
      autoRevealProcessed: autoRevealProcessed,
      dateUpdated: admin.firestore.FieldValue.serverTimestamp(),
      dateCreated: existingData ? existingData.dateCreated : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    console.log(`syncBrasileiraoData: Rodada ${currentMatchday} sincronizada.`);

  } catch (error) {
    console.error("syncBrasileiraoData: Erro fatal:", error);
  }
});

export const onRoundUpdateConsolidate = onDocumentUpdated("rounds/{roundId}", async (event) => {
  const after = event.data?.after.data();
  if (!after || !after.matches) return;

  const roundId = event.params.roundId;
  const roundNumber = parseInt(after.roundNumber);
  if (!roundNumber) return;

  const db = admin.firestore();
  try {
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

    after.matches.forEach((match: any) => {
      if (match.status === 'cancelled') return;

      users.forEach(u => {
        if (!pointsMap[u.id]) pointsMap[u.id] = 0;
        if (!exactScoresMap[u.id]) exactScoresMap[u.id] = 0;

        const userBets = betsByUser[u.id] || [];
        const bet = userBets.find(b => b.matchId === match.id);
        if (!bet) return;

        const rh = match.homeScore, ra = match.awayScore;
        const ph = bet.homeScorePrediction, pa = bet.awayScorePrediction;

        if (rh !== null && ra !== null && ph !== undefined && pa !== undefined) {
          if (ph === rh && pa === ra) {
            pointsMap[u.id] += 3;
            exactScoresMap[u.id] += 1;
          }
          else if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) {
            pointsMap[u.id] += 1;
          }
        }
      });
    });

    const validMatches = after.matches.slice(0, 10).filter((m: any) => m.status !== 'cancelled');
    const allFinished = validMatches.length > 0 && validMatches.every((m: any) => m.status === 'finished');

    let winnerNames = "";
    if (allFinished) {
      const maxPts = Math.max(...Object.values(pointsMap), 0);
      if (maxPts > 0) {
        const playersWithMaxPts = users.filter(u => pointsMap[u.id] === maxPts);
        const maxExs = Math.max(...playersWithMaxPts.map(u => exactScoresMap[u.id] || 0));
        const finalWinners = playersWithMaxPts.filter(u => (exactScoresMap[u.id] || 0) === maxExs);
        winnerNames = finalWinners.map(u => u.username || u.id).join(", ");
      }
    }

    const settingsRef = db.collection("app_settings").doc("championship");
    const settingsDoc = await settingsRef.get();
    let history = settingsDoc.exists ? settingsDoc.data()?.history : null;

    if (!history || !Array.isArray(history)) {
      history = Array.from({ length: 38 }, (_, i) => ({ 
        round: i + 1, winners: "", value: 6, pointsMap: {}, exactScoresMap: {} 
      }));
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
    }
  } catch (error) {
    console.error(`onRoundUpdateConsolidate: Erro na Rodada ${roundNumber}:`, error);
  }
});

export const onRevealScores = onDocumentUpdated("rounds/{roundId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  if (!before || !after) return;

  if (before.isScoresHidden === true && after.isScoresHidden === false) {
    if (isQuietHours()) return;
    
    const usersSnapshot = await admin.firestore().collection("users").get();
    const tokens: string[] = [];
    usersSnapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmTokens && Array.isArray(data.fcmTokens)) tokens.push(...data.fcmTokens);
    });

    if (tokens.length === 0) return;

    const message = {
      notification: {
        title: "👀 Palpites Revelados!",
        body: `A rodada começou! Veja agora o que seus amigos jogaram na ${after.name}.`,
      },
      tokens: tokens,
      webpush: { fcmOptions: { link: `${APP_URL}/?tab=palpites` } },
      data: { link: `${APP_URL}/?tab=palpites` }
    };

    try {
      await admin.messaging().sendEachForMulticast(message);
    } catch (error) {
      console.error("onRevealScores: Erro no envio push:", error);
    }
  }
});
