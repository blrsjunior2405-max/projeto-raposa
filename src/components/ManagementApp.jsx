// Painel web da comunidade: autentica as pessoas e conversa com o Supabase para gerir agenda e equipe.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { addProgramItem, assignBookingGuide, getExperienceAvailabilityExceptions, getExperienceAvailabilityRules, getManagementBookings, removeExperienceAvailabilityException, removeProgramItem, saveExperienceAvailabilityException, saveExperienceAvailabilityRules, subscribeToBookingChanges, updateBookingStatus } from '../services/communitySchedule'
import { getCommunityWhatsApp, updateCommunityWhatsApp } from '../services/communitySettings'
import ManagementCalendar from '../features/management/ManagementCalendar'
import { createDemoBookings, groupDemoBookingsByCustomer } from '../features/management/demoBookings'
import { getCalendarDateKey } from '../features/management/calendarUtils'
import { experiences } from '../data/experiences'
import './ManagementApp.css'
import './CommunityContact.css'
import '../PortalLinks.css'

const statusLabels = { requested: 'Pendente', confirmed: 'Confirmado', cancelled: 'Cancelado', completed: 'Concluído' }
// Os valores internos seguem o banco; estes rótulos são os nomes apresentados às pessoas.
const visibleStatuses = ['requested', 'confirmed', 'cancelled', 'completed']
const defaultCommunityWhatsApp = '559584262222'
const seasonMonths = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const seasonWeekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']
const demoBookingsStorageKey = 'raposa-community-demo-bookings-v1'

