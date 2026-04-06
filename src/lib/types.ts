
export type TeamInfo = {
  abrev: string;
  nome: string;
  escudo: string;
};

export type MatchStatus = 'upcoming' | 'live' | 'finished' | 'cancelled';

export type Match = {
  id: number;
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  utcDate: string;
  status: MatchStatus;
  matchday: number;
  isValidForPoints?: boolean; // Indica se a partida está dentro da janela de validade da rodada
  originalIndex?: number; // Índice original na rodada para manter integridade dos palpites
};

export type StandingEntry = {
  position: number;
  teamName: string;
  teamCrest: string;
  playedGames: number;
  won: number;
  draw: number;
  lost: number;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
};

export type Prediction = {
  homeScore: string;
  awayScore: string;
};

export type PlayerPredictions = Record<string, Prediction[]>; // Key is userId

export type GameSession = {
  roundName: string;
  predictions: PlayerPredictions;
  results: Prediction[];
  placaresOcultos: boolean;
};

export type PlayerScore = {
  id: string; // Adicionado userId
  name: string;
  points: number;
  exactScores: number;
  isWinner?: boolean;
  betsCompleted: boolean;
  betsCount: number; // Nova propriedade para progresso
  photoUrl?: string;
};

export type ChampionshipWinner = {
  round: number;
  winners: string; // Ex: "Jardel, Werbet"
  value: number;
  pointsMap?: Record<string, number>; // Key is userId
  exactScoresMap?: Record<string, number>; // Key is userId
};

export type PlayerOverallStats = {
  name: string;
  wins: number;
  draws: number;
  points: number;
  exactScores: number; // Nova propriedade
  balance: number;
};
