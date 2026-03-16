
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const APP_URL = "https://alphabetleague.netlify.app";
const BASE_URL = 'https://api.football-data.org/v4';

/**
 * Verifica se estamos no horário de silêncio (22h às 08h BRT).
 * Isso evita que notificações Push acordem os jogadores.
 */
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

/**
 * Lógica de Janela de Validade
 * Determina quantos jogos de uma rodada são elegíveis para palpites e pontos,
 * baseando-se em uma janela de 3 dias em torno da data principal da rodada.
 */
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

/**
 * Sincroniza dados da API oficial com o Firestore a cada 15 minutos.
 * Revela os placares automaticamente baseando-se no horário do primeiro jogo.
 */
export const syncBrasileiraoData = onSchedule({
  schedule: "every 15 minutes",
}, async (event) => {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    console.error("syncBrasileiraoData: FOOTBALL_DATA_API_KEY não encontrada no ambiente.");
    return;
  }

  try {
    const competitionResponse = await fetch(`${BASE_URL}/competitions/BSA`, {
      headers: { 'X-Auth-Token': apiKey }
    });
    const competitionData = await competitionResponse.json();
    const currentMatchday = competitionData.currentSeason?.currentMatchday;

    if (!currentMatchday) return;

    const matchesResponse = await fetch(`${BASE_URL}/competitions/BSA/matches?matchday=${currentMatchday}`, {
      headers: { 'X-Auth-Token': apiKey }
    });
    const matchesData = await matchesResponse.json();

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
    const roundRef = admin.firestore().collection("rounds").doc(roundId);
    const roundDoc = await roundRef.get();
    const existingData = roundDoc.exists ? roundDoc.data() : null;

    let isScoresHidden = existingData ? existingData.isScoresHidden : true;
    let autoRevealProcessed = existingData ? existingData.autoRevealProcessed : false;

    // Lógica de Revelação Automática Baseada em Horário:
    const firstMatchTime = apiMatches
      .filter((m: any) => m.status !== 'cancelled' && m.utcDate)
      .reduce((earliest: number, m: any) => {
        const d = new Date(m.utcDate).getTime();
        return (d > 0 && d < earliest) ? d : earliest;
      }, Infinity);

    const now = Date.now();
    
    if (isScoresHidden && !autoRevealProcessed && Number.isFinite(firstMatchTime) && now >= firstMatchTime) {
      isScoresHidden = false;
      autoRevealProcessed = true;
      console.log(`syncBrasileiraoData: Rodada ${currentMatchday} atingiu o horário de início. Revelando palpites.`);
    }

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
      isScoresHidden: isScoresHidden,
      autoRevealProcessed: autoRevealProcessed,
      dateUpdated: admin.firestore.FieldValue.serverTimestamp(),
      dateCreated: existingData ? existingData.dateCreated : admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

  } catch (error) {
    console.error("syncBrasileiraoData: Erro na sincronização:", error);
  }
});

/**
 * Recalcula e salva automaticamente o ranking sempre que a rodada é atualizada.
 */
export const onRoundUpdateConsolidate = onDocumentUpdated("rounds/{roundId}", async (event) => {
  const after = event.data?.after.data();
  if (!after || !after.matches || after.matches.length < 5) return;

  const roundId = event.params.roundId;
  const roundNumber = after.roundNumber;
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
    users.forEach(u => {
      let pts = 0;
      const userBets = betsByUser[u.id] || [];
      
      after.matches.forEach((match: any) => {
        if (match.status !== 'finished' && match.status !== 'live') return;
        
        const bet = userBets.find(b => b.matchId === match.id);
        if (!bet) return;

        const rh = match.homeScore, ra = match.awayScore;
        const ph = bet.homeScorePrediction, pa = bet.awayScorePrediction;

        if (rh !== null && ra !== null && ph !== undefined && pa !== undefined) {
          if (ph === rh && pa === ra) {
            pts += 3;
          } else if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) {
            pts += 1;
          }
        }
      });
      pointsMap[u.id] = pts;
    });

    const maxPts = Math.max(...Object.values(pointsMap), 0);
    const winnerNames = users
      .filter(u => pointsMap[u.id] === maxPts && maxPts > 0)
      .map(u => u.username || u.id)
      .join(", ");

    const settingsRef = db.collection("app_settings").doc("championship");
    const settingsDoc = await settingsRef.get();
    let history = settingsDoc.exists ? settingsDoc.data()?.history : null;

    if (!history) {
      history = Array.from({ length: 38 }, (_, i) => ({
        round: i + 1,
        winners: "",
        value: 6,
        pointsMap: {}
      }));
    }

    history[roundNumber - 1] = {
      ...history[roundNumber - 1],
      round: roundNumber,
      winners: winnerNames,
      pointsMap: pointsMap
    };

    await settingsRef.set({ history, dateUpdated: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });

  } catch (error) {
    console.error(`onRoundUpdateConsolidate: Erro na Rodada ${roundNumber}:`, error);
  }
});

/**
 * Notifica os usuários quando os palpites da rodada são revelados.
 */
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
      console.error("onRevealScores: Erro:", error);
    }
  }
});