// Traduz erros comuns do serviço para que a equipe receba orientação em português.
function mensagemDeErro(error) {
  const texto = error?.message?.toLocaleLowerCase('pt-BR') || ''
  if (texto.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (texto.includes('email not confirmed')) return 'Confirme o e-mail antes de entrar.'
  if (texto.includes('already registered')) return 'Este e-mail já possui um cadastro.'
  if (texto.includes('época') || texto.includes('disponível nesta data')) return 'A atividade não está liberada nessa data. Revise as regras sazonais ou cadastre uma exceção.'
  if (texto.includes('vagas suficientes')) return 'Não há vagas suficientes neste horário para o grupo informado.'
  if (texto.includes('participantes')) return 'Informe uma quantidade de participantes dentro do limite da atividade.'
  if (texto.includes('programação')) return 'Não foi possível alterar esta programação. Atualize os dados e tente novamente.'
  if (texto.includes('fetch') || texto.includes('network')) return 'Sem conexão com o serviço. Tente novamente.'
  return 'Não foi possível concluir esta ação. Confira a conexão e tente novamente.'
}

function formatWhatsAppPhone(value) {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith('55') && digits.length === 13) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  if (digits.startsWith('55') && digits.length === 12) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`
  }
  return `+${digits}`
}

function getLocalDateKey() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export default function ManagementApp() {
  // Cada estado abaixo alimenta uma parte do painel: identidade, pedidos, equipe, filtros e formulários.
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [bookings, setBookings] = useState([])
  const [people, setPeople] = useState([])
  const [activities, setActivities] = useState([])
  const [slots, setSlots] = useState([])
  const [availabilityRules, setAvailabilityRules] = useState([])
  const [availabilityExceptions, setAvailabilityExceptions] = useState([])
  const [communityWhatsApp, setCommunityWhatsApp] = useState(defaultCommunityWhatsApp)
  const [assignedActivities, setAssignedActivities] = useState([])
  const [filters, setFilters] = useState({ guide: 'all', activity: 'all', status: 'all', query: '' })
  const [login, setLogin] = useState({ email: '', password: '' })
  const [guideForm, setGuideForm] = useState({ full_name: '', email: '', phone: '', password: '', experience_ids: [] })
  const [slotForm, setSlotForm] = useState({ experience_id: '', starts_at: '', capacity: '10' })
  const [seasonForm, setSeasonForm] = useState({ experienceId: '', months: [], weekdays: [] })
  const [exceptionForm, setExceptionForm] = useState({ experienceId: '', date: '', isAvailable: true, note: '' })
  const [programEdit, setProgramEdit] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [liveUpdates, setLiveUpdates] = useState(false)

  // Mantém a tela sincronizada com o login feito neste navegador.
  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener.subscription.unsubscribe()
  }, [])

  // Busca dados pelo perfil conectado; as permissões do banco limitam o que cada guia consegue receber.
  const loadDashboard = useCallback(async () => {
    if (!supabase || !session?.user) return
    setBusy(true)
    setMessage('')
    const { data: myProfile, error: profileError } = await supabase.from('profiles').select('id, full_name, phone, role, customer_code').eq('id', session.user.id).single()
    if (profileError) {
      setMessage(mensagemDeErro(profileError))
      setBusy(false)
      return
    }
    setProfile(myProfile)
    if (!['guide', 'community_admin'].includes(myProfile.role)) {
      setBusy(false)
      return
    }

    // Administradores recebem cadastros e atribuições; guias recebem somente suas próprias atividades.
    const activityQuery = supabase.from('experiences').select('id, title, category, max_participants').eq('is_active', true).order('title')
    const bookingsQuery = getManagementBookings(supabase)
    const requests = [activityQuery, bookingsQuery]
    if (myProfile.role === 'community_admin') {
      requests.push(supabase.from('profiles').select('id, full_name, phone, role, customer_code, created_at').in('role', ['visitor', 'guide']).order('full_name'))
      requests.push(supabase.from('guide_experiences').select('guide_id, experience:experiences!guide_experiences_experience_id_fkey(id, title, category)'))
      requests.push(supabase.from('experience_slots').select('id, experience_id, starts_at, capacity, is_active, experience:experiences!experience_slots_experience_id_fkey(title)').gte('starts_at', new Date().toISOString()).order('starts_at', { ascending: true }))
      requests.push(getCommunityWhatsApp(supabase))
    } else {
      requests.push(supabase.from('guide_experiences').select('experience:experiences!guide_experiences_experience_id_fkey(id, title, category)').eq('guide_id', session.user.id))
    }
    const [activityResult, bookingResult, peopleResult, guideActivityResult, slotResult, settingsResult] = await Promise.all(requests)
    const error = activityResult.error || bookingResult.error || peopleResult.error || guideActivityResult?.error || slotResult?.error || settingsResult?.error
    if (error) setMessage(mensagemDeErro(error))
    setActivities(activityResult.data || [])
    setBookings(bookingResult.data || [])
    if (myProfile.role === 'community_admin') {
      setSlots(slotResult?.data || [])
      if (settingsResult?.data) setCommunityWhatsApp(settingsResult.data.whatsapp_phone)
      const [rulesResult, exceptionsResult] = await Promise.all([
        getExperienceAvailabilityRules(supabase),
        getExperienceAvailabilityExceptions(supabase),
      ])
      if (rulesResult.error || exceptionsResult.error) setMessage(mensagemDeErro(rulesResult.error || exceptionsResult.error))
      setAvailabilityRules(rulesResult.data || [])
      setAvailabilityExceptions(exceptionsResult.data || [])
      const assignments = guideActivityResult?.data || []
      setPeople((peopleResult.data || []).map((person) => ({
        ...person,
        experiences: assignments.filter((assignment) => assignment.guide_id === person.id).map((assignment) => assignment.experience).filter(Boolean),
      })))
    }
    else setAssignedActivities((peopleResult.data || []).map((item) => item.experience).filter(Boolean))
    setBusy(false)
  }, [session])

  useEffect(() => { loadDashboard() }, [loadDashboard])

  useEffect(() => {
    if (!supabase || !['guide', 'community_admin'].includes(profile?.role)) return undefined

    let active = true
    let refreshTimeout
    const unsubscribe = subscribeToBookingChanges(supabase, () => {
      if (!active) return
      window.clearTimeout(refreshTimeout)
      refreshTimeout = window.setTimeout(() => { void loadDashboard() }, 250)
    }, (status) => {
      if (!active) return
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setLiveUpdates(false)
        setMessage('Atualização automática indisponível. Use “Atualizar” para buscar os pedidos mais recentes.')
      }
      if (status === 'SUBSCRIBED') {
        setLiveUpdates(true)
        setMessage((current) => current.startsWith('Atualização automática indisponível.') ? '' : current)
      }
    })

    return () => {
      active = false
      window.clearTimeout(refreshTimeout)
      unsubscribe()
    }
  }, [loadDashboard, profile?.role])

  // As listas e totais abaixo são derivados dos dados recebidos, evitando manter cópias desatualizadas.
  const guides = useMemo(() => people.filter((person) => person.role === 'guide'), [people])
  const clients = useMemo(() => people.filter((person) => person.role === 'visitor'), [people])
  const activityOptions = profile?.role === 'community_admin' ? activities : assignedActivities
  const filteredBookings = useMemo(() => bookings.filter((booking) => {
    if (filters.activity !== 'all' && booking.experience_id !== filters.activity) return false
    if (filters.status !== 'all' && booking.status !== filters.status) return false
    if (profile?.role === 'community_admin' && filters.guide !== 'all' && booking.guide_id !== filters.guide) return false
    const query = filters.query.trim().toLocaleLowerCase('pt-BR')
    if (query && !`${booking.customer?.full_name || ''} ${booking.customer?.phone || ''} ${booking.customer?.customer_code || ''} ${booking.experience?.title || ''}`.toLocaleLowerCase('pt-BR').includes(query)) return false
    return true
  }), [bookings, filters, profile])

  // Conta pedidos, visitantes únicos, participantes e confirmações dentro dos filtros atuais.
  const apuracao = useMemo(() => {
    const totals = new Map()
    for (const booking of filteredBookings) {
      const item = totals.get(booking.experience_id) || { title: booking.experience?.title || 'Experiência', bookings: 0, customers: new Set(), participants: 0, confirmed: 0, requested: 0 }
      item.bookings += 1
      item.customers.add(booking.customer_id)
      item.participants += booking.participants
      if (booking.status === 'confirmed') item.confirmed += 1
      if (booking.status === 'requested') item.requested += 1
      totals.set(booking.experience_id, item)
    }
    return [...totals.entries()].map(([id, item]) => ({ id, ...item, customers: item.customers.size }))
      .sort((left, right) => left.title.localeCompare(right.title, 'pt-BR'))
  }, [filteredBookings])

  // Inicia sessão usando a conta individual cadastrada para administradores ou guias.
  async function signIn(event) {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setMessage('')
    const { error } = await supabase.auth.signInWithPassword(login)
    if (error) setMessage(mensagemDeErro(error))
    setBusy(false)
  }

  // Encerra a sessão e limpa os dados pessoais que estavam carregados nesta tela.
  async function signOut() {
    await supabase?.auth.signOut()
    setProfile(null)
    setBookings([])
    setPeople([])
    setSlots([])
  }

  // A gestão vincula o pedido a um guia habilitado para aquela experiência.
  async function assignGuide(bookingId, guideId) {
    const { error } = await assignBookingGuide(supabase, bookingId, guideId)
    setMessage(error ? mensagemDeErro(error) : 'Guia atualizado.')
    if (!error) await loadDashboard()
  }

  // O administrador atualiza o pedido diretamente; o guia usa uma função que confere sua atribuição.
  async function setBookingStatus(bookingId, nextStatus) {
    const { error } = await updateBookingStatus(supabase, profile.role, bookingId, nextStatus)
    setMessage(error ? mensagemDeErro(error) : 'Situação da visita atualizada.')
    if (!error) await loadDashboard()
  }

  async function createAvailabilitySlot(event) {
    event.preventDefault()
    const startsAt = new Date(slotForm.starts_at)
    const capacity = Number(slotForm.capacity)
    const activity = activities.find((item) => item.id === slotForm.experience_id)
    if (!activity || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setMessage('Escolha uma experiência e um horário futuro.')
      return
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100 || (activity.max_participants && capacity > activity.max_participants)) {
      setMessage(`Informe uma capacidade válida${activity.max_participants ? ` (máximo ${activity.max_participants})` : ''}.`)
      return
    }

    setBusy(true)
    const { error } = await supabase.from('experience_slots').insert({
      experience_id: slotForm.experience_id,
      starts_at: startsAt.toISOString(),
      capacity,
    })
    setMessage(error
      ? error.code === '23505' ? 'Já existe um horário cadastrado para esta experiência.'
        : error.message?.includes('não está disponível nesta data') ? 'Esta experiência não está liberada nessa data. Ajuste a época ou cadastre uma exceção antes de publicar.'
          : mensagemDeErro(error)
      : 'Horário publicado para os visitantes.')
    if (!error) {
      setSlotForm({ experience_id: '', starts_at: '', capacity: '10' })
      await loadDashboard()
    }
    setBusy(false)
  }

  async function setSlotActive(slotId, isActive) {
    const { error } = await supabase.from('experience_slots').update({ is_active: isActive }).eq('id', slotId)
    setMessage(error ? mensagemDeErro(error) : isActive ? 'Horário publicado.' : 'Horário retirado da lista pública.')
    if (!error) await loadDashboard()
  }

  // Preenche o formulário recorrente com os meses e dias já salvos para a atividade selecionada.
  function chooseSeasonExperience(experienceId) {
    const rules = availabilityRules.filter((rule) => rule.experience_id === experienceId)
    setSeasonForm({
      experienceId,
      months: [...new Set(rules.map((rule) => rule.month))],
      weekdays: [...new Set(rules.map((rule) => rule.weekday))],
    })
  }

  function toggleSeasonValue(field, value) {
    setSeasonForm((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((item) => item !== value)
        : [...current[field], value].sort((left, right) => left - right),
    }))
  }

  // Substitui a regra anterior; listas vazias deixam a atividade indisponível sem exceções.
  async function saveSeason(event) {
    event.preventDefault()
    if (!seasonForm.experienceId) return
    if ((!seasonForm.months.length || !seasonForm.weekdays.length)
      && !window.confirm('Sem meses ou dias selecionados, a atividade ficará indisponível em todas as datas sem exceção. Deseja salvar?')) return
    setBusy(true)
    const { error } = await saveExperienceAvailabilityRules(supabase, seasonForm.experienceId, seasonForm.months, seasonForm.weekdays)
    setMessage(error ? mensagemDeErro(error) : 'Época recorrente atualizada.')
    if (!error) await loadDashboard()
    setBusy(false)
  }

  async function saveException(event) {
    event.preventDefault()
    if (!exceptionForm.experienceId || !exceptionForm.date) return
    setBusy(true)
    const { error } = await saveExperienceAvailabilityException(supabase, exceptionForm)
    setMessage(error ? mensagemDeErro(error) : 'Exceção de calendário salva.')
    if (!error) {
      setExceptionForm((current) => ({ ...current, date: '', note: '' }))
      await loadDashboard()
    }
    setBusy(false)
  }

  async function deleteException(exceptionId) {
    if (!window.confirm('Remover esta exceção? O calendário voltará a seguir a regra recorrente da atividade.')) return
    setBusy(true)
    const { error } = await removeExperienceAvailabilityException(supabase, exceptionId)
    setMessage(error ? mensagemDeErro(error) : 'Exceção removida.')
    if (!error) await loadDashboard()
    setBusy(false)
  }

  // As RPCs conferem permissões e vagas novamente no banco antes de alterar a programação.
  async function appendProgramItem(event) {
    event.preventDefault()
    if (!programEdit?.programId || !programEdit.slotId) return
    if (!window.confirm('Adicionar esta atividade à programação do cliente?')) return
    setBusy(true)
    const { error } = await addProgramItem(supabase, {
      programId: programEdit.programId,
      slotId: programEdit.slotId,
      participants: Number(programEdit.participants),
    })
    setMessage(error ? mensagemDeErro(error) : 'Atividade adicionada à programação.')
    if (!error) {
      setProgramEdit(null)
      await loadDashboard()
    }
    setBusy(false)
  }

  async function deleteProgramItem(booking) {
    if (!window.confirm(`Cancelar “${booking.experience?.title || 'esta atividade'}” da programação? O registro será mantido no histórico e as vagas serão liberadas.`)) return
    setBusy(true)
    const { error } = await removeProgramItem(supabase, booking.id)
    setMessage(error ? mensagemDeErro(error) : 'Atividade cancelada e registrada no histórico.')
    if (!error) await loadDashboard()
    setBusy(false)
  }

  function shareProgramWithCustomer(booking) {
    let phone = booking.customer?.phone?.replace(/\D/g, '') || ''
    if (phone.length === 10 || phone.length === 11) phone = `55${phone}`
    if (!/^[1-9]\d{9,14}$/.test(phone)) {
      setMessage('Este cliente ainda não informou um telefone válido para WhatsApp.')
      return
    }
    const items = bookings.filter((item) => item.program_id === booking.program_id)
    const lines = items.map((item) => `• ${item.experience?.title || 'Atividade'} — ${new Date(item.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })} — ${statusLabels[item.status]}`)
    const text = `Olá, ${booking.customer?.full_name || 'tudo bem'}! Segue a programação ${booking.customer?.customer_code ? `(${booking.customer.customer_code}) ` : ''}da sua visita:\n${lines.join('\n')}\n\nA comunidade confirmará os detalhes e o preço por este contato.`
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer')
  }

  async function saveCommunityWhatsApp(event) {
    event.preventDefault()
    const digits = communityWhatsApp.replace(/\D/g, '')
    if (!/^[1-9]\d{9,14}$/.test(digits)) {
      setMessage('Informe um número de WhatsApp com código do país, DDD e telefone (10 a 15 dígitos).')
      return
    }

    setBusy(true)
    const { error } = await updateCommunityWhatsApp(supabase, digits)
    setMessage(error ? mensagemDeErro(error) : 'WhatsApp de contato atualizado.')
    if (!error) setCommunityWhatsApp(digits)
    setBusy(false)
  }

  // Solicita ao serviço protegido a criação de uma conta de guia e suas atividades autorizadas.
  async function createGuide(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    const { data, error } = await supabase.functions.invoke('create-guide', { body: guideForm })
    if (error) setMessage(mensagemDeErro(error))
    else {
      setMessage(`Acesso criado para ${data.guide.full_name}. Entregue a senha inicial em particular.`)
      setGuideForm({ full_name: '', email: '', phone: '', password: '', experience_ids: [] })
      await loadDashboard()
    }
    setBusy(false)
  }

  // Permite relacionar mais de uma experiência à mesma pessoa guia.
  function toggleGuideActivity(id) {
    setGuideForm((current) => ({
      ...current,
      experience_ids: current.experience_ids.includes(id)
        ? current.experience_ids.filter((item) => item !== id)
        : [...current.experience_ids, id],
    }))
  }

  // Sem credenciais o painel mostra instruções, nunca dados falsos ou acesso simulado.
  if (!supabaseConfigured) return <SetupRequired />
  if (!session) return <LoginScreen login={login} setLogin={setLogin} onSubmit={signIn} busy={busy} message={message} />
  if (profile && !['guide', 'community_admin'].includes(profile.role)) {
    return <div className="management-page"><header className="management-top"><Brand/><button onClick={signOut}>Sair</button></header><section className="access-denied"><span className="eyebrow">ÁREA DA COMUNIDADE</span><h1>Este acesso é para guias e gestão.</h1><p>Entre com a conta individual fornecida pela comunidade. A conta de visitante não acessa dados operacionais.</p><button className="manage-primary" onClick={signOut}>Voltar</button></section></div>
  }

  return <div className="management-page">
    <header className="management-top"><Brand/><div className="account-chip"><span className="account-avatar">{profile?.full_name?.slice(0, 1) || 'R'}</span><div><b>{profile?.full_name || session.user.email}</b><small>{profile?.role === 'community_admin' ? 'Gestão da comunidade' : 'Área do guia'}</small></div><button onClick={signOut}>Sair ↗</button></div></header>
    <main className="management-main">
      {/* A saudação e o botão de atualização acompanham o perfil autenticado. */}
      <div className="management-heading"><div><span className="eyebrow">RAPOSA I · NORMANDIA</span><h1>{profile?.role === 'community_admin' ? 'Gestão de visitas' : 'Minhas visitas'}</h1><p>{profile?.role === 'community_admin' ? 'Pedidos, guias e movimento por experiência.' : 'Pedidos atribuídos a você e às atividades que conduz.'}</p></div><button className="manage-refresh" onClick={loadDashboard}>↻ Atualizar</button></div>
      {message && <div className="manage-message" role="status">{message}</div>}
      {/* Indicadores resumem apenas os pedidos que passam pelos filtros e permissões atuais. */}
      <section className="manage-metrics"><Metric label="PEDIDOS NO FILTRO" value={filteredBookings.length}/><Metric label="VISITANTES ÚNICOS" value={new Set(filteredBookings.map((item) => item.customer_id)).size}/><Metric label="PESSOAS NOS GRUPOS" value={filteredBookings.reduce((sum, item) => sum + item.participants, 0)}/><Metric label="AGUARDANDO RESPOSTA" value={filteredBookings.filter((item) => item.status === 'requested').length}/></section>

      {/* A apuração agrupa clientes e participantes por atividade, guia e situação. */}
      <section className="manage-panel">
        <div className="panel-heading"><div><span className="eyebrow">CONSULTA E APURAÇÃO</span><h2>Visitas por experiência</h2></div><span className="data-scope">{profile?.role === 'community_admin' ? 'TODOS OS GUIAS' : 'SOMENTE SUAS ATRIBUIÇÕES'}</span></div>
        <div className="manage-filters">
          {profile?.role === 'community_admin' && (
            <label>Guia
              <select value={filters.guide} onChange={(event) => setFilters((current) => ({ ...current, guide: event.target.value }))}>
                <option value="all">Todos os guias</option>
                {guides.map((guide) => <option key={guide.id} value={guide.id}>{guide.full_name}</option>)}
              </select>
            </label>
          )}
          <label>Experiência<select value={filters.activity} onChange={(event) => setFilters({ ...filters, activity: event.target.value })}><option value="all">Todas as experiências</option>{activityOptions.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label>
          <label>Situação<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="all">Todas</option>{visibleStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          <label className="filter-search">Cliente ou telefone<input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="Buscar"/></label>
        </div>
        <div className="apuration-grid">{apuracao.length ? apuracao.map((item) => <article className="apuration-card" key={item.id}><div><span className="eyebrow">{item.bookings} {item.bookings === 1 ? 'PEDIDO' : 'PEDIDOS'}</span><h3>{item.title}</h3></div><div className="apuration-stats"><div><b>{item.customers}</b><span>clientes</span></div><div><b>{item.participants}</b><span>pessoas</span></div><div><b>{item.confirmed}</b><span>confirmados</span></div><div><b>{item.requested}</b><span>pendentes</span></div></div></article>) : <EmptyState>Não há pedidos para os filtros selecionados.</EmptyState>}</div>
      </section>

      {/* A agenda lista os pedidos filtrados e permite confirmar, cancelar ou atribuir um guia. */}
      <section className="manage-panel">
        <div className="panel-heading"><div><span className="eyebrow">AGENDA</span><h2>Pedidos de visita</h2></div><span className="data-scope">{filteredBookings.length} REGISTROS</span></div>
        <ManagementCalendar bookings={filteredBookings} liveUpdates={liveUpdates}/>
        <div className="booking-list">{busy ? <EmptyState>Carregando dados...</EmptyState> : filteredBookings.length ? filteredBookings.map((booking) => <article className="booking-row" key={booking.id}>
          <div className="booking-date"><b>{new Date(booking.scheduled_for).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</b><span>{new Date(booking.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
          <div className="booking-person"><b>{booking.customer?.full_name || 'Visitante'}</b><span>{booking.customer?.customer_code ? `${booking.customer.customer_code} · ` : ''}{booking.customer?.phone || 'Telefone não informado'} · {booking.participants} {booking.participants === 1 ? 'pessoa' : 'pessoas'}</span></div>
          <div className="booking-experience"><b>{booking.experience?.title || 'Experiência'}</b><span>{[booking.customer_note, booking.accessibility_needs && `Acessibilidade: ${booking.accessibility_needs}`, booking.dietary_restrictions && `Alergias e restrições: ${booking.dietary_restrictions}`].filter(Boolean).join(' · ') || 'Sem observações'}</span></div>
          {profile?.role === 'community_admin' ? <label className="inline-select" aria-label="Guia responsável"><select value={booking.guide_id || ''} onChange={(event) => assignGuide(booking.id, event.target.value)}><option value="">Atribuir guia</option>{guides.filter((guide) => (guide.experiences || []).some((item) => item.id === booking.experience_id)).map((guide) => <option key={guide.id} value={guide.id}>{guide.full_name}</option>)}</select></label> : <span className="guide-badge">Sua visita</span>}
          <div className="booking-actions"><span className={`status-pill status-${booking.status}`}>{statusLabels[booking.status]}</span><select aria-label="Atualizar situação" value={booking.status} onChange={(event) => setBookingStatus(booking.id, event.target.value)}>{visibleStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></div>
          {profile?.role === 'community_admin' && booking.program_id && <div className="program-management-actions">
            <button type="button" onClick={() => shareProgramWithCustomer(booking)}>Compartilhar programação no WhatsApp</button>
            <button type="button" onClick={() => setProgramEdit((current) => current?.bookingId === booking.id ? null : { bookingId: booking.id, programId: booking.program_id, slotId: '', participants: String(booking.participants) })}>Adicionar atividade</button>
            {['requested', 'confirmed'].includes(booking.status) && <button type="button" onClick={() => deleteProgramItem(booking)}>Cancelar atividade</button>}
          </div>}
          {programEdit?.bookingId === booking.id && <form className="program-item-editor" onSubmit={appendProgramItem}>
            <label>Horário para adicionar<select required value={programEdit.slotId} onChange={(event) => setProgramEdit((current) => ({ ...current, slotId: event.target.value }))}><option value="">Selecione uma atividade e data</option>{slots.filter((slot) => slot.is_active && new Date(slot.starts_at).getTime() > Date.now() && !bookings.some((item) => item.program_id === booking.program_id && item.availability_slot_id === slot.id)).map((slot) => <option key={slot.id} value={slot.id}>{slot.experience?.title || 'Atividade'} · {new Date(slot.starts_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</option>)}</select></label>
            <label>Participantes<input required type="number" min="1" max={activities.find((activity) => activity.id === slots.find((slot) => slot.id === programEdit.slotId)?.experience_id)?.max_participants || 100} value={programEdit.participants} onChange={(event) => setProgramEdit((current) => ({ ...current, participants: event.target.value }))}/></label>
            <button className="manage-primary" disabled={busy}>{busy ? 'Salvando...' : 'Confirmar inclusão'}</button>
            <button type="button" onClick={() => setProgramEdit(null)}>Fechar</button>
          </form>}
        </article>) : <EmptyState>Nenhum pedido encontrado.</EmptyState>}</div>
      </section>

      {/* Somente a administração vê a equipe, cria acessos e consulta a base completa de clientes. */}
      {profile?.role === 'community_admin' && <>
        <section className="manage-panel">
          <div className="panel-heading"><div><span className="eyebrow">CONTATO PÚBLICO</span><h2>WhatsApp da gestão</h2><p>Este número aparece na área do visitante para contato sobre o preço e a organização da visita.</p></div></div>
          <form className="community-contact-form" onSubmit={saveCommunityWhatsApp}>
            <label>Número de WhatsApp<input required type="tel" inputMode="tel" maxLength={24} value={communityWhatsApp} onChange={(event) => setCommunityWhatsApp(event.target.value)} placeholder="+55 (95) 98426-2222"/><span>Inclua código do país e DDD. Será exibido como {formatWhatsAppPhone(communityWhatsApp || defaultCommunityWhatsApp)}.</span></label>
            <button className="manage-primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar contato'}</button>
          </form>
        </section>
        <section className="manage-panel">
          <div className="panel-heading"><div><span className="eyebrow">CALENDÁRIO SAZONAL</span><h2>Disponibilidade por atividade</h2><p>Escolha os meses e dias recorrentes em que cada experiência pode acontecer. Uma exceção por data substitui esta regra.</p></div></div>
          <form className="season-form" onSubmit={saveSeason}>
            <label>Atividade<select required value={seasonForm.experienceId} onChange={(event) => chooseSeasonExperience(event.target.value)}><option value="">Selecione</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label>
            <fieldset><legend>Meses disponíveis</legend><div className="season-checks">{seasonMonths.map((month, index) => <label key={month}><input type="checkbox" checked={seasonForm.months.includes(index + 1)} onChange={() => toggleSeasonValue('months', index + 1)}/>{month}</label>)}</div></fieldset>
            <fieldset><legend>Dias da semana disponíveis</legend><div className="season-checks season-weekdays">{seasonWeekdays.map((weekday, index) => <label key={weekday}><input type="checkbox" checked={seasonForm.weekdays.includes(index)} onChange={() => toggleSeasonValue('weekdays', index)}/>{weekday}</label>)}</div></fieldset>
            <button className="manage-primary" disabled={busy || !seasonForm.experienceId}>{busy ? 'Salvando...' : 'Salvar época recorrente'}</button>
            {seasonForm.experienceId && (!seasonForm.months.length || !seasonForm.weekdays.length) && <p className="season-warning">Sem meses ou dias selecionados, a atividade ficará indisponível em todas as datas sem exceção.</p>}
          </form>
          <form className="exception-form" onSubmit={saveException}>
            <div className="panel-heading"><div><span className="eyebrow">EXCEÇÃO DE DATA</span><h3>Liberar ou bloquear uma data específica</h3></div></div>
            <label>Atividade<select required value={exceptionForm.experienceId} onChange={(event) => setExceptionForm({ ...exceptionForm, experienceId: event.target.value })}><option value="">Selecione</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label>
            <label>Data<input required type="date" min={getLocalDateKey()} value={exceptionForm.date} onChange={(event) => setExceptionForm({ ...exceptionForm, date: event.target.value })}/></label>
            <label>Disponibilidade<select value={exceptionForm.isAvailable ? 'open' : 'closed'} onChange={(event) => setExceptionForm({ ...exceptionForm, isAvailable: event.target.value === 'open' })}><option value="open">Liberar esta data</option><option value="closed">Bloquear esta data</option></select></label>
            <label>Observação (opcional)<input maxLength={500} value={exceptionForm.note} onChange={(event) => setExceptionForm({ ...exceptionForm, note: event.target.value })} placeholder="Ex.: período de cheia"/></label>
            <button className="manage-primary" disabled={busy || !exceptionForm.experienceId}>{busy ? 'Salvando...' : 'Salvar exceção'}</button>
          </form>
          <div className="exception-list">{availabilityExceptions.length ? availabilityExceptions.map((exception) => <article className="exception-row" key={exception.id}><div><b>{activities.find((activity) => activity.id === exception.experience_id)?.title || 'Atividade'}</b><span>{new Date(`${exception.available_on}T12:00:00`).toLocaleDateString('pt-BR', { dateStyle: 'long' })} · {exception.is_available ? 'Liberada' : 'Bloqueada'}{exception.note ? ` · ${exception.note}` : ''}</span></div><button className="slot-toggle" onClick={() => deleteException(exception.id)}>Remover exceção</button></article>) : <EmptyState>Nenhuma exceção futura cadastrada.</EmptyState>}</div>
        </section>
        <section className="manage-panel">
          <div className="panel-heading"><div><span className="eyebrow">AGENDA DA COMUNIDADE</span><h2>Horários disponíveis</h2><p>Somente os horários publicados aqui aparecem no formulário. Pedidos pendentes e confirmados ocupam vagas até serem cancelados.</p></div><span className="data-scope">{slots.filter((slot) => slot.is_active).length} PUBLICADOS</span></div>
          <form className="slot-form" onSubmit={createAvailabilitySlot}>
            <label>Experiência<select required value={slotForm.experience_id} onChange={(event) => {
              const activity = activities.find((item) => item.id === event.target.value)
              setSlotForm({ ...slotForm, experience_id: event.target.value, capacity: String(activity?.max_participants || 10) })
            }}><option value="">Selecione</option>{activities.map((activity) => <option key={activity.id} value={activity.id}>{activity.title}</option>)}</select></label>
            <label>Data e horário<input required type="datetime-local" value={slotForm.starts_at} onChange={(event) => setSlotForm({ ...slotForm, starts_at: event.target.value })}/></label>
            <label>Vagas para este horário<input required type="number" min="1" max={activities.find((item) => item.id === slotForm.experience_id)?.max_participants || 100} value={slotForm.capacity} onChange={(event) => setSlotForm({ ...slotForm, capacity: event.target.value })}/></label>
            <button className="manage-primary" disabled={busy}>{busy ? 'Publicando...' : 'Publicar horário'}</button>
          </form>
          <div className="slot-list">{slots.length ? slots.map((slot) => <article className="slot-row" key={slot.id}><div><b>{slot.experience?.title || 'Experiência'}</b><span>{new Date(slot.starts_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })} · {slot.capacity} vagas</span></div><span className={slot.is_active ? 'slot-state slot-state-active' : 'slot-state'}>{slot.is_active ? 'Publicado' : 'Retirado'}</span><button className="slot-toggle" onClick={() => setSlotActive(slot.id, !slot.is_active)}>{slot.is_active ? 'Retirar horário' : 'Publicar novamente'}</button></article>) : <EmptyState>Nenhum horário futuro cadastrado.</EmptyState>}</div>
        </section>
        <section className="manage-panel"><div className="panel-heading"><div><span className="eyebrow">EQUIPE</span><h2>Guias e atividades</h2></div><span className="data-scope">{guides.length} GUIAS</span></div>
          {guides.length ? <div className="guide-grid">{guides.map((guide) => <article className="guide-card" key={guide.id}><span className="guide-initial">{guide.full_name.slice(0, 1)}</span><div><b>{guide.full_name}</b><span>{guide.phone || 'Contato não informado'}</span><div className="guide-activity-list">{(guide.experiences || []).map((item) => <span key={item.id}>{item.title}</span>)}</div></div></article>)}</div> : <EmptyState>Os guias aparecerão aqui quando os acessos individuais forem criados.</EmptyState>}
        </section>
        <section className="manage-panel guide-create-panel"><div className="panel-heading"><div><span className="eyebrow">ACESSO INDIVIDUAL</span><h2>Criar acesso de guia</h2><p>Cada guia entra com o próprio e-mail e senha e vê apenas os pedidos das atividades atribuídas.</p></div></div>
          <form className="guide-form" onSubmit={createGuide}><label>Nome completo<input required maxLength={120} value={guideForm.full_name} onChange={(event) => setGuideForm({ ...guideForm, full_name: event.target.value })}/></label><label>E-mail de acesso<input required type="email" value={guideForm.email} onChange={(event) => setGuideForm({ ...guideForm, email: event.target.value })}/></label><label>Telefone<input type="tel" value={guideForm.phone} onChange={(event) => setGuideForm({ ...guideForm, phone: event.target.value })}/></label><label>Senha inicial<input required minLength={12} autoComplete="new-password" type="password" value={guideForm.password} onChange={(event) => setGuideForm({ ...guideForm, password: event.target.value })}/></label><fieldset><legend>Atividades deste guia</legend><div className="activity-checks">{activities.map((activity) => <label key={activity.id}><input type="checkbox" checked={guideForm.experience_ids.includes(activity.id)} onChange={() => toggleGuideActivity(activity.id)}/>{activity.title}</label>)}</div></fieldset><button className="manage-primary" disabled={busy || !guideForm.experience_ids.length}>{busy ? 'Salvando...' : 'Criar acesso e atribuir atividades'}</button><p>A senha é processada pelo serviço de autenticação e nunca fica visível ou salva na tabela de clientes.</p></form>
        </section>
        <section className="manage-panel"><div className="panel-heading"><div><span className="eyebrow">BASE DE CLIENTES</span><h2>Clientes cadastrados</h2></div><span className="data-scope">{clients.length} CLIENTES</span></div><div className="client-table">{clients.length ? clients.map((client) => <div className="client-row" key={client.id}><b>{client.full_name}</b><span>{client.customer_code || 'Código pendente'}</span><span>{client.phone || 'Telefone não informado'}</span><span>Cliente desde {new Date(client.created_at).toLocaleDateString('pt-BR')}</span><span>{bookings.filter((booking) => booking.customer_id === client.id).length} visitas</span></div>) : <EmptyState>Os clientes serão cadastrados ao criar uma conta no aplicativo.</EmptyState>}</div></section>
      </>}
    </main>
  </div>
}

// Entrada da equipe comunitária; visitantes têm um atalho separado para o próprio formulário.
function LoginScreen({ login, setLogin, onSubmit, busy, message }) {
  return <div className="management-page login-page"><header className="management-top"><Brand/><nav className="management-shortcuts"><a href="/area-visitante">Formulário do visitante</a><a href="/">Voltar ao site ↗</a></nav></header><main className="login-layout"><div className="login-intro"><span className="eyebrow">ÁREA DE GESTÃO · ACESSO RESTRITO</span><h1>Organizar as visitas, com a comunidade.</h1><p>Entre com sua conta individual. A tela e os dados disponíveis dependem das suas permissões.</p><div className="login-access-note"><b>Contas separadas</b><span>Administradores gerem visitas e atribuições. Cada guia vê somente os pedidos das experiências que conduz.</span></div></div><form className="login-card" onSubmit={onSubmit}><span className="eyebrow">BEM-VINDO DE VOLTA</span><h2>Entrar na gestão</h2><label>E-mail<input required autoComplete="username" type="email" value={login.email} onChange={(event) => setLogin({ ...login, email: event.target.value })}/></label><label>Senha<input required autoComplete="current-password" type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })}/></label>{message && <p className="manage-message" role="alert">{message}</p>}<button className="manage-primary" disabled={busy}>{busy ? 'Entrando...' : 'Entrar'}</button><p>Acesso de visitante? Preencha o formulário e acompanhe suas solicitações.</p><a className="login-visitor-link" href="/area-visitante">Abrir formulário do visitante ↗</a></form></main></div>
}

// Orienta a configuração do banco antes que a área restrita aceite logins reais.
function loadDemoBookings() {
  const examples = createDemoBookings(experiences)
  try {
    const saved = window.localStorage.getItem(demoBookingsStorageKey)
    if (!saved) return { bookings: examples, message: '' }
    const parsed = JSON.parse(saved)
    if (!Array.isArray(parsed) || !parsed.every((booking) => (
      typeof booking?.id === 'string'
      && typeof booking?.scheduled_for === 'string'
      && !Number.isNaN(Date.parse(booking.scheduled_for))
      && visibleStatuses.includes(booking.status)
      && Number.isInteger(booking.participants)
      && typeof booking?.experience?.title === 'string'
      && typeof booking?.customer?.full_name === 'string'
    ))) {
      return { bookings: examples, message: 'Os dados locais da demonstração não puderam ser lidos. Os exemplos foram restaurados.' }
    }
    return { bookings: parsed, message: '' }
  } catch {
    return { bookings: examples, message: 'O navegador bloqueou a leitura dos dados locais. As alterações da demonstração podem não ser preservadas.' }
  }
}

function SetupRequired() {
  const [demoState] = useState(loadDemoBookings)
  const [demoBookings, setDemoBookings] = useState(demoState.bookings)
  const [demoMessage, setDemoMessage] = useState(demoState.message)
  const [demoForm, setDemoForm] = useState({ experienceId: '', startsAt: '', participants: '1', customerName: '' })
  const [demoFilters, setDemoFilters] = useState({ startDate: '', endDate: '', status: 'all', experienceId: 'all', query: '' })
  const [editingDemoId, setEditingDemoId] = useState('')
  const [sharePreview, setSharePreview] = useState('')
  const firstDemoDate = demoBookings.find((booking) => booking.status !== 'cancelled')?.scheduled_for
  const selectedDemoDate = firstDemoDate ? getCalendarDateKey(firstDemoDate) : undefined
  const demoCustomerNames = [...new Set(demoBookings.map((booking) => booking.customer.full_name))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const filteredDemoBookings = demoBookings.filter((booking) => {
    const date = getCalendarDateKey(booking.scheduled_for)
    if (demoFilters.startDate && date < demoFilters.startDate) return false
    if (demoFilters.endDate && date > demoFilters.endDate) return false
    if (demoFilters.status !== 'all' && booking.status !== demoFilters.status) return false
    if (demoFilters.experienceId !== 'all' && booking.experience_id !== demoFilters.experienceId) return false
    const search = demoFilters.query.trim().toLocaleLowerCase('pt-BR')
    return !search || `${booking.customer.full_name} ${booking.experience.title}`.toLocaleLowerCase('pt-BR').includes(search)
  })
  const demoCustomerGroups = groupDemoBookingsByCustomer(filteredDemoBookings)
  const demoReports = {
    bookings: filteredDemoBookings.length,
    customers: demoCustomerGroups.length,
    participants: filteredDemoBookings.filter((booking) => booking.status !== 'cancelled').reduce((total, booking) => total + booking.participants, 0),
    pending: filteredDemoBookings.filter((booking) => booking.status === 'requested').length,
    confirmed: filteredDemoBookings.filter((booking) => booking.status === 'confirmed').length,
    activities: [...filteredDemoBookings.reduce((counts, booking) => {
      counts.set(booking.experience.title, (counts.get(booking.experience.title) || 0) + 1)
      return counts
    }, new Map())].sort((a, b) => b[1] - a[1]),
  }

  function saveDemoChanges(nextBookings, successMessage) {
    setDemoBookings(nextBookings)
    try {
      window.localStorage.setItem(demoBookingsStorageKey, JSON.stringify(nextBookings))
      setDemoMessage(successMessage)
    } catch {
      setDemoMessage('Não foi possível salvar as alterações neste navegador. Elas ficam disponíveis somente até fechar ou atualizar esta página.')
    }
  }

  function updateDemoStatus(bookingId, status) {
    saveDemoChanges(
      demoBookings.map((booking) => booking.id === bookingId ? { ...booking, status } : booking),
      'Situação do agendamento demonstrativo atualizada neste navegador.',
    )
  }

  function editDemoBooking(booking) {
    setEditingDemoId(booking.id)
    setDemoForm({
      experienceId: booking.experience_id,
      startsAt: `${getCalendarDateKey(booking.scheduled_for)}T${new Date(booking.scheduled_for).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false })}`,
      participants: String(booking.participants),
      customerName: booking.customer.full_name,
    })
  }

  function saveDemoBooking(event) {
    event.preventDefault()
    const experience = experiences.find((item) => item.id === demoForm.experienceId)
    const startsAt = new Date(demoForm.startsAt)
    const participants = Number(demoForm.participants)
    if (!experience || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setDemoMessage('Escolha uma atividade e uma data e horário futuros.')
      return
    }
    if (!Number.isInteger(participants) || participants < 1 || participants > (experience.max || 100)) {
      setDemoMessage(`Informe de 1 a ${experience.max || 100} participantes para esta atividade.`)
      return
    }
    const updatedBookings = demoBookings.map((booking) => booking.id === editingDemoId ? {
      ...booking,
      experience_id: experience.id,
      scheduled_for: startsAt.toISOString(),
      participants,
      experience: { title: experience.title },
      customer: { ...booking.customer, full_name: demoForm.customerName.trim() || booking.customer.full_name },
    } : booking).sort((first, second) => first.scheduled_for.localeCompare(second.scheduled_for))
    saveDemoChanges(updatedBookings, 'Agendamento demonstrativo atualizado.')
    setEditingDemoId('')
    setDemoForm({ experienceId: '', startsAt: '', participants: '1', customerName: '' })
  }

  function prepareDemoMessage(customerName) {
    const customerBookings = filteredDemoBookings.filter((booking) => booking.customer.full_name === customerName)
    const activityLines = customerBookings.map((booking) => `• ${booking.experience.title} — ${new Date(booking.scheduled_for).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })} — ${statusLabels[booking.status]}`)
    setSharePreview(`Olá, ${customerName}! Segue a programação demonstrativa da sua visita:\n${activityLines.join('\n')}\n\nA equipe confirmará os detalhes e o preço. Esta mensagem foi gerada com dados fictícios para demonstração.`)
  }

  async function copyDemoMessage() {
    try {
      await navigator.clipboard.writeText(sharePreview)
      setDemoMessage('Mensagem demonstrativa copiada para a área de transferência. Revise antes de compartilhar.')
    } catch {
      setDemoMessage('Não foi possível acessar a área de transferência. Selecione e copie o texto manualmente.')
    }
  }

  function cancelDemoBooking(booking) {
    if (!window.confirm(`Cancelar o agendamento demonstrativo de ${booking.customer.full_name}?`)) return
    updateDemoStatus(booking.id, 'cancelled')
  }

  function addDemoBooking(event) {
    event.preventDefault()
    const experience = experiences.find((item) => item.id === demoForm.experienceId)
    const startsAt = new Date(demoForm.startsAt)
    const participants = Number(demoForm.participants)
    if (!experience || Number.isNaN(startsAt.getTime()) || startsAt.getTime() <= Date.now()) {
      setDemoMessage('Escolha uma atividade e uma data e horário futuros.')
      return
    }
    if (!Number.isInteger(participants) || participants < 1 || participants > (experience.max || 100)) {
      setDemoMessage(`Informe de 1 a ${experience.max || 100} participantes para esta atividade.`)
      return
    }

    const bookingNumber = demoBookings.length + 1
    const customerName = demoForm.customerName || `Exemplo fictício ${String(bookingNumber).padStart(2, '0')}`
    const booking = {
      id: `demo-booking-${Date.now()}-${bookingNumber}`,
      program_id: `demo-program-${bookingNumber}`,
      experience_id: experience.id,
      scheduled_for: startsAt.toISOString(),
      participants,
      status: 'requested',
      customer_note: null,
      customer: { full_name: customerName },
      experience: { title: experience.title },
    }
    saveDemoChanges(
      [...demoBookings, booking].sort((first, second) => first.scheduled_for.localeCompare(second.scheduled_for)),
      'Agendamento fictício adicionado à demonstração.',
    )
    setDemoForm({ experienceId: '', startsAt: '', participants: '1', customerName: '' })
  }

  function restoreDemoBookings() {
    if (!window.confirm('Restaurar a lista inicial de exemplos? As alterações locais da demonstração serão substituídas.')) return
    saveDemoChanges(createDemoBookings(experiences), 'Exemplos demonstrativos restaurados.')
    setEditingDemoId('')
    setSharePreview('')
  }

  return <div className="management-page login-page">
    <header className="management-top"><Brand/><nav className="management-shortcuts"><a href="/area-visitante">Formulário do visitante</a><a href="/">Voltar ao site ↗</a></nav></header>
    <main className="setup-demo-layout">
      <section className="setup-card">
        <span className="eyebrow">PERFIL DA COMUNIDADE · DEMONSTRAÇÃO</span>
        <h1>Gestão de agendamentos.</h1>
        <p>O Supabase ainda não está configurado. Nesta demonstração você pode alterar status, adicionar e cancelar agendamentos de exemplo.</p>
        <ol><li>Os dados são fictícios e ficam salvos somente neste navegador.</li><li>Nenhuma alteração é enviada ao servidor nem afeta reservas reais.</li><li>Para gestão real com contas individuais, conecte o Supabase e aplique as migrações em <code>supabase/migrations</code>.</li></ol>
        <a className="manage-primary" href="/area-visitante">Abrir perfil de visitante</a>
      </section>
      <section className="manage-panel setup-calendar-panel">
        <div className="panel-heading"><div><span className="eyebrow">SOMENTE PARA APRESENTAÇÃO</span><h2>Calendário de visitas</h2><p>Selecione os dias destacados para ver exemplos fictícios de atividade, horário, visitantes e participantes.</p></div><span className="data-scope">DADOS FICTÍCIOS</span></div>
        <ManagementCalendar bookings={demoBookings} demoMode initialSelectedDate={selectedDemoDate}/>
      </section>
      <section className="manage-panel demo-report-panel">
        <div className="panel-heading"><div><span className="eyebrow">RELATÓRIOS DO FILTRO</span><h2>Resumo dos agendamentos</h2><p>Os totais abaixo acompanham os filtros aplicados e excluem cancelados da contagem de participantes.</p></div></div>
        <div className="demo-report-metrics">
          <Metric label="AGENDAMENTOS" value={demoReports.bookings}/>
          <Metric label="CLIENTES" value={demoReports.customers}/>
          <Metric label="PARTICIPANTES ATIVOS" value={demoReports.participants}/>
          <Metric label="PENDENTES" value={demoReports.pending}/>
          <Metric label="CONFIRMADOS" value={demoReports.confirmed}/>
        </div>
        <div className="demo-report-activities">{demoReports.activities.length ? demoReports.activities.map(([title, total]) => <span key={title}>{title}<b>{total}</b></span>) : <EmptyState>Nenhum resultado para os filtros atuais.</EmptyState>}</div>
      </section>
      <section className="manage-panel setup-demo-controls">
        <div className="panel-heading"><div><span className="eyebrow">PERFIL DA COMUNIDADE</span><h2>Gerenciar agendamentos de demonstração</h2><p>Teste as ações de gestão. As alterações são locais, demonstrativas e podem ser apagadas limpando os dados do navegador.</p></div><button type="button" className="manage-refresh" onClick={restoreDemoBookings}>Restaurar exemplos</button></div>
        {demoMessage && <p className="demo-management-message" role="status">{demoMessage}</p>}
        <div className="demo-filters">
          <label>De<input type="date" value={demoFilters.startDate} onChange={(event) => setDemoFilters((current) => ({ ...current, startDate: event.target.value }))}/></label>
          <label>Até<input type="date" min={demoFilters.startDate || undefined} value={demoFilters.endDate} onChange={(event) => setDemoFilters((current) => ({ ...current, endDate: event.target.value }))}/></label>
          <label>Situação<select value={demoFilters.status} onChange={(event) => setDemoFilters((current) => ({ ...current, status: event.target.value }))}><option value="all">Todas</option>{visibleStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          <label>Atividade<select value={demoFilters.experienceId} onChange={(event) => setDemoFilters((current) => ({ ...current, experienceId: event.target.value }))}><option value="all">Todas</option>{experiences.map((experience) => <option key={experience.id} value={experience.id}>{experience.title}</option>)}</select></label>
          <label className="demo-search">Cliente ou atividade<input type="search" value={demoFilters.query} onChange={(event) => setDemoFilters((current) => ({ ...current, query: event.target.value }))} placeholder="Buscar nos exemplos"/></label>
          <button type="button" className="manage-refresh" onClick={() => setDemoFilters({ startDate: '', endDate: '', status: 'all', experienceId: 'all', query: '' })}>Limpar filtros</button>
        </div>
        <form className="demo-booking-form" onSubmit={editingDemoId ? saveDemoBooking : addDemoBooking}>
          <label>Cliente de demonstração<select value={demoForm.customerName} onChange={(event) => setDemoForm((current) => ({ ...current, customerName: event.target.value }))}><option value="">Novo cliente fictício</option>{demoCustomerNames.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
          <label>Atividade<select required value={demoForm.experienceId} onChange={(event) => {
            const experience = experiences.find((item) => item.id === event.target.value)
            setDemoForm((current) => ({ ...current, experienceId: event.target.value, participants: String(Math.min(Number(current.participants), experience?.max || 100)) }))
          }}><option value="">Selecione uma atividade</option>{experiences.map((experience) => <option key={experience.id} value={experience.id}>{experience.title}</option>)}</select></label>
          <label>Data e horário<input required type="datetime-local" value={demoForm.startsAt} onChange={(event) => setDemoForm((current) => ({ ...current, startsAt: event.target.value }))}/></label>
          <label>Participantes<input required type="number" min="1" max={experiences.find((item) => item.id === demoForm.experienceId)?.max || 100} value={demoForm.participants} onChange={(event) => setDemoForm((current) => ({ ...current, participants: event.target.value }))}/></label>
          <button type="submit" className="manage-primary">{editingDemoId ? 'Salvar alterações' : 'Adicionar agendamento fictício'}</button>
          {editingDemoId && <button type="button" className="manage-refresh" onClick={() => { setEditingDemoId(''); setDemoForm({ experienceId: '', startsAt: '', participants: '1', customerName: '' }) }}>Cancelar edição</button>}
        </form>
        {sharePreview && <div className="demo-message-preview"><label>Mensagem pronta para revisar e copiar<textarea readOnly value={sharePreview}/></label><div><button type="button" className="manage-primary" onClick={copyDemoMessage}>Copiar mensagem</button><button type="button" className="manage-refresh" onClick={() => setSharePreview('')}>Fechar</button><span>Texto fictício: revise e envie manualmente; nenhuma mensagem é enviada pelo sistema.</span></div></div>}
        <div className="demo-booking-list">{demoCustomerGroups.length ? demoCustomerGroups.map(([customerName, customerBookings]) => <section className="demo-client-group" key={customerName}>
          <div className="demo-client-heading"><div><b>{customerName}</b><span>{customerBookings.length} {customerBookings.length === 1 ? 'agendamento' : 'agendamentos'} demonstrativos</span></div><button type="button" className="demo-message-button" onClick={() => prepareDemoMessage(customerName)}>Preparar mensagem</button></div>
          {customerBookings.map((booking) => <article className="demo-booking-row" key={booking.id}>
            <div className="demo-booking-date"><b>{new Date(booking.scheduled_for).toLocaleDateString('pt-BR', { dateStyle: 'medium' })}</b><span>{new Date(booking.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>
            <div className="demo-booking-person"><b>{booking.experience.title}</b><span>{booking.participants} {booking.participants === 1 ? 'pessoa' : 'pessoas'}</span></div>
            <label>Situação<select aria-label={`Situação: ${booking.experience.title}, ${new Date(booking.scheduled_for).toLocaleDateString('pt-BR')}, ${customerName}`} value={booking.status} onChange={(event) => updateDemoStatus(booking.id, event.target.value)}>{visibleStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
            <div className="demo-row-actions"><button type="button" className="demo-edit-button" onClick={() => editDemoBooking(booking)}>Editar</button>{booking.status !== 'cancelled' && <button type="button" className="demo-cancel-button" onClick={() => cancelDemoBooking(booking)}>Cancelar</button>}</div>
          </article>)}
        </section>) : <EmptyState>Nenhum agendamento corresponde aos filtros.</EmptyState>}</div>
      </section>
    </main>
  </div>
}

// Elementos pequenos reaproveitados deixam os cartões e cabeçalhos do painel consistentes.
function Brand() { return <a className="management-brand" href="/"><span>R<span>✳</span></span><b>RAPOSA I<small>GESTÃO COMUNITÁRIA</small></b></a> }
function Metric({ label, value }) { return <article className="manage-metric"><span>{label}</span><b>{value}</b></article> }
function EmptyState({ children }) { return <div className="manage-empty">{children}</div> }
