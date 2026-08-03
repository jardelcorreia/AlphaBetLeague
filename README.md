
# AlphaBet League - Brasileirão 2026

Este é o portal oficial da AlphaBet League, uma plataforma de palpites para o Brasileirão focada em competição de alto nível entre amigos e análise de dados em tempo real.

## 💡 A Ideia
A AlphaBet League transforma o acompanhamento do Brasileirão em uma experiência social gamificada. Diferente de bolões comuns, aqui a precisão é recompensada e a estratégia é fundamental. O app automatiza a sincronização de dados, o cálculo de rankings complexos e a gestão financeira da liga, permitindo que os jogadores foquem apenas na "quila".

## 🚀 Funcionalidades Principais
- **QUILA/JOGOS**: Preenchimento intuitivo de palpites com auto-save.
- **Palpites Revelados**: Sistema anti-espionagem que oculta placares até o início da rodada.
- **Ranking "Matador"**: Critérios de desempate avançados que valorizam quem acerta o placar exato.
- **Notificações Push**: Alertas de rodada liberada, palpites visíveis e acertos "Na Mosca!".
- **Gestão Administrativa**: Controle total sobre valores de apostas e histórico de vencedores.

## 🛠️ Tecnologias
- **Frontend**: Next.js 15 (App Router), Tailwind CSS, ShadCN UI.
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions).
- **Dados**: Sincronização em tempo real via Football-Data.org.

## 📦 Como Publicar (Deploy)

### Netlify (Hospedagem Frontend)
O deploy é automático via GitHub. Caso encontre erro de acesso à branch, verifique se o Netlify está apontando para a branch correta (`main` ou `master`) em **Build settings**.

### Firebase (Backend)
Para atualizar regras e automações:
`firebase deploy --only firestore:rules,functions`

---
Desenvolvido com foco em performance e paixão por futebol.
