# Raposa I — experiências e gestão comunitária

Aplicativo Expo/React Native dedicado a visitantes, site React para catálogo e gestão comunitária e backend Supabase/Postgres compartilhado. O app não oferece operações de gestão a guias ou administradores; o site `/gestao` é a área operacional da comunidade. O conteúdo inicial reúne as experiências do Catálogo da Comunidade Indígena Raposa I (2023).

## Aplicativo móvel

```bash
cd mobile
npm install
npx expo start
```

Abra o QR code pelo Expo Go ou escolha emulador iOS/Android. Para desenvolvimento web do app, use `npx expo start --web`. As dez experiências e as imagens do catálogo já estão dentro do app. Sem Supabase configurado, a navegação pelo catálogo funciona em modo local; reservas e contas exigem o backend.

## Site e painel da comunidade

### Executar localmente

```bash
npm install
npm run dev
```

Execute os comandos na pasta raiz do projeto. O Vite mostrará no terminal o endereço local do site (normalmente `http://localhost:5173`).

- Catálogo público: `/`
- Gestão e calendário comunitário: `/gestao`
- Experiência do visitante no celular: execute `cd mobile` e depois `npm run web` (Expo Web)
- Painel e calendário da gestão: `/gestao`

Para encerrar o servidor de desenvolvimento, pressione `Ctrl+C` no terminal. Sem as variáveis do Supabase, o catálogo e a demonstração do calendário ficam disponíveis localmente. O formulário do visitante também abre em modo de prévia para testar os campos, mas não envia nem salva respostas; contas, reservas e dados reais dependem da configuração do backend.

### Testar e gerar a versão de produção

```bash
npm test
npm run lint
npm run build
npm run preview
```

`npm run preview` serve localmente a versão criada por `npm run build` (normalmente em `http://localhost:4173`). O catálogo público fica na raiz e a gestão restrita em `/gestao`.

## Backend, contas e dados

O Supabase/Postgres mantém contas, experiências, vínculos de guia, agenda comunitária, solicitações de visita e o WhatsApp público da gestão. Aplique em ordem todos os arquivos de `supabase/migrations` pelo SQL Editor do projeto Supabase; em instalações existentes, aplique todos os arquivos ainda não executados, inclusive `202611100004_programs_seasons_and_customer_codes.sql`.

1. Crie um projeto Supabase e copie `.env.example` para `.env.local` na raiz. Para o app mobile, copie `mobile/.env.example` para `mobile/.env`. Preencha em cada arquivo a URL e a chave pública (publishable) do mesmo projeto. Não compartilhe nem coloque chaves `service_role` nesses arquivos.
2. Reinicie Vite/Expo após configurar as variáveis.
3. Crie o primeiro usuário administrador no Auth do Supabase; o trigger vai criar um perfil visitante. No SQL Editor, promova esse usuário usando seu e-mail: `update public.profiles set role = 'community_admin' where id = (select id from auth.users where email = 'EMAIL_DO_ADMIN');` Substitua pelo e-mail real.
4. Configure e publique a função de backend `create-guide` (código em `supabase/functions/create-guide/index.ts`) para cadastrar usuários e atribuir experiências. Exemplo Supabase CLI: `npx supabase link --project-ref SEU_PROJECT_REF`, `npx supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...` e `npx supabase functions deploy create-guide`. A chave `service_role` é segredo de servidor: nunca coloque em `.env` do Vite/Expo, no app, ou no navegador.
5. Entre em `/gestao` com a conta administradora. Cadastre cada guia com e-mail/senha inicial e marque uma ou várias atividades. Use senha individual de pelo menos 12 caracteres e entregue-a em particular.

### Perfis e privacidade

