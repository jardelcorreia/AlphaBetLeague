
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { TEAMS } from "./constants"
import { Match } from "./types"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Limpa o nome do time removendo sufixos como FC, EC, AF e prefixos como Clube do.
 * Também utiliza o mapeamento manual de constants.ts para nomes padronizados.
 */
export function cleanTeamName(name: string): string {
  if (!name) return "";
  
  // Se já temos um mapeamento manual, usamos ele
  if (TEAMS[name]) return TEAMS[name].nome;

  // Caso contrário, aplicamos a limpeza por Regex
  return name
    .replace(/^(Clube\sdo\s|SE\s|SC\s|EC\s|CR\s|RB\s|CA\s|Atlético\sClube\s)/gi, '')
    .replace(/\s(FC|EC|SC|AC|AF|FR|FBPA|FBC|FBPC|CR|SE|RB|Club|Clube|Paulista|da\sGama|Foot\sBall\sClub|MG|PR|RJ|SP|RS)$/gi, '')
    .replace(/Athletico\sParanaense/gi, 'Athletico-PR')
    .replace(/Atlético\sMineiro/gi, 'Atlético-MG')
    .replace(/Atlético\sGoianiense/gi, 'Atlético-GO')
    .trim();
}

/**
 * Retorna a abreviação de 3 letras de um time.
 */
export function getTeamAbrev(name: string): string {
  const cleaned = cleanTeamName(name);
  if (!cleaned) return "---";
  const team = Object.values(TEAMS).find((t) => t.nome === cleaned);
  return team ? team.abrev : cleaned.substring(0, 3).toUpperCase();
}

/**
 * Implementa a Regra da Janela de Validade (3 dias antes/depois da data principal).
 */
export function determineMatchValidity(matches: Match[]): Match[] {
  if (!matches || matches.length === 0) return matches;

  // 1. Encontrar a Data Principal (dia com mais jogos)
  const dateCounts: Record<string, number> = {};
  matches.forEach(m => {
    if (!m.utcDate) return;
    const date = m.utcDate.split('T')[0];
    dateCounts[date] = (dateCounts[date] || 0) + 1;
  });

  let mainDateStr = "";
  let maxCount = -1;
  for (const date in dateCounts) {
    if (dateCounts[date] > maxCount) {
      maxCount = dateCounts[date];
      mainDateStr = date;
    }
  }

  if (!mainDateStr) return matches.map(m => ({ ...m, isValidForPoints: true }));

  // Criar data objeto para comparação (meio-dia UTC para evitar problemas de fuso)
  const mainDate = new Date(`${mainDateStr}T12:00:00Z`);
  const threeDaysInMs = 3 * 24 * 60 * 60 * 1000;

  // 2. Definir Janela e 3. Marcar Outliers
  return matches.map(m => {
    if (!m.utcDate) return { ...m, isValidForPoints: false };
    
    const matchDate = new Date(m.utcDate);
    // Diferença absoluta em milissegundos
    const diff = Math.abs(matchDate.getTime() - mainDate.getTime());
    
    // Válido se estiver dentro de 3 dias (com tolerância de 12h para fusos)
    const isValid = diff <= (threeDaysInMs + 12 * 60 * 60 * 1000);
    
    return {
      ...m,
      isValidForPoints: isValid
    };
  });
}
