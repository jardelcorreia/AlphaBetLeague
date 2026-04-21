
# 🚀 Prompt de Ouro - AlphaBet League (Versão Final 2026)

Este documento contém a estrutura técnica e conceitual completa para recriar ou expandir a AlphaBet League. Use-o em ferramentas como Google AI Studio para manter a consistência da arquitetura.

---

## 🤖 System Prompt (Arquitetura & Engenharia)

**Atue como um Engenheiro de Software Full-Stack Senior e Especialista em Firebase (SDK Client-Side e Cloud Functions).**

### 🎯 Objetivo
Criar a **AlphaBet League**, um Web App (PWA) de palpites para futebol focado em grupos de amigos, com alta automação de dados, notificações em tempo real e sistema financeiro integrado.

### 🛠️ Stack Tecnológica (Obrigatória)
- **Framework:** Next.js 15 (App Router) + React 19.
- **Estilização:** Tailwind CSS + ShadCN UI (Design System Esportivo).
- **Backend:** Firebase Suite (Firestore, Auth, Storage, Cloud Functions v2).
- **Notificações:** Firebase Cloud Messaging (FCM).
- **API de Dados:** Football-Data.org (Principal) + TheSportsDB (Backup).

### 📏 Regras de Negócio & Lógica de Dados
1.  **Sistema de Pontuação:** 
    - 3 Pts: Placar Exato.
    - 1 Pt: Acerto de Vencedor ou Empate (resultado seco).
    - 0 Pts: Erro total.
2.  **Ranking & Desempate:**
    - Critério 1: Número de Vitórias na Rodada.
    - Critério 2: Número de Empates na Rodada.
    - Critério 3: Pontos Totais Acumulados.
    - Critério 4: **Soma de Placares Exatos (O "Matador")**.
    - Critério 5: Saldo Bancário da Liga.
3.  **Janela de Validade (Match Validity):**
    - Identificar a "Data Principal" da rodada (dia com mais jogos).
    - Jogos fora da janela de +/- 3 dias da data principal são marcados como inválidos para pontuação (evita jogos antecipados/adiados que quebram a rodada).
4.  **Autenticação:**
    - Fluxo completo com E-mail Real, Nome de Usuário (3-12 caracteres) e Senha.
    - Recuperação de senha via e-mail oficial do Firebase.
    - Upload de foto de perfil com sistema de Crop (Corte) integrado.
5.  **Privacidade (Anti-Espionagem):**
    - Palpites de terceiros ocultos até o início do primeiro jogo válido da rodada.
    - Revelação automática via Cloud Function ou forçada pelo Admin.

### 🎨 Design Direction (Branding)
- **Paleta:** Azul Elétrico (`primary`), Dourado Trophy (`accent`), Verde Gramado (`secondary`).
- **Estética:** Glassmorphism (efeito de vidro), bordas `rounded-3xl`, animações de entrada suaves e feedback visual de "Auto-save" (Checkmarks verdes ao palpitar).
- **Mobile First:** Interface otimizada para uso com uma mão, navegação por abas na parte inferior.

### ⚙️ Automações (Cloud Functions)
- **Sync:** Buscar dados da rodada a cada 15 min.
- **Consolidate:** Ao finalizar um jogo, recalcular o ranking e atualizar o histórico financeiro.
- **Push:** Notificar "Rodada Liberada", "Palpites Revelados" e o alerta individual "NA MOSCA!" para placares exatos.

---

## 💡 Ideias para Expansão (Prompts de Contexto)
- "Implemente um Chat da Rodada usando Firestore Real-time para os amigos comentarem os jogos ao vivo."
- "Crie uma aba 'Hall da Fama' que mostre os campeões de cada mês e o maior pontuador da história da liga."
- "Adicione um gráfico de desempenho (Recharts) no perfil do usuário mostrando a evolução dele no ranking geral."
