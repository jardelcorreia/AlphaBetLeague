
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Match, StandingEntry, ChampionshipWinner } from '@/lib/types';

const FOOTBALL_API_URL = 'https://api.football-data.org/v4';

export async function GET(req: NextRequest) {
  // Opcional: Verificar segredo do Cron para evitar chamadas externas
  // const authHeader = req.headers.get('authorization');
  // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  //   return new NextResponse('Unauthorized', { status: 401 });
  // }

  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'API Key missing' }, { status: 500 });
  }

  try {
    // 1. Obter Rodada Atual
    const compRes = await fetch(`${FOOTBALL_API_URL}/competitions/BSA`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 0 }
    });
    const compData = await compRes.json();
    const currentMatchday = compData.currentSeason?.currentMatchday;

    if (!currentMatchday) throw new Error('Could not determine current matchday');

    // 2. Obter Jogos da Rodada
    const matchesRes = await fetch(`${FOOTBALL_API_URL}/competitions/BSA/matches?matchday=${currentMatchday}`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 0 }
    });
    const matchesData = await matchesRes.json();

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
    const roundRef = adminDb.collection('rounds').doc(roundId);
    const roundSnap = await roundRef.get();
    const existingData = roundSnap.exists ? roundSnap.data() : null;

    let finalMatches = apiMatches;
    if (existingData?.matches) {
      finalMatches = apiMatches.map((apiMatch: any) => {
        const manualMatch = existingData.matches.find((mm: any) => mm.id === apiMatch.id);
        if (manualMatch?.isManual) {
          return { ...manualMatch, utcDate: apiMatch.utcDate, homeTeam: apiMatch.homeTeam, awayTeam: apiMatch.awayTeam };
        }
        return apiMatch;
      });
    }

    // 3. Salvar Jogos
    await roundRef.set({
      id: roundId,
      roundNumber: currentMatchday,
      name: `Rodada ${currentMatchday}`,
      matches: finalMatches,
      dateUpdated: new Date().toISOString(),
      dateCreated: existingData?.dateCreated || new Date().toISOString(),
    }, { merge: true });

    // 4. Rodar Consolidação do Ranking
    await consolidateRanking(roundId, finalMatches);

    return NextResponse.json({ success: true, round: currentMatchday });
  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function consolidateRanking(roundId: string, matches: Match[]) {
  const roundNumber = parseInt(roundId.replace('round_', ''));
  const betsSnapshot = await adminDb.collection(`rounds/${roundId}/bets`).get();
  const usersSnapshot = await adminDb.collection('users').get();
  
  const pointsMap: Record<string, number> = {};
  const exactScoresMap: Record<string, number> = {};
  const users: any[] = [];

  usersSnapshot.forEach(doc => {
    const u = doc.data();
    users.push({ ...u, id: doc.id });
    pointsMap[doc.id] = 0;
    exactScoresMap[doc.id] = 0;
  });

  matches.forEach(match => {
    if (match.status === 'cancelled') return;
    const rh = match.homeScore, ra = match.awayScore;
    if (rh === null || ra === null || rh === undefined || ra === undefined) return;

    betsSnapshot.forEach(doc => {
      const bet = doc.data();
      if (bet.matchId === match.id || bet.id.endsWith(`_${match.id}`)) {
        const ph = bet.homeScorePrediction, pa = bet.awayScorePrediction;
        if (ph !== null && pa !== null) {
          if (ph === rh && pa === ra) {
            pointsMap[bet.userId] += 3;
            exactScoresMap[bet.userId] += 1;
          } else if ((ph > pa && rh > ra) || (ph < pa && rh < ra) || (ph === pa && rh === ra)) {
            pointsMap[bet.userId] += 1;
          }
        }
      }
    });
  });

  const allFinished = matches.every(m => m.status === 'finished' || m.status === 'cancelled');
  let winners = "";
  if (allFinished) {
    const maxPts = Math.max(...Object.values(pointsMap), 0);
    if (maxPts > 0) {
      const leaders = users.filter(u => pointsMap[u.id] === maxPts);
      const maxExs = Math.max(...leaders.map(u => exactScoresMap[u.id]), 0);
      winners = leaders.filter(u => exactScoresMap[u.id] === maxExs).map(u => u.username).join(", ");
    }
  }

  const settingsRef = adminDb.collection('app_settings').doc('championship');
  const settingsSnap = await settingsRef.get();
  let history = Array.from({ length: 38 }, (_, i) => ({ round: i + 1, winners: "", value: 6 }));

  if (settingsSnap.exists()) {
    const data = settingsSnap.data();
    if (Array.isArray(data.history)) history = data.history;
  }

  history[roundNumber - 1] = {
    ...history[roundNumber - 1],
    round: roundNumber,
    winners,
    pointsMap,
    exactScoresMap,
  };

  await settingsRef.set({ history, dateUpdated: new Date().toISOString() }, { merge: true });
}
