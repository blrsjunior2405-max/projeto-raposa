// Esta tela reúne o catálogo público; em /gestao ela entrega o controle ao painel comunitário.
import { useEffect, useMemo, useState } from 'react'
import './App.css'
import './PortalLinks.css'
import { experiences, filters, photos } from './data/experiences'
import ExperienceCard from './components/ExperienceCard'
import ManagementApp from './components/ManagementApp'
import VisitorPortal from './components/VisitorPortal'
import { supabase } from './lib/supabase'
import { getCommunityWhatsApp } from './services/communitySettings'

function App() {
  const [communityWhatsApp, setCommunityWhatsApp] = useState('559584262222')
  // Estas escolhas guardam a navegação atual sem duplicar os dados fixos do catálogo.
  const [activeCategory, setActiveCategory] = useState('Todas')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  // A lista exibida é calculada a partir dos filtros para acompanhar a busca imediatamente.
  const visible = useMemo(() => experiences.filter((item) => (activeCategory === 'Todas' || item.category === activeCategory) && `${item.title} ${item.short} ${item.category}`.toLowerCase().includes(query.toLowerCase())), [activeCategory, query])
  const selectedExperience = experiences.find((item) => item.id === selected)
  const scrollToExperiences = () => { setSelected(null); document.getElementById('experiencias')?.scrollIntoView({ behavior:'smooth' }); setMenuOpen(false) }

  useEffect(() => {
    let active = true
    async function loadCommunityContact() {
      if (!supabase) return
      const { data, error } = await getCommunityWhatsApp(supabase)
      if (error) {
        console.error('Não foi possível carregar o WhatsApp da comunidade.', error)
        return
      }
      if (active && data?.whatsapp_phone) setCommunityWhatsApp(data.whatsapp_phone)
    }
    loadCommunityContact()
    return () => { active = false }
  }, [])

  const formattedCommunityWhatsApp = communityWhatsApp.startsWith('55') && communityWhatsApp.length === 13
    ? `+55 (${communityWhatsApp.slice(2, 4)}) ${communityWhatsApp.slice(4, 9)}-${communityWhatsApp.slice(9)}`
    : communityWhatsApp.startsWith('55') && communityWhatsApp.length === 12
      ? `+55 (${communityWhatsApp.slice(2, 4)}) ${communityWhatsApp.slice(4, 8)}-${communityWhatsApp.slice(8)}`
      : `+${communityWhatsApp}`

  // O mesmo site separa a vitrine pública do painel protegido usado pela comunidade.
  if (window.location.pathname.startsWith('/area-visitante')) return <VisitorPortal />
  if (window.location.pathname.startsWith('/gestao')) return <ManagementApp />

  return <div className="site-shell">
    <div className="announcement"><span className="announcement-dot"/> TERRITÓRIO MACUXI · NORMANDIA, RORAIMA <span className="announcement-right">Turismo de base comunitária <span>✳</span></span></div>
    <header className="topbar">
      <a className="brand" href="#inicio" onClick={() => setSelected(null)} aria-label="Voltar ao início"><span className="brand-mark">R<span>✳</span></span><span className="brand-name">RAPOSA I<small>experiências da comunidade</small></span></a>
      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Alternar navegação">☰</button>
      <nav className={menuOpen ? 'nav-links nav-open' : 'nav-links'}><a href="#experiencias" onClick={scrollToExperiences}>Experiências</a><a href="#comunidade" onClick={() => setMenuOpen(false)}>A comunidade</a><a href="#visita" onClick={() => setMenuOpen(false)}>Planeje sua visita</a><a className="nav-management" href="/gestao" onClick={() => setMenuOpen(false)}>Gestão</a><a className="nav-cta" href="/area-visitante" onClick={() => setMenuOpen(false)}>Área do visitante <span>↗</span></a></nav>
    </header>

    {/* A página de detalhe destaca a foto, descrição, recomendações e contato da vivência escolhida. */}
    {selectedExperience ? <main className="detail-page">
      <button className="back-link" onClick={() => setSelected(null)}>← Voltar às experiências</button>
      <div className="detail-grid"><section className="detail-copy"><span className="eyebrow">{selectedExperience.category} <span>·</span> RAPOSA I</span><h1>{selectedExperience.title}</h1><p className="detail-intro">{selectedExperience.short}</p><div className={`trailer trailer-${selectedExperience.scene}`} style={{backgroundImage:`linear-gradient(0deg, rgba(22,37,26,.55), transparent 48%), url("${photos[selectedExperience.scene]}")`}}><div className="trailer-play" aria-hidden="true">◉</div><div className="trailer-caption"><small>REGISTRO FOTOGRÁFICO DA VIVÊNCIA</small><span>{selectedExperience.title}</span></div><span className="trailer-tag">FOTO DO CATÁLOGO 2023</span></div><div className="detail-description"><h2>Sobre a vivência</h2><p>{selectedExperience.description}</p></div><div className="detail-description"><h2>Recomendações e atenção</h2><p>{selectedExperience.advice}</p></div><p className="media-note">Fotografia extraída do Catálogo de Experiências da Comunidade Indígena Raposa I (2023).</p></section>
      <aside className="booking-card"><span className="eyebrow">SUA VISITA</span><h2>Vamos combinar?</h2><p className="price-note">A comunidade informará o preço ao entrar em contato após seu pedido.</p><div className="booking-meta"><div><span>DURAÇÃO</span><b>{selectedExperience.duration}</b></div><div><span>GRUPO</span><b>{selectedExperience.people}</b></div></div><div className="includes"><span>O QUE ESTÁ INCLUÍDO</span><p>{selectedExperience.includes}</p></div><a className="button button-primary button-full" href={`/area-visitante?experience=${selectedExperience.id}`}>Abrir app do visitante <span>↗</span></a><p className="request-note">Escolha um horário publicado pela comunidade. A visita depende de confirmação dos anfitriões.</p><div className="contact-mini"><span>ANFITRIÃO DA COMUNIDADE</span><b>Enoque Raposo</b><a href="https://www.instagram.com/etnoturismo.raposa23/" target="_blank" rel="noreferrer">Instagram @etnoturismo.raposa23 ↗</a><a href={`https://wa.me/${communityWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp {formattedCommunityWhatsApp} ↗</a></div></aside></div>
    </main> : <>
      <section id="inicio" className="hero" style={{backgroundImage:`linear-gradient(90deg, rgba(19,35,25,.76), rgba(19,35,25,.21) 75%), linear-gradient(0deg, rgba(19,35,25,.26), transparent 62%), url("${photos.hero}")`}}><div className="hero-text"><span className="eyebrow light"><span className="eyebrow-line"/> TURISMO DE BASE COMUNITÁRIA · RORAIMA</span><h1>Um lugar para<br/>viver <em>de perto.</em></h1><p>Trilhas, sabores e saberes compartilhados por quem chama a Raposa I de casa.</p><a className="button button-light" href="#experiencias" onClick={() => setMenuOpen(false)}>Descubra as experiências <span>↓</span></a><div className="hero-location"><span>◉</span> NORMANDIA · TERRA INDÍGENA RAPOSA SERRA DO SOL</div></div><div className="hero-count"><span>10</span><small>vivências<br/>comunitárias</small></div><span className="hero-image-credit">FOTO DO CATÁLOGO 2023</span></section>
      <div className="values-strip"><span><i>✳</i> Conduzido pela comunidade</span><span><i>↟</i> Natureza com respeito</span><span><i>◉</i> Saberes compartilhados</span><span><i>⌁</i> Ritmo combinado com os anfitriões</span></div>
      {/* Busca, categorias e cartões usam o catálogo local; o detalhe abre ao selecionar um cartão. */}
      <section id="experiencias" className="experiences-section"><div className="section-heading"><div><span className="eyebrow">ESCOLHA SUA VIVÊNCIA</span><h2>Experiências <em>com significado.</em></h2><p>Conheça o que a comunidade compartilha. Cada visita é combinada diretamente com os anfitriões.</p></div><div className="results-count">{visible.length.toString().padStart(2,'0')} <span>EXPERIÊNCIAS</span></div></div><div className="explore-controls"><div className="filters">{filters.map((filter) => <button key={filter} className={activeCategory === filter ? 'filter active' : 'filter'} onClick={() => setActiveCategory(filter)}>{filter}</button>)}</div><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar uma experiência"/><kbd>⌘ K</kbd></label></div><div className="experience-grid">{visible.map((item, index) => <ExperienceCard key={item.id} activity={item} image={photos[item.scene]} index={index} onOpen={(activity) => setSelected(activity.id)} />)}</div>{visible.length === 0 && <div className="empty-state">Não encontramos essa vivência. Tente outro termo ou categoria.</div>}<p className="catalog-note">Atividades e orientações resumidas do <a href="https://www.gov.br/turismo/pt-br/acesso-a-informacao/acoes-e-programas/programas-projetos-acoes-obras-e-atividades/experiencias-do-brasil-original/2023-comunidade-indigena-raposa-i.pdf" target="_blank" rel="noreferrer">Catálogo de Experiências da Comunidade Indígena Raposa I (2023) ↗</a>.</p></section>
      {/* Apresenta a comunidade e orienta a visita com respeito às regras locais. */}
      <section id="comunidade" className="community-section"><div className="community-image" style={{backgroundImage:`url("${photos.serra}")`}}><span>O LAVRADO DE RORAIMA</span></div><div className="community-copy"><span className="eyebrow">UM TERRITÓRIO, MUITAS HISTÓRIAS</span><h2>Receber também<br/>é <em>compartilhar.</em></h2><p>A Raposa I é uma comunidade do povo Macuxi, em Normandia. As vivências são conduzidas por anfitriões locais e aproximam visitantes de paisagens, técnicas, alimentos e histórias partilhadas pela própria comunidade.</p><p>Venha com curiosidade, escuta e respeito. A comunidade orienta o que pode ser visitado, fotografado e vivido em cada ocasião.</p><a className="text-link" href="https://www.gov.br/funai/pt-br/atuacao/meio-ambiente/etnodesenvolvimento/instrucao-normativa-no-01-2021" target="_blank" rel="noreferrer">Conheça princípios para visitação responsável <span>↗</span></a></div></section>
      {/* Reúne orientações práticas que o visitante deve confirmar com a comunidade. */}
      <section id="visita" className="visit-section"><div className="visit-heading"><span className="eyebrow">ANTES DE PARTIR</span><h2>Planeje com <em>calma.</em></h2><p>A visita depende de alinhamento com os anfitriões. Escolha um horário publicado e aguarde a confirmação antes de viajar.</p></div><div className="visit-cards"><article><span className="visit-number">01</span><h3>Abra o app do visitante</h3><p>Monte a programação no app móvel com horários publicados. O pedido não confirma a visita; aguarde a resposta dos anfitriões antes de viajar.</p></article><article><span className="visit-number">02</span><h3>Prepare a jornada</h3><p>O catálogo informa cerca de 240 km desde Boa Vista e recomenda veículo 4×4. Confirme a condição da estrada e o transporte atual.</p></article><article><span className="visit-number">03</span><h3>Leve o necessário</h3><p>Água, proteção solar e repelente são boas companhias. Avise com antecedência sobre alergias, necessidades alimentares ou de acessibilidade.</p></article></div><div className="visit-season"><span>◷</span><p><b>Época sugerida no catálogo</b><br/>Outubro a março tende a ser mais seco. Condições variam; confirme a previsão e a situação local perto da data.</p><a href="https://www.instagram.com/etnoturismo.raposa23/" target="_blank" rel="noreferrer">Pergunte aos anfitriões ↗</a></div></section>
      {/* Sugestões de evolução apresentam ideias sem prometer funções ainda não implantadas. */}
      <section className="improve-section"><div><span className="eyebrow">PRÓXIMO PASSO</span><h2>Uma agenda que cresce<br/>com a comunidade.</h2></div><div className="improve-copy"><p>Para transformar este protótipo em uma agenda de reservas real, sugerimos adicionar confirmação de disponibilidade pelos anfitriões, cadastro de datas e limites por experiência, vídeos próprios autorizados, idiomas e recursos de acessibilidade.</p><p>Um calendário coletivo pode evitar sobreposição de visitas e respeitar a capacidade de cada vivência. Gastronomia e artesanato podem ganhar uma seção de encomendas, sempre com preço e disponibilidade confirmados localmente.</p><a href="https://www.airbnb.com/help/article/2493" target="_blank" rel="noreferrer">Referência de fluxo de reserva por data e participantes ↗</a></div></section>
    </>}

    {/* O rodapé mantém canais de contato e acesso ao painel disponíveis em todas as telas. */}
    <footer className="footer"><div className="footer-top"><a className="brand brand-footer" href="#inicio"><span className="brand-mark">R<span>✳</span></span><span className="brand-name">RAPOSA I<small>experiências da comunidade</small></span></a><p>Uma visita começa com respeito.<br/>A conversa começa por aqui.</p><div className="footer-contact"><span>FALE COM A COMUNIDADE</span><a href={`https://wa.me/${communityWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp {formattedCommunityWhatsApp} ↗</a><a href="https://www.instagram.com/etnoturismo.raposa23/" target="_blank" rel="noreferrer">Instagram @etnoturismo.raposa23 ↗</a></div></div><div className="footer-bottom"><span>RAPOSA I · NORMANDIA, RORAIMA</span><span>Conteúdo das atividades baseado no catálogo oficial de 2023.</span><span>PREÇO INFORMADO PELA COMUNIDADE</span><a href="/gestao">Acesso da comunidade ↗</a></div></footer>

    <a className="whatsapp-float" href={`https://wa.me/${communityWhatsApp}`} target="_blank" rel="noreferrer" aria-label="Abrir WhatsApp da comunidade">◔</a>
  </div>
}

export default App
