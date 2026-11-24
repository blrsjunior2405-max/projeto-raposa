import pptxgen from 'pptxgenjs'
import fs from 'node:fs'
import path from 'node:path'

const pptx = new pptxgen()
pptx.layout = 'LAYOUT_WIDE'
pptx.author = 'Raposa I — experiências e gestão comunitária'
pptx.subject = 'Visão funcional e técnica do sistema'
pptx.title = 'Raposa I | Experiências e gestão comunitária'
pptx.lang = 'pt-BR'
pptx.theme = { headFontFace: 'Aptos Display', bodyFontFace: 'Aptos', lang: 'pt-BR' }
pptx.defineSlideMaster({ title: 'BASE', background: { color: 'F5F2E9' }, objects: [
  { line: { x: 0.55, y: 7.08, w: 12.2, h: 0, line: { color: 'D9D3C5', width: 0.8 } } },
  { text: { text: 'RAPOSA I  ·  EXPERIÊNCIAS E GESTÃO COMUNITÁRIA', options: { x: 0.58, y: 7.15, w: 7, h: 0.18, fontFace: 'Aptos', fontSize: 8, color: '6F776A', charSpacing: 1.1, margin: 0 } } },
  { text: { text: 'VISÃO DO SISTEMA', options: { x: 10.7, y: 7.15, w: 1.9, h: 0.18, align: 'right', fontFace: 'Aptos', fontSize: 8, color: '6F776A', charSpacing: 1, margin: 0 } } },
], slideNumber: { x: 12.78, y: 7.12, color: '6F776A', fontFace: 'Aptos', fontSize: 8 } })
const C = { green:'20382C', green2:'355941', olive:'77835A', cream:'F5F2E9', paper:'FFFEFA', clay:'B66E4B', gold:'D4A957', ink:'243129', muted:'727A70', line:'DED9CC', pale:'E9E8DC', mint:'E4EBDD', rose:'F2E5DA', blue:'E3E9E7', white:'FFFFFF' }
const W=13.333, H=7.5
const img=(name)=>path.resolve('public/images/experiences',name)
function txt(s,t,x,y,w,h,size=16,color=C.ink,opt={}) { s.addText(t,{x,y,w,h,fontFace:opt.fontFace||'Aptos',fontSize:size,color,bold:!!opt.bold,breakLine:false,margin:0,fit:'shrink',valign:opt.valign||'mid',align:opt.align||'left',charSpacing:opt.charSpacing||0,transparency:0,...opt}) }
function rect(s,x,y,w,h,fill,opts={}) { s.addShape(pptx.ShapeType.roundRect,{x,y,w,h,rectRadius:opts.r||0.12,line:{color:opts.line||fill,transparency:opts.line?0:100},fill:{color:fill,transparency:opts.transparency||0},radius:opts.r||0.12,...opts}) }
function base(section,title,sub) {const s=pptx.addSlide('BASE'); txt(s,section.toUpperCase(),0.66,0.4,10,0.2,9,C.clay,{bold:true,charSpacing:1.7});txt(s,title,0.66,0.78,12,0.5,29,C.green,{bold:true,fontFace:'Aptos Display'});if(sub)txt(s,sub,0.68,1.36,11.9,0.35,13,C.muted);return s}
function pill(s,label,x,y,w,color=C.mint,ink=C.green2){rect(s,x,y,w,0.29,color,{r:0.1});txt(s,label,x+0.12,y+0.01,w-0.24,0.26,9,ink,{bold:true,charSpacing:0.3})}
function card(s,x,y,w,h,title,body,accent=C.olive){rect(s,x,y,w,h,C.paper,{line:C.line,r:0.1});rect(s,x,y,0.07,h,accent,{r:0.04});txt(s,title,x+0.23,y+0.2,w-0.44,0.32,15,C.green,{bold:true});txt(s,body,x+0.23,y+0.62,w-0.45,h-0.78,11,C.muted,{valign:'top',breakLine:false})}
function arrow(s,x1,y1,x2,y2,color=C.olive){s.addShape(pptx.ShapeType.line,{x:x1,y:y1,w:x2-x1,h:y2-y1,line:{color,width:1.8,beginArrowType:'none',endArrowType:'triangle'}})}

