
# AlphaBet League - Brasileirão 2026

Este é o portal oficial da AlphaBet League, uma plataforma de palpites para o Brasileirão focada em competição entre amigos e análise de dados.

## 🚀 Como usar o App

1. **QUILA/JOGOS**: Veja as partidas da rodada, horários e preencha seus palpites.
2. **Palpites**: Compare suas predições com as dos outros jogadores em tempo real.
3. **Ranking**: Acompanhe a classificação geral do campeonato e o saldo bancário da liga.
4. **Tabela**: Consulte a classificação oficial da Série A atualizada.

## 📦 Como Publicar (Deploy)

### Netlify (Hospedagem Frontend)
O deploy é automático via GitHub. Se encontrar o erro `User git error while checking for ref refs/heads/main`:
1. Vá no painel do Netlify em **Site settings** > **Build & deploy** > **Continuous Deployment**.
2. Na seção **Branch to deploy**, verifique se o nome configurado é `main`. 
3. Se o seu repositório no GitHub ainda usa o nome antigo `master`, clique em **Edit settings** no Netlify e altere a branch de deploy para `master`.
4. Caso o repositório seja privado, certifique-se de que o Netlify possui permissão de acesso (pode ser necessário clicar em "Link repository" novamente para autorizar).

### Firebase (Backend e Automações)
Se você precisar atualizar as regras do banco de dados ou as funções automáticas (notificações e ranking):
1. **Atualizar o CLI**: `npm install -g firebase-tools`
2. **Login**: `firebase login`
3. **Publicar Regras e Funções**: `firebase deploy --only firestore:rules,functions`

## 🔔 Sistema de Notificações (Push)

O app utiliza **Firebase Cloud Messaging (FCM)** e **Cloud Functions** para automação:

- **🚀 Rodada Liberada**: Avisa quando uma nova rodada está aberta para palpites.
- **👀 Palpites Revelados**: Notifica todos quando os placares dos amigos tornam-se visíveis.
- **🎯 Na Mosca!**: Alerta imediato e individual quando você acerta um placar exato (3 pontos).
- **⚠️ Lembrete de Quila**: Job agendado que avisa quem ainda não completou os palpites válidos da rodada atual.

## 🤖 Tecnologias e Design

- **Framework**: NextJS 15 (App Router)
- **UI/UX**: ShadCN UI + Tailwind CSS
- **Backend**: Firebase (Auth, Firestore, Storage, Functions, Messaging)
- **IA**: Genkit com modelos Gemini.

---
Desenvolvido com NextJS, ShadCN UI e Firebase Studio.
