
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

if (admin.apps.length === 0) {
  admin.initializeApp();
}

const APP_URL = "https://alphabetleague.netlify.app";
// TheSportsDB API - Usando chave de teste '3' ou do ambiente
const API_KEY = process.env.THESPORTSDB_API_KEY || '3';
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const LEAGUE_ID = '4351'; // Brasileirão Série A
const SEASON = '2026';

/**
 * Verifica se estamos no horário de silêncio (22h às 08h BRT).
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
 * Sincroniza dados da TheSportsDB com o Firestore a cada 15 minutos.
 * Gerencia revelação automática por horário e ocultação em novas rodadas.
 */
export const syncBrasileiraoData = onSchedule({
  schedule: "every 15 minutes",
}, async (event) => {
  try {
    // 1. Buscar todos os eventos da temporada para determinar a rodada atual
    const eventsResponse = await fetch(`${BASE_URL}/eventsseason.php?id=${LEAGUE_ID}&s=${SEASON}`);
    const eventsData = await eventsResponse.json();
    
    if (!eventsData.events || eventsData.events.length === 0) return;

    // Ordenar por data para encontrar a rodada vigente
    const sortedEvents = [...eventsData.events].sort((a: any, b: any) => 
      new Date(a.strTimestamp).getTime() - new Date(b.strTimestamp).getTime()
    );

    const now = Date.now();
    
    // Encontrar o primeiro evento que não terminou ou o último que terminou recentemente
    const activeEvent = sortedEvents.find((e: any) => 
      e.strStatus !== 'Match Finished' || (new Date(e.strTimestamp).getTime() > now - 24 * 60 * 60 * 1000)
    ) || sortedEvents[0];

    const currentMatchday = activeEvent.intRound;
    const roundId = `round_${currentMatchday}`;
    
    // 2. Buscar jogos específicos desta rodada
    const roundResponse = await fetch(`${BASE_URL}/eventsround.php?id=${LEAGUE_ID}&r=${currentMatchday}&s=${SEASON}`);
    const roundData = await roundResponse.json();

    if (!roundData.events) return;

    const apiMatches = roundData.events.map((m: any) => {
      let status = 'upcoming';
      if (m.strStatus === 'Match Finished') status = 'finished';
      else if (m.strStatus.includes('In Progress') || m.strStatus.includes('Half Time')) status = 'live';
      else if (m.strStatus === 'Match Postponed' || m.strStatus === 'Cancelled') status = 'cancelled';

      return {
        id: parseInt(m.idEvent),
        homeTeam: m.strHomeTeam,
        awayTeam: m.strAwayTeam,
        homeScore: m.intHomeScore !== null ? parseInt(m.intHomeScore) : null,
        awayScore: m.intAwayScore !== null ? parseInt(m.intAwayScore) : null,
        utcDate: m.strTimestamp,
        status: status,
        matchday: parseInt(m.intRound),
      };
    });

    const roundRef = admin.firestore().collection("rounds").doc(roundId);
    const roundDoc = await roundRef.get();
    const existingData = roundDoc.exists ? roundDoc.data() : null;

    // LÓGICA DE VISIBILIDADE:
    // Se for uma rodada nova (documento não existe), ocultamos por padrão.
    // Se a rodada já existe, respeitamos o estado atual de 'isScoresHidden'.
    let isScoresHidden = existingData ? existingData.isScoresHidden : true;
    let autoRevealProcessed = existingData ? existingData.autoRevealProcessed : false;

    // Lógica de Revelação Automática Baseada em Horário:
    const firstMatchTime = apiMatches
      .filter((m: any) => m.status !== 'cancelled' && m.utcDate)
      .reduce((earliest: number, m: any) => {
        const d = new Date(m.utcDate).getTime();
        return (d > 0 && d < earliest) ? d : earliest;
      }, Infinity);

    if (isScoresHidden && !autoRevealProcessed && Number.isFinite(firstMatchTime) && now >= firstMatchTime) {
      isScoresHidden = false;
      autoRevealProcessed = true;
      console.log(`syncBrasileiraoData: Rodada ${currentMatchday} atingiu o horário de início (${new Date(firstMatchTime).toISOString()}). Revelando palpites.`);
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
      roundNumber: parseInt(currentMatchday),
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
  if (!after || !after.matches) return;

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
 * Envia notificação "NA MOSCA" se o usuário acertar o placar exato ao fim do jogo.
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
