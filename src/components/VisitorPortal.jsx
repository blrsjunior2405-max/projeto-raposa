// Área autenticada do visitante: permite solicitar uma visita e acompanhar o próprio histórico.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { experiences } from '../data/experiences'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { cancelOwnBooking, getAvailableExperienceSlots, getVisitorBookings, requestExperienceProgram } from '../services/communitySchedule'
import { getCommunityWhatsApp } from '../services/communitySettings'
import './VisitorPortal.css'
import './CommunityContact.css'
import '../PortalLinks.css'

const bookingStatuses = {
  requested: 'Aguardando confirmação',
  confirmed: 'Confirmada pela comunidade',
  cancelled: 'Cancelada',
  completed: 'Concluída',
}

function formatDateTime(value) {
  return new Date(value).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })
}

function formatWhatsAppPhone(value) {
  if (value.startsWith('55') && value.length === 13) {
    return `+55 (${value.slice(2, 4)}) ${value.slice(4, 9)}-${value.slice(9)}`
  }
  if (value.startsWith('55') && value.length === 12) {
    return `+55 (${value.slice(2, 4)}) ${value.slice(4, 8)}-${value.slice(8)}`
  }
  return `+${value}`
}

function mensagemDeErro(error) {
  const text = error?.message?.toLocaleLowerCase('pt-BR') || ''
  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (text.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.'
  if (text.includes('already registered')) return 'Este e-mail já possui um cadastro.'
  if (text.includes('época') || text.includes('disponível nesta data')) return 'Uma das atividades não está disponível nesta data. Escolha outro horário ou fale com a comunidade.'
  if (text.includes('horário') || text.includes('vagas suficientes')) return 'Este horário mudou ou ficou sem vagas. Atualize a lista e escolha outro.'
  if (text.includes('aviso de privacidade')) return 'Confirme o aviso de privacidade para continuar.'
  if (text.includes('somente pedidos pendentes')) return 'Este pedido não está mais pendente e não pode ser cancelado por aqui.'
  if (text.includes('fetch') || text.includes('network')) return 'Sem conexão com o serviço. Tente novamente.'
  return 'Não foi possível concluir esta ação. Confira os dados e tente novamente.'
}

export default function VisitorPortal() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [bookings, setBookings] = useState([])
  const [availableSlots, setAvailableSlots] = useState([])
  const [communityWhatsApp, setCommunityWhatsApp] = useState('')
  const [section, setSection] = useState('form')
  const [authMode, setAuthMode] = useState('signup')
  const [authForm, setAuthForm] = useState({ fullName: '', phone: '', email: '', password: '' })
  const [form, setForm] = useState(() => {
    const requestedExperience = new URLSearchParams(window.location.search).get('experience')
    return {
      fullName: '',
      phone: '',
      programItems: [{ experienceId: experiences.some((item) => item.id === requestedExperience) ? requestedExperience : '', slotId: '' }],
      participants: '1',
      note: '',
      accessibilityNeeds: '',
      hasAllergies: '',
      allergyDetails: '',
      dietaryRestrictions: '',
      privacyConsent: false,
    }
  })
  const [busy, setBusy] = useState(false)
  const [authLoading, setAuthLoading] = useState(supabaseConfigured)
  const [dataLoading, setDataLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [messageIsError, setMessageIsError] = useState(false)

  const loading = authLoading || Boolean(session && dataLoading)

  // Carrega em paralelo perfil, histórico, horários e contato para montar o formulário.
  const loadVisitorData = useCallback(async (userId) => {
    if (!supabase || !userId) return

    const [profileResult, bookingsResult, slotsResult, contactResult] = await Promise.all([
      supabase.from('profiles').select('id, full_name, phone, role, customer_code').eq('id', userId).single(),
      getVisitorBookings(supabase, userId),
      getAvailableExperienceSlots(supabase),
      getCommunityWhatsApp(supabase),
    ])
    const error = profileResult.error || bookingsResult.error || slotsResult.error || contactResult.error
    if (error) {
      setMessage(mensagemDeErro(error))
      setMessageIsError(true)
    } else {
      setProfile(profileResult.data)
      setBookings(bookingsResult.data || [])
      setAvailableSlots(slotsResult.data || [])
      setCommunityWhatsApp(contactResult.data.whatsapp_phone)
      setForm((current) => ({
        ...current,
        fullName: profileResult.data.full_name || '',
        phone: profileResult.data.phone || '',
      }))
    }
    setDataLoading(false)
  }, [])

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) {
        setMessage(mensagemDeErro(error))
        setMessageIsError(true)
      }
      setSession(data.session)
      setDataLoading(Boolean(data.session))
      if (data.session) loadVisitorData(data.session.user.id)
      setAuthLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'INITIAL_SESSION') return
      setSession(nextSession)
      setDataLoading(Boolean(nextSession))
      if (nextSession) loadVisitorData(nextSession.user.id)
      else {
        setProfile(null)
        setBookings([])
      }
      setAuthLoading(false)
      setMessage('')
    })
    return () => listener.subscription.unsubscribe()
  }, [loadVisitorData])

  // Resolve cada escolha contra o catálogo e os horários ainda disponíveis antes do envio.
  const selectedProgramSlots = useMemo(() => form.programItems.map((item) => ({
    ...item,
    experience: experiences.find((experience) => experience.id === item.experienceId),
    slot: availableSlots.find((slot) => slot.id === item.slotId && slot.experience_id === item.experienceId),
  })), [availableSlots, form.programItems])
  const dietaryDetails = [
    form.hasAllergies === 'yes' && `Alergias: ${form.allergyDetails.trim()}`,
    form.dietaryRestrictions.trim() && `Restrições alimentares: ${form.dietaryRestrictions.trim()}`,
  ].filter(Boolean).join('\n')
  // Pedidos antigos sem programação continuam isolados; os novos aparecem agrupados pelo ID.
  const bookingPrograms = useMemo(() => {
    const groups = new Map()
    for (const booking of bookings) {
      const key = booking.program_id || `legacy-${booking.id}`
      const group = groups.get(key) || []
      group.push(booking)
      groups.set(key, group)
    }
    return [...groups.entries()].map(([id, items]) => ({ id, items }))
  }, [bookings])

  function updateProgramItem(index, changes) {
    setForm((current) => ({
      ...current,
      programItems: current.programItems.map((item, itemIndex) => itemIndex === index
        ? { ...item, ...changes }
        : item),
    }))
  }

  // A mesma tela oferece cadastro e login; a conta pública sempre recebe papel de visitante.
  async function submitAuth(event) {
    event.preventDefault()
    if (!supabase) return
    if (authMode === 'signup' && (!authForm.fullName.trim() || !authForm.phone.trim())) {
      setMessage('Informe seu nome completo e um telefone para contato.')
      setMessageIsError(true)
      return
    }
    setBusy(true)
    setMessage('')
    setMessageIsError(false)

    const result = authMode === 'signup'
      ? await supabase.auth.signUp({
        email: authForm.email.trim(),
        password: authForm.password,
        options: { data: { full_name: authForm.fullName.trim(), phone: authForm.phone.trim() } },
      })
      : await supabase.auth.signInWithPassword({ email: authForm.email.trim(), password: authForm.password })

    setBusy(false)
    if (result.error) {
      setMessage(mensagemDeErro(result.error))
      setMessageIsError(true)
    } else if (authMode === 'signup' && !result.data.session) {
      setAuthMode('login')
      setMessage('Cadastro iniciado. Confirme seu e-mail, se solicitado, e entre para preencher o pedido.')
    } else {
      setMessage(authMode === 'signup' ? 'Perfil criado. Agora escolha sua experiência e a data desejada.' : 'Acesso realizado.')
    }
  }

  // Confere os campos e o consentimento antes de atualizar perfil e solicitar vaga no banco.
  async function submitBooking(event) {
    event.preventDefault()
    if (!supabase || !session?.user || !profile) {
      setMessage('Entre com um perfil de visitante para enviar seu pedido.')
      setMessageIsError(true)
      return
    }
    if (profile.role !== 'visitor') {
      setMessage('Esta área é exclusiva para perfis de visitante.')
      setMessageIsError(true)
      return
    }
    if (!form.fullName.trim() || !form.phone.trim()) {
      setMessage('Informe seu nome completo e um telefone para contato.')
      setMessageIsError(true)
      return
    }
    if (!['yes', 'no'].includes(form.hasAllergies) || (form.hasAllergies === 'yes' && !form.allergyDetails.trim())) {
      setMessage('Informe se tem alguma alergia e descreva-a quando responder sim.')
      setMessageIsError(true)
      return
    }
    if (dietaryDetails.length > 500) {
      setMessage('O total de alergias e restrições alimentares deve ter no máximo 500 caracteres.')
      setMessageIsError(true)
      return
    }

    const participantCount = Number(form.participants)
    if (!selectedProgramSlots.length
      || selectedProgramSlots.some((item) => !item.experienceId || !item.slot)
      || new Set(selectedProgramSlots.map((item) => item.slotId)).size !== selectedProgramSlots.length
      || !Number.isInteger(participantCount) || participantCount < 1 || participantCount > 100) {
      setMessage('Selecione de uma a dez atividades, cada uma com horário publicado, e informe um número válido de participantes.')
      setMessageIsError(true)
      return
    }
    if (!form.privacyConsent) {
      setMessage('Leia e aceite o aviso sobre o uso dos dados para enviar o pedido.')
      setMessageIsError(true)
      return
    }
    const insufficientSlot = selectedProgramSlots.find((item) => participantCount > item.slot.remaining)
    if (insufficientSlot) {
      setMessage(`Não há vagas suficientes em ${insufficientSlot.experience?.title || 'um dos horários'}. Atualize a programação.`)
      setMessageIsError(true)
      return
    }
    const participantLimit = selectedProgramSlots.find((item) => item.experience?.max && participantCount > item.experience.max)
    if (participantLimit) {
      setMessage(`${participantLimit.experience.title} aceita até ${participantLimit.experience.max} participantes por grupo, conforme o catálogo.`)
      setMessageIsError(true)
      return
    }

    setBusy(true)
    setMessage('')
    setMessageIsError(false)
    const { error: profileError } = await supabase.from('profiles').update({
      full_name: form.fullName.trim(),
      phone: form.phone.trim(),
    }).eq('id', session.user.id)

    if (profileError) {
      setMessage(mensagemDeErro(profileError))
      setMessageIsError(true)
      setBusy(false)
      return
    }

    const { error } = await requestExperienceProgram(supabase, {
      slotIds: selectedProgramSlots.map((item) => item.slot.id),
      participants: participantCount,
      note: form.note.trim() || null,
      accessibilityNeeds: form.accessibilityNeeds.trim() || null,
      dietaryRestrictions: dietaryDetails || null,
      privacyConsent: form.privacyConsent,
    })
    setBusy(false)
    if (error) {
      setMessage(mensagemDeErro(error))
      setMessageIsError(true)
      return
    }

    setMessage('Programação recebida. A comunidade entrará em contato pelo telefone informado para combinar as atividades e compartilhar o preço. As datas só estarão confirmadas depois da resposta dos anfitriões.')
    setMessageIsError(false)
    setSection('history')
    setDataLoading(true)
    await loadVisitorData(session.user.id)
  }

  // Somente pedidos pendentes podem ser cancelados pelo visitante.
  async function cancelBooking(bookingId) {
    if (!window.confirm('Cancelar este pedido pendente? As vagas serão liberadas para outros visitantes.')) return
    setBusy(true)
    setMessage('')
    setMessageIsError(false)
    const { error } = await cancelOwnBooking(supabase, bookingId)
    if (error) {
      setMessage(mensagemDeErro(error))
      setMessageIsError(true)
      setBusy(false)
      return
    }
    setMessage('Pedido cancelado. O histórico da comunidade será atualizado.')
    setDataLoading(true)
    await loadVisitorData(session.user.id)
    setBusy(false)
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) {
      setMessage(mensagemDeErro(error))
      setMessageIsError(true)
      return
    }
    setProfile(null)
    setBookings([])
    setSection('form')
  }

  // O histórico é privado e mostrado na mesma página de formulário, conforme a aba escolhida.
  return <div className="visitor-page">
    <header className="visitor-topbar">
      <a className="visitor-brand" href="/" aria-label="Voltar ao catálogo Raposa I"><span>R<span>✳</span></span><b>RAPOSA I<small>ÁREA DO VISITANTE</small></b></a>
      <nav className="visitor-topbar-links" aria-label="Acesso rápido">
        <a className="visitor-management-link" href="/gestao">Gestão</a>
        <a className="visitor-back" href="/">Catálogo ↗</a>
      </nav>
    </header>
    <div className="visitor-layout">
      <aside className="visitor-sidebar" aria-label="Navegação do visitante">
        <span className="visitor-sidebar-label">MINHA ÁREA</span>
        <button className={section === 'form' ? 'visitor-nav active' : 'visitor-nav'} onClick={() => { setSection('form'); setMessage('') }}>✳ <span>Formulário de visita</span></button>
        <button className={section === 'history' ? 'visitor-nav active' : 'visitor-nav'} onClick={() => { setSection('history'); setMessage('') }}>▦ <span>Histórico de atividades</span></button>
        {session && <div className="visitor-sidebar-account"><span>{profile?.full_name || session.user.email}</span><button onClick={signOut}>Sair da conta</button></div>}
      </aside>

      <main className="visitor-content">
        <span className="eyebrow">RAPOSA I · NORMANDIA</span>
        <h1>{section === 'form' ? 'Vamos planejar sua visita.' : 'Seu histórico de atividades.'}</h1>
        <p className="visitor-intro">{section === 'form' ? 'Escolha uma vivência e um horário publicado pela comunidade.' : 'Acompanhe as experiências solicitadas, as datas e as respostas da comunidade.'}</p>
        {message && <div className={messageIsError ? 'visitor-message error' : 'visitor-message'} role={messageIsError ? 'alert' : 'status'}>{message}</div>}

        {!supabaseConfigured ? <DemoVisitorForm initialExperienceId={form.programItems[0]?.experienceId || ''} />
          : loading ? <section className="visitor-panel"><p>Carregando seus dados…</p></section>
            : !session ? <section className="visitor-panel visitor-auth-panel">
              <span className="eyebrow">{authMode === 'signup' ? 'NOVO VISITANTE' : 'BEM-VINDO DE VOLTA'}</span>
              <h2>{authMode === 'signup' ? 'Crie seu perfil.' : 'Entre na sua conta.'}</h2>
              <p>Seu perfil mantém seus pedidos e histórico privados. A comunidade recebe os dados necessários para organizar a visita.</p>
              <form className="visitor-form" onSubmit={submitAuth}>
                {authMode === 'signup' && <>
                  <label>Nome completo <span>*</span><input required maxLength={120} autoComplete="name" value={authForm.fullName} onChange={(event) => setAuthForm({ ...authForm, fullName: event.target.value })}/></label>
                  <label>Telefone para contato <span>*</span><input required maxLength={30} type="tel" autoComplete="tel" value={authForm.phone} onChange={(event) => setAuthForm({ ...authForm, phone: event.target.value })}/></label>
                </>}
                <label>E-mail <span>*</span><input required type="email" autoComplete="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}/></label>
                <label>Senha <span>*</span><input required minLength={8} type="password" autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}/>{authMode === 'signup' && <small>Use pelo menos 8 caracteres.</small>}</label>
                <button className="visitor-primary" disabled={busy}>{busy ? 'Aguarde…' : authMode === 'signup' ? 'Criar perfil de visitante' : 'Entrar'}</button>
              </form>
              <button className="visitor-auth-switch" onClick={() => { setAuthMode(authMode === 'signup' ? 'login' : 'signup'); setMessage('') }}>{authMode === 'signup' ? 'Já tem um perfil? Entre' : 'Ainda não tem perfil? Cadastre-se'}</button>
            </section>
              : profile?.role !== 'visitor' ? <section className="visitor-panel"><h2>Acesso de visitante</h2><p>Esta área é exclusiva para quem visita a comunidade. Use o painel de gestão para acessar as ferramentas da equipe.</p></section>
                : section === 'form' ? <section className="visitor-panel">
                  <div className="visitor-panel-heading"><div><span className="eyebrow">PEDIDO DE VISITA</span><h2>Seus dados e preferência</h2></div><span className="required-note">* CAMPOS OBRIGATÓRIOS</span></div>
                  <form className="visitor-form" onSubmit={submitBooking}>
                    <label>Nome completo <span>*</span><input required maxLength={120} autoComplete="name" value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })}/></label>
                    <label>E-mail da conta<input disabled value={session.user.email || ''} /></label>
                    <label>Telefone para contato <span>*</span><input required maxLength={30} type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })}/></label>
                    <fieldset className="visitor-program-fieldset">
                      <legend>Atividades e datas da programação <span>*</span></legend>
                      {selectedProgramSlots.map((item, index) => <div className="visitor-program-item" key={`program-item-${index}`}>
                        <label>Atividade <span>*</span><select required value={item.experienceId} onChange={(event) => updateProgramItem(index, { experienceId: event.target.value, slotId: '' })}><option value="">Selecione uma atividade</option>{experiences.map((experience) => <option key={experience.id} value={experience.id}>{experience.title}</option>)}</select></label>
                        <label>Data e horário publicado <span>*</span><select required value={item.slotId} disabled={!item.experienceId} onChange={(event) => updateProgramItem(index, { slotId: event.target.value })}><option value="">{item.experienceId ? 'Selecione uma data e horário' : 'Selecione primeiro uma atividade'}</option>{availableSlots.filter((slot) => slot.experience_id === item.experienceId && !form.programItems.some((selected, selectedIndex) => selectedIndex !== index && selected.slotId === slot.id)).map((slot) => <option key={slot.id} value={slot.id}>{formatDateTime(slot.starts_at)} · {slot.remaining} {slot.remaining === 1 ? 'vaga' : 'vagas'}</option>)}</select>{item.experienceId && !availableSlots.some((slot) => slot.experience_id === item.experienceId) && <small>A comunidade ainda não publicou horários para esta atividade.</small>}</label>
                        {form.programItems.length > 1 && <button className="visitor-remove-program-item" type="button" onClick={() => setForm((current) => ({ ...current, programItems: current.programItems.filter((_, itemIndex) => itemIndex !== index) }))}>Remover atividade</button>}
                      </div>)}
                      {form.programItems.length < 10 && <button className="visitor-add-program-item" type="button" onClick={() => setForm((current) => ({ ...current, programItems: [...current.programItems, { experienceId: '', slotId: '' }] }))}>+ Adicionar outra atividade ou data</button>}
                    </fieldset>
                    <label>Número de participantes <span>*</span><input required type="number" min="1" max={Math.min(100, ...selectedProgramSlots.map((item) => item.slot?.remaining || 100), ...selectedProgramSlots.map((item) => item.experience?.max || 100))} value={form.participants} onChange={(event) => setForm({ ...form, participants: event.target.value })}/><small>O limite será validado para cada horário e atividade selecionados.</small></label>
                    <label className="visitor-note-field">Observações para os anfitriões<textarea maxLength={1000} value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Informações úteis para organizar a visita (opcional)"/></label>
                    <label className="visitor-note-field">Necessidades de acessibilidade<textarea maxLength={500} value={form.accessibilityNeeds} onChange={(event) => setForm({ ...form, accessibilityNeeds: event.target.value })} placeholder="Informe apenas o que a comunidade precisa saber para preparar a visita (opcional)"/></label>
                    <fieldset className="visitor-allergy-fieldset">
                      <legend>Você tem alguma alergia? <span>*</span></legend>
                      <div className="visitor-allergy-options">
                        <label><input required type="radio" name="visitor-allergies" value="no" checked={form.hasAllergies === 'no'} onChange={() => setForm({ ...form, hasAllergies: 'no', allergyDetails: '' })}/>Não</label>
                        <label><input required type="radio" name="visitor-allergies" value="yes" checked={form.hasAllergies === 'yes'} onChange={() => setForm({ ...form, hasAllergies: 'yes' })}/>Sim</label>
                      </div>
                      {form.hasAllergies === 'yes' && <label className="visitor-allergy-details">Quais alergias? <span>*</span><textarea required maxLength={500} value={form.allergyDetails} onChange={(event) => setForm({ ...form, allergyDetails: event.target.value })} placeholder="Informe as alergias relevantes para a visita"/></label>}
                    </fieldset>
                    <label className="visitor-note-field">Outras restrições alimentares (opcional)<textarea maxLength={500} value={form.dietaryRestrictions} onChange={(event) => setForm({ ...form, dietaryRestrictions: event.target.value })} placeholder="Informe outras restrições relevantes para esta experiência"/></label>
                    <div className="visitor-form-notice"><b>Privacidade e confirmação.</b> Seus dados de contato, pedido e observações serão usados para organizar a visita e ficam acessíveis à equipe da comunidade e ao guia atribuído. Informe somente o necessário. A comunidade usará o telefone informado para retornar com o preço e combinar a visita. O pedido ainda não confirma a reserva.</div>
                    <label className="visitor-consent"><input required type="checkbox" checked={form.privacyConsent} onChange={(event) => setForm({ ...form, privacyConsent: event.target.checked })}/><span>Li o aviso e autorizo o uso dessas informações para organizar esta visita. <b>*</b></span></label>
                    {communityWhatsApp && <div className="visitor-contact"><b>WhatsApp da gestão da comunidade</b><a href={`https://wa.me/${communityWhatsApp}`} target="_blank" rel="noreferrer">Falar com a comunidade: {formatWhatsAppPhone(communityWhatsApp)} ↗</a><span>Após o pedido, a comunidade também usará o telefone informado para compartilhar o preço.</span></div>}
                    <button className="visitor-primary" disabled={busy}>{busy ? 'Enviando pedido…' : 'Enviar pedido à comunidade'}</button>
                  </form>
                </section>
                  : <section className="visitor-panel">
                    <div className="visitor-panel-heading"><div><span className="eyebrow">SUAS SOLICITAÇÕES</span><h2>Histórico</h2></div><button className="visitor-refresh" onClick={() => { setDataLoading(true); loadVisitorData(session.user.id) }}>↻ Atualizar</button></div>
                    {communityWhatsApp && <div className="visitor-contact visitor-history-contact"><b>Fale com a gestão da comunidade</b><a href={`https://wa.me/${communityWhatsApp}`} target="_blank" rel="noreferrer">WhatsApp {formatWhatsAppPhone(communityWhatsApp)} ↗</a><span>Use este contato se precisar conversar sobre seu pedido ou o preço da visita.</span></div>}
                    {profile?.customer_code && <p className="visitor-customer-code"><b>Código de cliente:</b> {profile.customer_code}</p>}
                    {bookings.length ? <div className="visitor-history">{bookingPrograms.map((program) => <article className="visitor-history-card" key={program.id}>
                      <div className="visitor-history-heading"><div><span className="eyebrow">PROGRAMAÇÃO · {program.items.length} {program.items.length === 1 ? 'ATIVIDADE' : 'ATIVIDADES'}</span><h3>Solicitada em {formatDateTime(program.items[0].created_at)}</h3></div></div>
                      {program.items.map((booking) => {
                        const experience = experiences.find((item) => item.id === booking.experience_id)
                        return <div className="visitor-history-program-item" key={booking.id}>
                          <div className="visitor-history-heading"><div><span className="eyebrow">{experience?.category || 'EXPERIÊNCIA'}</span><h3>{experience?.title || 'Experiência'}</h3></div><span className={`visitor-status status-${booking.status}`}>{bookingStatuses[booking.status] || booking.status}</span></div>
                          <p><b>Data e horário:</b> {formatDateTime(booking.scheduled_for)}</p>
                          <p><b>Participantes:</b> {booking.participants}</p>
                          <p><b>Pedido enviado em:</b> {formatDateTime(booking.created_at)}</p>
                          <p><b>Última atualização:</b> {formatDateTime(booking.updated_at)}</p>
                          {booking.customer_note && <p><b>Observações:</b> {booking.customer_note}</p>}
                          {booking.accessibility_needs && <p><b>Acessibilidade:</b> {booking.accessibility_needs}</p>}
                          {booking.dietary_restrictions && <p><b>Alergias e restrições alimentares:</b> {booking.dietary_restrictions}</p>}
                          {booking.status === 'requested' && <button className="visitor-cancel" disabled={busy} onClick={() => cancelBooking(booking.id)}>Cancelar pedido pendente</button>}
                        </div>
                      })}
                    </article>)}</div> : <div className="visitor-empty"><h3>Você ainda não enviou pedidos.</h3><p>Escolha uma experiência e solicite uma data para começar seu histórico.</p><button className="visitor-primary" onClick={() => setSection('form')}>Preencher formulário</button></div>}
                  </section>}
      </main>
    </div>
  </div>
}

