
# AlphaBet League - Brasileirão 2026

Este é o portal oficial da AlphaBet League, uma plataforma de palpites para o Brasileirão focada em competição de alto nível entre amigos e análise de dados em tempo real.

## 💡 A Ideia
A AlphaBet League transforma o acompanhamento do Brasileirão em uma experiência social gamificada. Diferente de bolões comuns, aqui a precisão é recompensada e a estratégia é fundamental. O app automatiza a sincronização de dados, o cálculo de rankings complexos e a gestão financeira da liga, permitindo que os jogadores foquem apenas na "quila".

## 🚀 Funcionalidades Principais
- **QUILA/JOGOS**: Preenchimento intuitivo de palpites com auto-save.
- **Palpites Revelados**: Sistema anti-espionagem que oculta placares até o início da rodada.
- **Ranking "Matador"**: Critérios de desempate avançados que valorizam quem acerta o placar exato.
- **Notificações Push**: Alertas de rodada liberada, palpites visíveis e acertos "Na Mosca!".
- **Gestão Administrativa**: Controle total sobre valores de apostas, histórico de vencedores e controle manual de jogos.

## 🕹️ Controle de Jogos (Painel ADM)
O Administrador possui controle soberano sobre a integridade dos dados da rodada:
1. **Modo Híbrido**: O app alterna entre sincronização automática (via API) e controle manual.
2. **Edição Prioritária**: Alterar um placar ou status no Painel ADM ativa a flag `isManual`, impedindo que a automação sobrescreva o ajuste do administrador.
3. **Gestão de Status**: É possível marcar jogos como "Ao Vivo", "Finalizados" ou "Adiados" (suspendendo a pontuação destes últimos).
4. **Recuperação**: O botão de "Reset para API" permite descartar alterações manuais e voltar a seguir os dados oficiais em tempo real.

## 💰 Sistema Financeiro e Pagamentos
O app funciona como o **contabilista oficial** da liga. O sistema de prêmios segue estas regras:

1. **Valor da Rodada**: Definido pelo Admin (ex: R$ 6,00 por jogador).
2. **O Vencedor**: O jogador que somar mais pontos na rodada vence. Se houver empate, aplicam-se os critérios: 1º Placares Exatos, 2º Vitórias Acumuladas, 3º Saldo Bancário.
3. **Cálculo do Saldo**:
   - O vencedor recebe o valor da rodada de cada um dos perdedores.
   - Se houver empate entre 2 jogadores na liderança após todos os critérios, o pote acumulado dos perdedores é dividido entre eles.
4. **Saldo Bancário**: O ranking geral exibe o saldo acumulado (Lucro/Prejuízo) de cada jogador.
5. **Liquidação**: O app registra as dívidas e créditos. O pagamento real deve ser feito entre os amigos (via PIX, por exemplo) baseando-se nos valores auditados pelo sistema.

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