- Qualquer pessoa pode navegar pelo catálogo sem criar conta.
- O cadastro público cria somente perfil de visitante. Com conta, o cliente envia consultas de visita e acompanha exclusivamente as próprias solicitações.
- O visitante usa o aplicativo móvel para criar conta/entrar, montar uma programação com uma ou mais atividades e horários publicados, enviar participantes e observações opcionais e consultar o histórico agrupado. O site mantém o catálogo público e a operação da comunidade em `/gestao`.
- O visitante informa um telefone obrigatório para retorno. Depois do pedido, a comunidade usa esse telefone para compartilhar o preço e combinar a visita; a solicitação não confirma a reserva.
- O WhatsApp oficial é público e pode ser alterado por uma pessoa com perfil de `community_admin` no painel `/gestao`, na seção **WhatsApp da gestão**. O catálogo e o aplicativo móvel usam o mesmo número salvo em `community_settings`.
- Para trocar o número, entre como administrador em `/gestao`, abra **WhatsApp da gestão** e informe o telefone com código do país e DDD (somente dígitos são salvos). A migração `202611100002_community_contact.sql` cria a configuração pública lida pelo catálogo e pelo app; aplique-a no SQL Editor antes de usar o contato online. No app, o atalho **Fale com a comunidade** abre a conversa em `wa.me`.
- O painel da comunidade inclui calendário mensal por data, com horário, atividade, visitante, quantidade de participantes e situação do pedido. Filtros de atividade, guia, situação e cliente também se aplicam ao calendário; pedidos cancelados ficam fora dele.
- O calendário atualiza pedidos automaticamente via Supabase Realtime; para habilitar, aplique `202611100003_realtime_booking_updates.sql`. Caso a conexão Realtime esteja indisponível, a gestão pode atualizar manualmente.
- Sem Supabase configurado, `/gestao` exibe o perfil da comunidade em modo de demonstração. É possível adicionar, editar, agrupar e filtrar agendamentos fictícios; mudar status, cancelar e restaurar os exemplos; ver o calendário por mês ou semana; consultar relatórios e preparar mensagens para copiar. As mudanças ficam no `localStorage` deste navegador e não representam nem alteram reservas reais. Mensagens de demonstração devem ser revisadas; não são enviadas automaticamente.
- A gestão comunitária pode publicar e retirar horários futuros por experiência. A reserva confere vagas no banco com bloqueio transacional; pedidos pendentes e confirmados ocupam capacidade.
- Cada cliente recebe um código legível `RAP-000001` além do UUID interno. Uma solicitação pode reunir até dez atividades e datas; a gestão pode acrescentar atividades ou cancelá-las com confirmação, preservando o histórico.
- Em **Disponibilidade por atividade**, configure meses e dias da semana para liberar horários recorrentes. Use **Exceção de data** para liberar ou bloquear um dia específico; a exceção prevalece sobre a regra recorrente. Sem regras sazonais, nenhuma data futura fica disponível para novos horários, então configure as épocas após aplicar a migração.
- A gestão pode compartilhar manualmente a programação consolidada pelo WhatsApp. O sistema abre o texto no WhatsApp para revisão e envio; não envia mensagens automaticamente.
- A migração `202611100004_programs_seasons_and_customer_codes.sql` cria os códigos de cliente, preserva cada pedido anterior em uma programação própria, adiciona regras e exceções sazonais e mantém auditoria das alterações. Confira as políticas RLS e teste as regras no projeto Supabase antes de receber dados reais.
- O pedido pergunta se a pessoa tem alergias e, em caso afirmativo, abre um campo obrigatório para descrevê-las. Outras restrições alimentares e necessidades de acessibilidade são opcionais; o formulário registra consentimento para uso dos dados e explica quem pode acessá-los. Visitantes podem cancelar pedidos pendentes; alterações de situação aparecem no histórico. Não há envio automático de e-mail ou push.
- A comunidade atribui cada pedido a um guia. Cada guia vê somente os pedidos e atividades atribuídos ao seu usuário; a gestão comunitária tem a visão geral.
- O banco usa políticas RLS para aplicar essas permissões na origem. Contas e senhas usam Supabase Auth; não há senha guardada na tabela de clientes.
- A comunidade compartilha o preço ao retornar ao visitante. Escolher horário disponível e enviar pedido não significa reserva confirmada.
- O banco começa sem clientes reais. Eles serão criados a partir dos cadastros feitos pelos próprios clientes.

