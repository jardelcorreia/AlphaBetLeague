'use server';

import { Match, StandingEntry, MatchStatus } from './types';

// Carrega variáveis de ambiente explicitamente em desenvolvimento para o Firebase Studio
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config();
}

const BASE_URL = 'https://api.football-data.org/v4';

/**
 * Dados de Mock para desenvolvimento caso a API KEY esteja faltando
 */
const MOCK_MATCHES: Match[] = [
  { id: 1, homeTeam: "SE Palmeiras", awayTeam: "Botafogo FR", homeScore: 2, awayScore: 1, status: 'live', matchday: 38, utcDate: new Date().toISOString() },
  { id: 2, homeTeam: "CR Flamengo", awayTeam: "São Paulo FC", homeScore: 0, awayScore: 0, status: 'upcoming', matchday: 38, utcDate: new Date().toISOString() },
  { id: 3, homeTeam: "SC Internacional", awayTeam: "Cruzeiro EC", homeScore: 3, awayScore: 2, status: 'finished', matchday: 38, utcDate: new Date().toISOString() },
];

/**
 * Busca a rodada atual do Brasileirão (BSA).
 */
export async function getBrasileiraoCurrentMatchday(): Promise<number> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;
  
  if (!apiKey) {
    console.warn('getBrasileiraoCurrentMatchday: FOOTBALL_DATA_API_KEY não encontrada. Usando rodada 1 como padrão.');
    return 1;
  }

  try {
    const response = await fetch(`${BASE_URL}/competitions/BSA`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return 1;
    const data = await response.json();
    return data.currentSeason?.currentMatchday || 1;
  } catch (error) {
    return 1;
  }
}

/**
 * Busca os jogos de uma rodada específica do Brasileirão (BSA).
 */
export async function getBrasileiraoMatches(matchday: number): Promise<Match[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) {
    console.warn('getBrasileiraoMatches: FOOTBALL_DATA_API_KEY ausente. Exibindo dados de teste.');
    return process.env.NODE_ENV === 'development' ? MOCK_MATCHES : [];
  }

  try {
    const response = await fetch(`${BASE_URL}/competitions/BSA/matches?matchday=${matchday}`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      if (response.status === 429) console.warn('API Rate Limit atingido.');
      return process.env.NODE_ENV === 'development' ? MOCK_MATCHES : [];
    }

    const data = await response.json();
    if (!data.matches) return [];

    return data.matches.map((m: any) => {
      let status: MatchStatus = 'upcoming';
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
  } catch (error) {
    return process.env.NODE_ENV === 'development' ? MOCK_MATCHES : [];
  }
}

/**
 * Busca a tabela de classificação do Brasileirão (BSA).
 */
export async function getLeagueStandings(): Promise<StandingEntry[]> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY;

  if (!apiKey) return [];

  try {
    const response = await fetch(`${BASE_URL}/competitions/BSA/standings`, {
      headers: { 'X-Auth-Token': apiKey },
      next: { revalidate: 300 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    if (!data.standings || data.standings.length === 0) return [];
    
    return data.standings[0].table.map((s: any) => ({
      position: s.position,
      teamName: s.team.name,
      teamCrest: s.team.crest,
      playedGames: s.playedGames,
      won: s.won,
      draw: s.draw,
      lost: s.lost,
      points: s.points,
      goalDifference: s.goalDifference,
      goalsFor: s.goalsFor,
      goalsAgainst: s.goalsAgainst
    }));
  } catch (error) {
    return [];
  }
}
