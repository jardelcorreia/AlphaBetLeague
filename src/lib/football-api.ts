'use server';

import { Match, StandingEntry, MatchStatus } from './types';

const BASE_URL = 'https://api.football-data.org/v4';

/**
 * Busca a rodada atual do Brasileirão (BSA).
 */
export async function getBrasileiraoCurrentMatchday(): Promise<number> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  
  if (!apiKey) {
    console.warn('getBrasileiraoCurrentMatchday: FOOTBALL_DATA_API_KEY não configurada.');
    return 1;
  }

  try {
    const response = await fetch(`${BASE_URL}/competitions/BSA`, {
      headers: {
        'X-Auth-Token': apiKey,
      },
      next: { revalidate: 3600 }, // Cache de 1 hora
    });

    if (!response.ok) {
      console.error(`getBrasileiraoCurrentMatchday Error: ${response.status}`);
      return 1;
    }

    const data = await response.json();
    return data.currentSeason?.currentMatchday || 1;
  } catch (error) {
    console.error('Erro ao buscar rodada atual:', error);
    return 1;
  }
}

/**
 * Busca os jogos de uma rodada específica do Brasileirão (BSA).
 */
export async function getBrasileiraoMatches(matchday: number): Promise<Match[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    console.error('getBrasileiraoMatches: FOOTBALL_DATA_API_KEY não configurada.');
    return [];
  }

  try {
    const response = await fetch(`${BASE_URL}/competitions/BSA/matches?matchday=${matchday}`, {
      headers: {
        'X-Auth-Token': apiKey,
      },
      next: { revalidate: 60 }, // Cache de 1 minuto para tempo real
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.warn('getBrasileiraoMatches: Limite de requisições da API atingido (Rate Limit).');
      } else {
        console.error(`getBrasileiraoMatches Error: ${response.status} ${response.statusText}`);
      }
      return [];
    }

    const data = await response.json();

    if (!data.matches) return [];

    return data.matches.map((m: any) => {
      const homeScore = m.score.fullTime.home;
      const awayScore = m.score.fullTime.away;
      const rawStatus = m.status;

      let status: MatchStatus = 'upcoming';

      if (['SCHEDULED', 'TIMED', 'SUSPENDED'].includes(rawStatus)) {
        status = 'upcoming';
      } else if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(rawStatus)) {
        status = 'live';
      } else if (['FINISHED', 'AWARDED'].includes(rawStatus)) {
        status = 'finished';
      } else if (['POSTPONED', 'CANCELLED'].includes(rawStatus)) {
        status = 'cancelled';
      }

      return {
        id: m.id,
        homeTeam: m.homeTeam.name,
        awayTeam: m.awayTeam.name,
        homeScore: homeScore,
        awayScore: awayScore,
        utcDate: m.utcDate,
        status: status,
        matchday: m.matchday,
      };
    });
  } catch (error) {
    console.error('Erro ao buscar jogos:', error);
    return [];
  }
}

/**
 * Busca a tabela de classificação do Brasileirão (BSA).
 */
export async function getLeagueStandings(): Promise<StandingEntry[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    console.warn('getLeagueStandings: FOOTBALL_DATA_API_KEY não configurada.');
    return [];
  }

  try {
    const response = await fetch(`${BASE_URL}/competitions/BSA/standings`, {
      headers: {
        'X-Auth-Token': apiKey,
      },
      next: { revalidate: 300 }, // Cache de 5 minutos
    });

    if (!response.ok) {
      console.error(`getLeagueStandings Error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    if (!data.standings || data.standings.length === 0) return [];
    
    const table = data.standings[0].table;

    return table.map((s: any) => ({
      position: s.position,
      teamName: s.team.name,
      teamCrest: s.team.crest,
      playedGames: s.playedGames,
      won: s.won,
      draw: s.draw,
      lost: s.lost,
      points: s.points,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst,
      goalDifference: s.goalDifference,
    }));
  } catch (error) {
    console.error('Erro ao buscar classificação:', error);
    return [];
  }
}