/**
 * Envia notificação "NA MOSCA" se o usuário acertar o placar exato.
 * CORREÇÃO: Dispara APENAS quando o jogo transiciona estritamente para o status 'finished'.
 */
export const onMatchScoreUpdate = onDocumentUpdated("rounds/{roundId}", async (event) => {
  const after = event.data?.after.data();
  const before = event.data?.before.data();
  if (!after || !after.matches || !before || !before.matches) return;

  const roundId = event.params.roundId;
  const matches = after.matches;
  const oldMatches = before.matches;

  const betsSnapshot = await admin.firestore().collection(`rounds/${roundId}/bets`).get();
  
  for (const betDoc of betsSnapshot.docs) {
    const bet = betDoc.data();
    const userId = bet.userId;
    const match = matches.find((m: any) => m.id === bet.matchId);
    const oldMatch = oldMatches.find((m: any) => m.id === bet.matchId);

    // Garantia de disparo: Só se o status mudou para 'finished' e o anterior NÃO era 'finished'
    if (match && match.status === 'finished' && oldMatch && oldMatch.status !== 'finished') {
      const isExact = bet.homeScorePrediction === match.homeScore && bet.awayScorePrediction === match.awayScore;
      
      if (isExact) {
        const userDoc = await admin.firestore().collection("users").doc(userId).get();
        const userData = userDoc.data();
        if (userData && userData.fcmTokens && userData.fcmTokens.length > 0) {
          const message = {
            notification: {
              title: "🎯 NA MOSCA!",
              body: `Você cravou o placar de um jogo na ${after.name}! +3 pontos garantidos.`,
            },
            tokens: userData.fcmTokens,
            webpush: { fcmOptions: { link: `${APP_URL}/?tab=jogos` } },
            data: { link: `${APP_URL}/?tab=jogos` }
          };
          try {
            await admin.messaging().sendEachForMulticast(message);
          } catch (error) {
            console.error(`onMatchScoreUpdate: Erro para ${userId}:`, error);
          }
        }
      }
    }
  }
});

/**
 * Lógica de Notificações de Lembrete:
 * Roda a cada 15 minutos. Envia aviso de "Última Chamada" 15 minutos antes.
 */
export const notifyRoundStart = onSchedule("every 15 minutes", async (event) => {
  if (isQuietHours()) return;
  const roundsSnapshot = await admin.firestore()
    .collection("rounds")
    .orderBy("roundNumber", "desc")
    .limit(1)
    .get();
  if (roundsSnapshot.empty) return;
  const currentRound = roundsSnapshot.docs[0];
  const roundData = currentRound.data();
  const roundId = currentRound.id;
  if (roundData.isScoresHidden === false) return;
  const matches = roundData.matches || [];
  const targetCount = getValidMatchesCount(matches);
  if (targetCount === 0) return;
  
  const firstMatchTime = matches
    .filter((m: any) => m.status !== 'cancelled' && m.utcDate)
    .reduce((earliest: number, m: any) => {
      const d = new Date(m.utcDate).getTime();
      return (d > 0 && d < earliest) ? d : earliest;
    }, Infinity);
    
  if (!Number.isFinite(firstMatchTime)) return;
  
  const now = Date.now();
  const diffToStart = firstMatchTime - now;
  const fifteenMins = 15 * 60 * 1000;
  const twelveHours = 12 * 60 * 60 * 1000;

  const isLastCall = diffToStart > 0 && diffToStart <= fifteenMins;
  const isHourlyReminder = diffToStart > 0 && diffToStart <= twelveHours && new Date().getMinutes() < 15;

  if (!isLastCall && !isHourlyReminder) return;
  
  const usersSnapshot = await admin.firestore().collection("users").get();
  for (const userDoc of usersSnapshot.docs) {
    const userData = userDoc.data();
    const userId = userDoc.id;
    if (!userData.fcmTokens || userData.fcmTokens.length === 0) continue;
    
    const userBetsSnapshot = await admin.firestore()
      .collection(`rounds/${roundId}/bets`)
      .where("userId", "==", userId)
      .get();
      
    if (userBetsSnapshot.size < targetCount) {
      const remaining = targetCount - userBetsSnapshot.size;
      const message = {
        notification: {
          title: isLastCall ? "🚨 ÚLTIMA CHAMADA!" : "⚠️ PALPITES PENDENTES!",
          body: isLastCall 
            ? `Ei ${userData.username || 'campeão'}, o primeiro jogo começa em 15 minutos! Corre que ainda faltam ${remaining} palpites.`
            : `Ei ${userData.username || 'campeão'}, faltam ${remaining} palpite${remaining > 1 ? 's' : ''} para a ${roundData.name}.`,
        },
        tokens: userData.fcmTokens,
        webpush: { fcmOptions: { link: `${APP_URL}/?tab=jogos` } },
        data: { link: `${APP_URL}/?tab=jogos` }
      };
      try {
        await admin.messaging().sendEachForMulticast(message);
      } catch (error) {
        console.error(`notifyRoundStart: Erro para ${userId}:`, error);
      }
    }
  }
});
