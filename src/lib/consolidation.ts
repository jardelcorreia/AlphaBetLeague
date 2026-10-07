
import { Match, PlayerPredictions, ChampionshipWinner, PlayerScore } from "./types";
import { doc, getDoc, setDoc, serverTimestamp, CollectionReference, QuerySnapshot, DocumentData } from "firebase/firestore";
import { Firestore } from "firebase/firestore";

/**
 * Calcula a pontuação de um jogador para um jogo específico.
 */
export function calculateMatchPoints(match: Match, pred: { homeScore: string; awayScore: string }) {
  if (match.isValidForPoints === false || match.status === 'cancelled') return { points: 0, exact: 0 };
  
  const rh = match.homeScore, ra = match.awayScore;
  if (rh === null || ra === null || rh === undefined || ra === undefined) return { points: 0, exact: 0 };
  
  const ph = parseInt(pred.homeScore), pa = parseInt(pred.awayScore);
  if (isNaN(ph) || isNaN(pa)) return { points: 0, exact: 0 };

  if (ph === rh && pa === ra) return { points: 3, exact: 1 };
  if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) return { points: 1, exact: 0 };
  
  return { points: 0, exact: 0 };
}

/**
 * Consolida os pontos da rodada e identifica os vencedores.
 * Esta função agora pode ser chamada diretamente pelo Admin no Frontend.
 */
export async function runConsolidation(
  db: Firestore,
  roundId: string,
  matches: Match[],
  allUsers: any[],
  allBets: any[]
): Promise<ChampionshipWinner | null> {
  const roundNumber = parseInt(roundId.replace('round_', ''));
  if (isNaN(roundNumber)) return null;

  const pointsMap: Record<string, number> = {};
  const exactScoresMap: Record<string, number> = {};
  
  allUsers.forEach(u => {
    pointsMap[u.id] = 0;
    exactScoresMap[u.id] = 0;
  });

  matches.forEach((match, idx) => {
    const originalIdx = match.originalIndex ?? idx;
    allUsers.forEach(u => {
      const bet = allBets.find(b => b.userId === u.id && (b.matchId === match.id || b.id.endsWith(`_${originalIdx}`)));
      if (!bet) return;
      
      const pred = { 
        homeScore: bet.homeScorePrediction?.toString() || "", 
        awayScore: bet.awayScorePrediction?.toString() || "" 
      };
      
      const result = calculateMatchPoints(match, pred);
      pointsMap[u.id] += result.points;
      exactScoresMap[u.id] += result.exact;
    });
  });

  // Identificar Vencedor (apenas se houver jogos finalizados/live)
  const hasStarted = matches.some(m => m.status === 'finished' || m.status === 'live');
  const isFinished = matches.every(m => m.status === 'finished' || m.status === 'cancelled');
  
  let winnerNames = "";
  if (hasStarted) {
    const maxPts = Math.max(...Object.values(pointsMap), 0);
    if (maxPts > 0) {
      const playersWithMax = allUsers.filter(u => pointsMap[u.id] === maxPts);
      const maxExs = Math.max(...playersWithMax.map(u => exactScoresMap[u.id]), 0);
      winnerNames = playersWithMax
        .filter(u => exactScoresMap[u.id] === maxExs)
        .map(u => u.username || u.id)
        .join(", ");
    }
  }

  const settingsRef = doc(db, "app_settings", "championship");
  const settingsSnap = await getDoc(settingsRef);
  let history: ChampionshipWinner[] = Array.from({ length: 38 }, (_, i) => ({
    round: i + 1, winners: "", value: 6, pointsMap: {}, exactScoresMap: {}
  }));

  if (settingsSnap.exists()) {
    const data = settingsSnap.data();
    if (Array.isArray(data.history)) {
      data.history.forEach((h: any) => {
        if (h && h.round) history[h.round - 1] = h;
      });
    }
  }

  const newEntry: ChampionshipWinner = {
    round: roundNumber,
    winners: winnerNames,
    value: history[roundNumber - 1]?.value || 6,
    pointsMap,
    exactScoresMap
  };

  history[roundNumber - 1] = newEntry;

  await setDoc(settingsRef, {
    history,
    dateUpdated: serverTimestamp()
  }, { merge: true });

  return newEntry;
}