// Exibe os campos de verdade para apresentação local, sem guardar ou enviar dados pessoais.
function DemoVisitorForm({ initialExperienceId }) {
  const [demoForm, setDemoForm] = useState({
    fullName: '',
    phone: '',
    items: [{ experienceId: initialExperienceId, preferredDate: '' }],
    participants: '1',
    note: '',
    accessibilityNeeds: '',
    hasAllergies: '',
    allergyDetails: '',
    dietaryRestrictions: '',
    privacyConsent: false,
  })
  const [submitted, setSubmitted] = useState(false)
  const selectedExperiences = demoForm.items.map((item) => experiences.find((experience) => experience.id === item.experienceId))
  const participantLimit = Math.min(100, ...selectedExperiences.map((item) => item?.max || 100))

  function updateField(field, value) {
    setDemoForm((current) => ({ ...current, [field]: value }))
    setSubmitted(false)
  }

  function updateProgramItem(index, changes) {
    setDemoForm((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item),
    }))
    setSubmitted(false)
  }

  function previewRequest(event) {
    event.preventDefault()
    setSubmitted(true)
  }

  return <section className="visitor-panel">
    <div className="visitor-panel-heading">
      <div><span className="eyebrow">PEDIDO DE VISITA · PRÉVIA</span><h2>Preencha o formulário</h2></div>
      <span className="required-note">* CAMPOS OBRIGATÓRIOS</span>
    </div>
    <div className="visitor-form-notice demo-form-notice">
      <b>Modo de demonstração.</b> O Supabase não está conectado. Você pode testar o preenchimento, mas nenhum dado será enviado ou salvo. Para receber pedidos reais, configure o backend conforme o README.
    </div>
    <form className="visitor-form" onSubmit={previewRequest}>
      <label>Nome completo <span>*</span><input required maxLength={120} autoComplete="name" value={demoForm.fullName} onChange={(event) => updateField('fullName', event.target.value)}/></label>
      <label>Telefone para contato <span>*</span><input required maxLength={30} type="tel" autoComplete="tel" value={demoForm.phone} onChange={(event) => updateField('phone', event.target.value)}/></label>
      <fieldset className="visitor-program-fieldset">
        <legend>Atividades e datas da programação <span>*</span></legend>
        {demoForm.items.map((item, index) => <div className="visitor-program-item" key={`demo-item-${index}`}>
          <label>Atividade <span>*</span><select required value={item.experienceId} onChange={(event) => updateProgramItem(index, { experienceId: event.target.value })}><option value="">Selecione uma atividade</option>{experiences.map((experienceItem) => <option key={experienceItem.id} value={experienceItem.id}>{experienceItem.title}</option>)}</select></label>
          <label>Data preferida <span>*</span><input required type="date" value={item.preferredDate} onChange={(event) => updateProgramItem(index, { preferredDate: event.target.value })}/></label>
          {demoForm.items.length > 1 && <button className="visitor-remove-program-item" type="button" onClick={() => setDemoForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}>Remover atividade</button>}
        </div>)}
        {demoForm.items.length < 10 && <button className="visitor-add-program-item" type="button" onClick={() => setDemoForm((current) => ({ ...current, items: [...current.items, { experienceId: '', preferredDate: '' }] }))}>+ Adicionar outra atividade ou data</button>}
      </fieldset>
      <label>Número de participantes <span>*</span><input required type="number" min="1" max={participantLimit} value={demoForm.participants} onChange={(event) => updateField('participants', event.target.value)}/></label>
      <label className="visitor-wide-field">Observações para a comunidade<textarea maxLength={1000} value={demoForm.note} onChange={(event) => updateField('note', event.target.value)} placeholder="Conte algo importante para organizar sua visita (opcional)."/></label>
      <label>Necessidades de acessibilidade<textarea maxLength={500} value={demoForm.accessibilityNeeds} onChange={(event) => updateField('accessibilityNeeds', event.target.value)} placeholder="Opcional"/></label>
      <fieldset className="visitor-allergy-fieldset">
        <legend>Você tem alguma alergia? <span>*</span></legend>
        <div className="visitor-allergy-options">
          <label><input required type="radio" name="demo-allergies" value="no" checked={demoForm.hasAllergies === 'no'} onChange={() => setDemoForm((current) => ({ ...current, hasAllergies: 'no', allergyDetails: '' }))}/>Não</label>
          <label><input required type="radio" name="demo-allergies" value="yes" checked={demoForm.hasAllergies === 'yes'} onChange={() => updateField('hasAllergies', 'yes')}/>Sim</label>
        </div>
        {demoForm.hasAllergies === 'yes' && <label className="visitor-allergy-details">Quais alergias? <span>*</span><textarea required maxLength={500} value={demoForm.allergyDetails} onChange={(event) => updateField('allergyDetails', event.target.value)} placeholder="Informe as alergias relevantes para a visita"/></label>}
      </fieldset>
      <label>Outras restrições alimentares<textarea maxLength={500} value={demoForm.dietaryRestrictions} onChange={(event) => updateField('dietaryRestrictions', event.target.value)} placeholder="Opcional"/></label>
      <div className="visitor-form-notice"><b>Preço e confirmação.</b> A comunidade informará o preço ao entrar em contato. O preenchimento não confirma uma reserva.</div>
      <label className="visitor-consent"><input required type="checkbox" checked={demoForm.privacyConsent} onChange={(event) => updateField('privacyConsent', event.target.checked)}/><span>Li o aviso e autorizo o uso dos dados para organizar esta visita. <b>*</b></span></label>
      <button className="visitor-primary" type="submit">{submitted ? 'Prévia preenchida' : 'Testar preenchimento do formulário'}</button>
    </form>
    {submitted && <p className="visitor-message demo-form-result" role="status">Prévia preenchida para {demoForm.fullName} com {demoForm.items.length} {demoForm.items.length === 1 ? 'atividade' : 'atividades'}. Nenhum dado foi enviado nem salvo. Conecte o Supabase para registrar solicitações reais.</p>}
  </section>
}