// 1 — capa
{
 const s=pptx.addSlide();s.background={color:C.green};
 s.addImage({path:img('hero.jpg'),x:6.55,y:0,w:6.78,h:7.5,sizingCrop:true,transparency:4});
 s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:8.1,h:7.5,line:{transparency:100},fill:{color:C.green,transparency:2}});
 s.addShape(pptx.ShapeType.rect,{x:6.2,y:0,w:1.5,h:7.5,line:{transparency:100},fill:{color:C.green,transparency:35}});
 txt(s,'NORMANDIA · RORAIMA',0.8,0.72,5,0.25,10,'D9C99F',{bold:true,charSpacing:2});
 txt(s,'Raposa I',0.8,1.6,6,0.9,46,C.white,{bold:true,fontFace:'Aptos Display'});
 txt(s,'Experiências e\ngestão comunitária',0.84,2.65,6.0,1.35,30,C.white,{fontFace:'Aptos Display',breakLine:false,valign:'top'});
 rect(s,0.86,4.35,0.62,0.055,C.gold,{r:0.02});
 txt(s,'Como funciona para visitantes e para a comunidade —\ne como a plataforma conecta os dois lados.',0.86,4.63,5.4,0.8,15,'E6E9DC',{valign:'top'});
 txt(s,'VISÃO FUNCIONAL  +  VISÃO TÉCNICA',0.87,6.8,5,0.2,9,'D9C99F',{bold:true,charSpacing:1.5});
}
// 2
{
 const s=base('01 · Contexto','Um sistema para aproximar visita e organização','A plataforma reúne descoberta, solicitação de visitas e coordenação comunitária em um só fluxo.');
 const items=[['01','Descobrir','Conhecer vivências, duração, recomendações e contexto local.'],['02','Solicitar','Montar uma programação com horários publicados e dados necessários.'],['03','Coordenar','Acompanhar pedidos, disponibilidade, guias e calendário.']];
 items.forEach((a,i)=>{let x=.7+i*4.2;rect(s,x,2.15,3.75,2.55,C.paper,{line:C.line});txt(s,a[0],x+.24,2.42,.55,.3,13,C.clay,{bold:true});txt(s,a[1],x+.24,2.98,3.1,.38,21,C.green,{bold:true});txt(s,a[2],x+.24,3.55,3.1,.76,12,C.muted,{valign:'top'});if(i<2)arrow(s,x+3.79,3.44,x+4.12,3.44)});
 rect(s,.7,5.25,11.95,.83,C.mint,{r:.12});txt(s,'A comunidade define a disponibilidade e confirma os detalhes. A plataforma organiza a conversa; não substitui a decisão dos anfitriões.',.98,5.47,11.4,.4,14,C.green2,{bold:true,align:'center'});
}
// 3
{
 const s=base('02 · Experiência','A vitrine ajuda a escolher com contexto','O catálogo é público e pode ser explorado sem conta.');
 s.addImage({path:img('cachoeira.jpg'),x:.72,y:2.0,w:5.45,h:3.75,sizingCrop:true});
 pill(s,'10 VIVÊNCIAS',6.65,2.05,1.55,C.rose,C.clay);txt(s,'Natureza · Saberes · Gastronomia',6.65,2.55,5.5,.42,19,C.green,{bold:true});
 const lines=['Busca e filtros por categoria','Detalhes, duração, grupo e itens incluídos','Recomendações para a atividade','Contato da comunidade e acesso ao pedido'];
 lines.forEach((v,i)=>{txt(s,'✳',6.72,3.2+i*.5,.25,.28,13,C.clay,{bold:true});txt(s,v,7.08,3.18+i*.5,5.2,.3,13,C.ink)});
 txt(s,'As descrições e fotografias iniciais têm como base o catálogo da comunidade de 2023.',6.68,5.55,5.4,.4,10,C.muted,{italic:true});
}
// 4
{
 const s=base('03 · Jornada do visitante','Da escolha ao pedido de visita','O mesmo fluxo está disponível no site e no aplicativo móvel.');
 const steps=[['1','Escolhe','Atividade e horário publicado'],['2','Informa','Participantes e telefone'],['3','Cuida','Alergias, alimentação e acessibilidade'],['4','Envia','Aceita o aviso de privacidade'],['5','Acompanha','Vê o histórico da programação']];
 steps.forEach((a,i)=>{let x=.65+i*2.55;rect(s,x,2.5,2.16,1.75,i===4?C.mint:C.paper,{line:C.line});rect(s,x+.17,2.72,.42,.42,i===4?C.green2:C.rose,{r:.2});txt(s,a[0],x+.17,2.75,.42,.32,13,i===4?C.white:C.clay,{bold:true,align:'center'});txt(s,a[1],x+.17,3.3,1.8,.28,15,C.green,{bold:true});txt(s,a[2],x+.17,3.7,1.8,.38,10,C.muted,{valign:'top'});if(i<4)arrow(s,x+2.18,3.38,x+2.5,3.38)});
 rect(s,.72,4.9,11.85,.95,C.rose,{r:.12});txt(s,'Pedido enviado ≠ visita confirmada',.98,5.1,3.35,.35,17,C.clay,{bold:true});txt(s,'A comunidade retorna pelo telefone informado, alinha o preço e confirma se a visita pode acontecer.',4.4,5.08,7.75,.48,13,C.ink);
 txt(s,'O visitante pode cancelar pedidos pendentes e consultar mudanças no histórico.',.98,6.25,10.9,.3,11,C.muted);
}
// 5
{
 const s=base('04 · Jornada da comunidade','A gestão transforma pedidos em uma agenda coordenada','Administradores têm visão geral; guias acompanham apenas o que lhes foi atribuído.');
 const boxes=[['PUBLICAR','Abrir horários futuros e configurar épocas por atividade.'],['REVISAR','Consultar pedidos em lista e calendário, com filtros.'],['ATRIBUIR','Vincular o pedido ao guia responsável.'],['RESPONDER','Atualizar situação e compartilhar a programação.']];
 boxes.forEach((a,i)=>{let y=2.05+i*.88;rect(s,.8,y,2.15,.62,i===3?C.green2:C.pale,{r:.12});txt(s,a[0],.98,y+.13,1.78,.33,12,i===3?C.white:C.green,{bold:true,align:'center',charSpacing:.7});txt(s,a[1],3.32,y+.06,8.9,.48,14,C.ink);if(i<3)arrow(s,1.87,y+.64,1.87,y+.83,C.olive)});
 rect(s,.78,5.82,11.75,.55,C.blue,{r:.1});txt(s,'A disponibilidade é comunitária: regras recorrentes de mês/dia da semana + exceções de datas, que prevalecem.',1.0,5.93,11.3,.27,12,C.green2,{bold:true,align:'center'});
}
// 6
{
 const s=base('05 · Estados e comunicação','O que cada situação quer dizer','A interface separa solicitação, confirmação e conclusão para evitar expectativas erradas.');
 const states=[['Solicitado','A comunidade recebeu o pedido.','F6EBD8',C.clay],['Confirmado','A visita foi alinhada pelos anfitriões.','E2EBDD',C.green2],['Concluído','A atividade aconteceu.','E5E9E7',C.green],['Cancelado','O pedido ou item não está mais ativo.','F0E1DA','9A5744']];
 states.forEach((a,i)=>{let x=.76+(i%2)*6.05,y=2.08+Math.floor(i/2)*1.42;rect(s,x,y,5.62,1.03,a[2],{r:.12});txt(s,a[0],x+.2,y+.18,1.75,.27,15,a[3],{bold:true});txt(s,a[1],x+1.9,y+.16,3.48,.52,12,C.ink)});
 txt(s,'O sistema não envia e-mail ou notificação push. Mudanças aparecem no histórico; a gestão pode preparar uma mensagem para revisão e envio manual pelo WhatsApp.',.85,5.42,11.55,.72,14,C.green,{bold:true,align:'center'});
}
// 7
{
 const s=base('06 · Mapa do sistema','Dois pontos de entrada, serviços compartilhados','Web e app móvel convergem para a mesma camada de autenticação e dados.');
 const nodes=[{x:.8,y:2.25,w:2.45,h:.92,title:'SITE WEB',sub:'React + Vite',f:C.blue},{x:.8,y:4.05,w:2.45,h:.92,title:'APP MÓVEL',sub:'Expo + React Native',f:C.mint},{x:4.22,y:2.8,w:2.48,h:1.45,title:'SERVIÇOS',sub:'Supabase JS\nconsultas e regras de fluxo',f:C.paper},{x:7.72,y:2.8,w:2.3,h:1.45,title:'SUPABASE',sub:'Auth + Postgres\nRLS + RPC',f:'E8EBDD'},{x:10.82,y:2.8,w:1.72,h:1.45,title:'GESTÃO',sub:'Calendário\ne operação',f:C.rose}];
 nodes.forEach(n=>{rect(s,n.x,n.y,n.w,n.h,n.f,{line:C.line});txt(s,n.title,n.x+.15,n.y+.17,n.w-.3,.28,13,C.green,{bold:true,align:'center'});txt(s,n.sub,n.x+.14,n.y+.53,n.w-.28,.52,10,C.muted,{align:'center',valign:'top'})});
 arrow(s,3.3,2.7,4.08,3.13);arrow(s,3.3,4.48,4.08,3.9);arrow(s,6.72,3.52,7.67,3.52);arrow(s,10.06,3.52,10.77,3.52);
 txt(s,'Catálogo e fotos locais',.88,5.56,2.3,.28,10,C.muted,{align:'center'});txt(s,'Realtime atualiza pedidos no painel',7.7,4.68,3.2,.32,10,C.muted,{align:'center'});arrow(s,9.05,4.35,9.05,4.62,C.olive);
}
// 8
{
 const s=base('07 · Arquitetura técnica','Responsabilidades bem separadas','A interface cuida da interação; o banco aplica as regras que precisam valer para todos os clientes.');
 card(s,.75,2.08,3.78,2.02,'Interface','Rotas públicas, área do visitante, painel, calendário e telas Expo Router.',C.clay);
 card(s,4.78,2.08,3.78,2.02,'Serviços','Centralizam consultas, RPCs, contato e assinatura de eventos.',C.olive);
 card(s,8.81,2.08,3.78,2.02,'Banco','Postgres guarda perfis, atividades, programação, horários e auditoria.',C.green2);
 rect(s,.78,4.62,11.8,1.0,C.green,{r:.12});
 txt(s,'WEB',1.1,4.87,.75,.28,10,'D9C99F',{bold:true,charSpacing:1});txt(s,'React 19 · Vite 8 · Supabase JS',2.0,4.82,3.3,.37,13,C.white,{bold:true});
 txt(s,'MOBILE',6.2,4.87,.95,.28,10,'D9C99F',{bold:true,charSpacing:1});txt(s,'Expo 58 · React Native 0.88 · TypeScript',7.25,4.82,4.85,.37,13,C.white,{bold:true});
 txt(s,'Catálogo e imagens empacotados permitem navegar localmente. Login, pedidos e agenda real dependem do Supabase configurado.',.9,6.05,11.55,.48,12,C.muted,{align:'center'});
}
// 9
{
 const s=base('08 · Modelo de dados','Uma programação agrupa atividades e horários','O banco mantém relações explícitas para permitir acompanhamento, capacidade e histórico.');
 const data=[{x:.7,y:2.15,w:2.2,h:.83,t:'profiles',d:'visitante · guia · admin'},{x:3.55,y:2.15,w:2.25,h:.83,t:'experiences',d:'catálogo e limite por grupo'},{x:6.43,y:2.15,w:2.5,h:.83,t:'visit_programs',d:'programação do cliente'},{x:9.55,y:2.15,w:2.75,h:.83,t:'bookings',d:'itens, horário e situação'}];
 data.forEach((n,i)=>{rect(s,n.x,n.y,n.w,n.h,i===3?C.green2:C.paper,{line:i===3?C.green2:C.line});txt(s,n.t,n.x+.14,n.y+.13,n.w-.28,.25,14,i===3?C.white:C.green,{bold:true,align:'center'});txt(s,n.d,n.x+.1,n.y+.48,n.w-.2,.21,9,i===3?'E5EBE2':C.muted,{align:'center'})});
 arrow(s,2.95,2.56,3.5,2.56);arrow(s,5.85,2.56,6.38,2.56);arrow(s,8.98,2.56,9.5,2.56);
 card(s,.85,3.75,3.6,1.5,'availability_slots','Horários publicados, capacidade e atividade.',C.olive);
 card(s,4.86,3.75,3.6,1.5,'seasons + exceptions','Regras de mês/dia e exceções específicas.',C.clay);
 card(s,8.87,3.75,3.6,1.5,'booking_events','Auditoria de criação e alterações.',C.green2);
 txt(s,'Cliente recebe um código legível RAP-000001; UUIDs são usados internamente.',.9,5.9,11.4,.32,12,C.green2,{bold:true,align:'center'});
}
// 10
{
 const s=base('09 · Segurança e integridade','Permissões e vagas são verificadas no servidor','A proteção é aplicada no banco, além do que a tela mostra.');
 const rows=[['Identidade','Supabase Auth; senha não é guardada na tabela de perfil.'],['Escopo de leitura','RLS: cliente vê os próprios pedidos; guia vê pedidos atribuídos; admin tem visão geral.'],['Capacidade','RPC transacional bloqueia o horário, soma pedidos ativos e rejeita excesso de vagas.'],['Privacidade','Consentimento para dados do pedido; alergias, dieta e acessibilidade são campos controlados.'],['Auditoria','Mudanças de status e itens geram eventos consultáveis conforme permissão.']];
 rows.forEach((a,i)=>{let y=2.05+i*.73;rect(s,.8,y,2.15,.5,i%2?C.mint:C.pale,{r:.1});txt(s,a[0],.96,y+.11,1.82,.26,12,C.green,{bold:true});txt(s,a[1],3.25,y+.07,8.9,.37,12,C.ink)});
}
// 11
{
 const s=base('10 · Regras de negócio','O pedido respeita época, disponibilidade e limite','A reserva de vagas ocorre de forma atômica, inclusive quando há pedidos simultâneos.');
 const labels=[['1','Gestão publica horário futuro'],['2','Visitante vê apenas horários ativos com vagas'],['3','Banco confere época e limite por atividade'],['4','Bloqueia linha do horário durante a transação'],['5','Grava pedido como solicitado']];
 labels.forEach((a,i)=>{let x=.76+i*2.48;rect(s,x,2.62,2.12,1.45,i===4?C.green2:C.paper,{line:i===4?C.green2:C.line});txt(s,a[0],x+.12,2.82,.35,.28,12,i===4?C.gold:C.clay,{bold:true});txt(s,a[1],x+.12,3.25,1.87,.57,11,i===4?C.white:C.green,{bold:true,align:'center',valign:'mid'});if(i<4)arrow(s,x+2.14,3.36,x+2.42,3.36)});
 rect(s,.85,4.75,11.6,.9,C.rose,{r:.12});txt(s,'Uma programação pode reunir até 10 horários.',1.1,4.98,4.35,.35,15,C.clay,{bold:true});txt(s,'Se um item não tiver vaga ou não respeitar as regras, a operação inteira falha — sem programação parcial.',5.15,4.95,6.9,.48,12,C.ink);
 txt(s,'Solicitações e confirmações ocupam capacidade; cancelamentos liberam vagas. Exceção de data prevalece sobre regra recorrente.',.95,6.0,11.3,.42,11,C.muted,{align:'center'});
}
// 12
{
 const s=base('11 · Operação e continuidade','Demonstração local e operação real são diferentes','A experiência sem backend serve para apresentar telas e testar a organização.');
 rect(s,.78,2.1,5.7,2.65,C.pale,{r:.12});pill(s,'SEM SUPABASE',1.05,2.37,1.55,C.white,C.muted);txt(s,'Prévia local',1.05,2.92,4.9,.42,23,C.green,{bold:true});txt(s,'• Catálogo navegável\n• Calendário e exemplos fictícios\n• Alterações da gestão demo no navegador\n• Pedidos não são enviados nem salvos no servidor',1.08,3.55,4.8,1.0,13,C.ink,{valign:'top',breakLine:false});
 rect(s,6.82,2.1,5.7,2.65,C.mint,{r:.12});pill(s,'SUPABASE CONFIGURADO',7.09,2.37,2.2,C.white,C.green2);txt(s,'Operação conectada',7.09,2.92,4.9,.42,23,C.green,{bold:true});txt(s,'• Contas e permissões reais\n• Disponibilidade e pedidos persistidos\n• Atualização do painel por Realtime\n• WhatsApp é preparado para revisão; envio manual',7.12,3.55,4.8,1.0,13,C.ink,{valign:'top',breakLine:false});
 txt(s,'Preparação: aplicar migrações em ordem, configurar URL e chave pública, promover admin e publicar a função segura de criação de guias.',.95,5.38,11.5,.62,13,C.green2,{bold:true,align:'center'});
}
// 13
{
 const s=base('12 · Leitura do produto','O que a plataforma já faz — e o que depende da comunidade','Uma visão honesta do estado atual protege a expectativa de visitantes e anfitriões.');
 card(s,.8,2.05,5.62,2.18,'Implementado','Catálogo web e móvel, login, formulário, histórico, calendário, regras sazonais, capacidade, permissões e trilha de auditoria.',C.green2);
 card(s,6.82,2.05,5.62,2.18,'Ação humana mantida','A comunidade informa o preço, alinha detalhes e confirma a visita. Mensagens não são enviadas automaticamente.',C.clay);
 card(s,.8,4.62,5.62,1.55,'Dependências de produção','Configuração do projeto Supabase, migrações, contas da gestão, disponibilidade real e validação das regras locais.',C.olive);
 card(s,6.82,4.62,5.62,1.55,'Cuidados de conteúdo','Confirmar contatos, textos, condições e logística com anfitriões antes de divulgar como atual.',C.gold);
}
// 14
{
 const s=pptx.addSlide();s.background={color:C.green};s.addImage({path:img('serra.jpg'),x:7.45,y:0,w:5.88,h:7.5,sizingCrop:true,transparency:10});s.addShape(pptx.ShapeType.rect,{x:0,y:0,w:8.3,h:7.5,line:{transparency:100},fill:{color:C.green,transparency:0}});s.addShape(pptx.ShapeType.rect,{x:6.8,y:0,w:1.8,h:7.5,line:{transparency:100},fill:{color:C.green,transparency:25}});
 txt(s,'UMA VISITA COMEÇA COM RESPEITO',.82,.8,6,.25,10,'D9C99F',{bold:true,charSpacing:1.6});txt(s,'Tecnologia organiza.\nA comunidade conduz.',.82,1.68,6.1,1.25,34,C.white,{bold:true,fontFace:'Aptos Display',valign:'top'});rect(s,.85,3.25,.62,.055,C.gold,{r:.02});txt(s,'Raposa I · Normandia, Roraima',.85,3.63,5.8,.4,16,'E6E9DC');txt(s,'10 vivências · site e app · gestão comunitária',.85,4.17,5.9,.35,13,'D9C99F');txt(s,'Apresentação do funcionamento do sistema',.85,6.72,6.1,.24,10,'D9C99F',{charSpacing:.8});
}

const out=path.resolve('apresentacao/Raposa-I-visao-do-sistema.pptx')
await pptx.writeFile({fileName:out})
console.log(out)