Antes de receber dados reais, valide acesso, regras de senha, política de privacidade, retenção e cópias de segurança com a comunidade. Não carreguei clientes fictícios nem inventei credenciais.

### Melhorias futuras para o formulário

O formulário já usa uma pergunta condicional para pedir detalhes de alergias somente quando a pessoa responde “Sim”. Outras melhorias para avaliar com visitantes e a comunidade:

- Dividir o preenchimento em etapas curtas (por exemplo: atividade, participantes e necessidades), mantendo um indicador de progresso.
- Revisar cada pergunta com a comunidade: confirmar por que a informação é necessária, como será usada e quem precisa recebê-la; evitar coletar dados que não ajudem a organizar a visita.
- Validar os campos junto à pergunta e explicar como corrigir o problema, preservando o que a pessoa já digitou.
- Testar o formulário em celular com visitantes, inclusive pessoas que usam teclado, leitor de tela ou precisam de mais ajuda para entender as perguntas.
- Avaliar uma opção “Não tenho certeza” somente quando a comunidade puder agir de forma segura com essa resposta.

Essas recomendações seguem as orientações do [GOV.UK Service Manual sobre estrutura de formulários](https://www.gov.uk/service-manual/design/form-structure) e [perguntas claras e validação](https://www.gov.uk/service-manual/design/designing-good-questions), além do padrão acessível de [botões de opção do GOV.UK Design System](https://design-system.service.gov.uk/components/radios/). São sugestões para avaliar com usuários antes de alterar o fluxo.

## O que está implementado

- Catálogo pesquisável e filtros por natureza, saberes e gastronomia.
- Detalhe de cada vivência com descrição, duração, grupo, itens incluídos e recomendações.
- O site e o app móvel só permitem escolher horários futuros publicados pela comunidade; o banco impede exceder a capacidade, inclusive em pedidos simultâneos.
- O app móvel oferece campos de acessibilidade e alimentação, aviso e consentimento de privacidade, histórico atualizado e cancelamento de pedidos pendentes. O site concentra o catálogo público e a operação comunitária.
- A comunidade compartilha o preço ao retornar ao visitante; há horários publicados pela comunidade, mas pedido enviado não significa confirmação automática.
- Layout responsivo para celular e desktop, links de contato no rodapé de todas as páginas e painel de planejamento da visita.

## Organização do código

```text
src/
  components/       # telas e componentes compartilhados do site
  features/         # funcionalidades agrupadas, como calendário da gestão
  data/             # catálogo local de experiências
  services/         # operações de agenda e configurações do Supabase
  lib/              # cliente e configuração de integrações
  App.jsx           # composição do catálogo e rotas públicas
mobile/
  app/              # rotas Expo Router, catálogo, perfil e reservas
  lib/              # autenticação, catálogo e configuração do app
supabase/
  migrations/       # schema, permissões e funções de banco versionadas
```

As telas web usam serviços para concentrar as consultas e operações de agenda e contato; os componentes cuidam do fluxo de interação e apresentação. O calendário da gestão é uma funcionalidade própria, com utilitários de datas testados isoladamente. O app móvel mantém seu catálogo tipado em `mobile/lib`, porque é um aplicativo Expo independente do bundle web.

Para iniciar o aplicativo móvel a partir da pasta `mobile/`, use `npx expo start`; para executá-lo no navegador, use `npx expo start --web`.

## Conteúdo e mídia

As dez vivências, recomendações e fotografias foram extraídas do Catálogo oficial de Experiências da Comunidade Indígena Raposa I (2023), enviado pelo usuário. As fotos foram salvas localmente em `public/images/experiences/` e mapeadas por atividade no catálogo:

- Trilha da Cachoeira — página 12; Serra do Arco-Íris — página 17.
- Panela de barro — página 21; beiju e farinha — página 25; caxiri — página 28.
- Lago da Barragem — página 33; dança Parixara — página 36; arco e flecha — página 40.
- Damurida — página 44; trançados Macuxi — página 49.

O destaque da página inicial usa uma fotografia do lavrado na página 17. Antes de publicar, confirmar com os anfitriões os contatos, textos, condições de visita, horários, limites e detalhes atualizados. Caso sejam adicionados vídeos, usar registros autorizados pela comunidade.

## Sugestões de evolução

1. Integrar notificações por e-mail ou push às mudanças de situação. O histórico já mostra a última atualização; envio externo exige escolher e configurar um provedor.
2. Adicionar trailers de vídeo produzidos e autorizados pela comunidade; usar arquivos comprimidos e legendas para conexão móvel. O campo de vídeo ainda não está no banco e exige autorização dos detentores de imagem.
3. Incluir idiomas, instruções de transporte atualizadas, termos de visita e alertas de segurança aprovados pelos anfitriões.
4. Avaliar uma seção de gastronomia e artesanato por disponibilidade local; consultar os produtores antes de anunciar estoque ou valores.
5. Antes de tratar a consulta como reserva confirmada, validar com as lideranças quais regras comunitárias e autorizações/plano de visitação se aplicam. A FUNAI descreve visitação em terras indígenas como conduzida nos termos definidos pelos próprios povos e informa o fluxo de Plano de Visitação.

## Referências consultadas

- Ministério do Turismo, [Catálogo de experiências turísticas — Comunidade Indígena Raposa I (2023)](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/experiencias-do-brasil-original/2023-comunidade-indigena-raposa-i.pdf).
- Ministério do Turismo, [Experiências do Brasil Original](https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/experiencias-do-brasil-original).
- FUNAI, [Turismo indígena de base comunitária](https://www.gov.br/funai/pt-br/atuacao/meio-ambiente/etnodesenvolvimento/instrucao-normativa-no-01-2021).
- Governo Federal, [Solicitar anuência a projetos de visitação turística em terra indígena](https://www.gov.br/pt-br/servicos/solicitar-anuencia-a-projetos-de-visitacao-turistica-em-terra-indigena?id=12555&origem=servico).
- Sesc Roraima, [Turismo Social](https://www.sescrr.com.br/turismo-social/).
- Airbnb, [Como reservar uma experiência](https://www.airbnb.com/help/article/2493), referência para seleção de datas e fluxo de reserva.
- React, [Pensando em React](https://react.dev/learn/thinking-in-react) e [Estruturando o estado](https://react.dev/learn/choosing-the-state-structure), para decomposição da interface e estado derivado.
- Vídeo indicado: [Criando Projeto React da Forma CERTA | Estrutura Completa](https://www.youtube.com/watch?v=A8YlNy4NqbI), referência de organização para o painel React.
- Vídeo indicado: [Criando um aplicativo do zero com React Native + Expo — Aula 1](https://www.youtube.com/watch?v=A5yIPclvjJk), referência para o aplicativo móvel Expo com TypeScript.
- Expo, [Introdução ao React Native](https://docs.expo.dev/tutorial/introduction/) e [Expo Router](https://docs.expo.dev/versions/latest/sdk/router/), documentação consultada para a arquitetura móvel.
- Supabase, [Quickstart Expo React Native](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native), [Auth em React Native](https://supabase.com/docs/guides/auth/quickstarts/react-native) e [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), para login, persistência e permissões.
- Supabase, [Postgres Changes com Realtime](https://supabase.com/docs/guides/realtime/postgres-changes), para atualizações da agenda.
- W3C WAI-ARIA Authoring Practices, [Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/), para navegação acessível por teclado no calendário.

O contexto visual parte de tons de mata, barro e lavrado e de princípios de turismo comunitário. Não replica grafismos sagrados ou apresenta a paleta como padrão cultural único dos povos indígenas de Roraima.
