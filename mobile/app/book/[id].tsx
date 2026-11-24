// Formulário de consulta: envia o pedido ao banco, sem tratar o envio como confirmação da visita.
import { useEffect, useState, type PropsWithChildren } from 'react'
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { Link, router, useLocalSearchParams } from 'expo-router'
import { catalog } from '@/lib/catalog'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { mensagemDeErro } from '@/lib/mensagens'
import { theme } from '@/lib/theme'

export default function BookingRequestScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const experience = catalog.find((item) => item.id === id)
  const { session, profile } = useAuth()
  const [slots, setSlots] = useState<{ id:string; experience_id:string; starts_at:string; remaining:number }[]>([])
  const [programItems, setProgramItems] = useState(() => [{ experienceId: id, slotId: '' }])
  const [participants, setParticipants] = useState('1')
  const [note, setNote] = useState('')
  const [accessibilityNeeds, setAccessibilityNeeds] = useState('')
  const [hasAllergies, setHasAllergies] = useState<boolean | null>(null)
  const [allergyDetails, setAllergyDetails] = useState('')
  const [dietaryRestrictions, setDietaryRestrictions] = useState('')
  const [privacyConsent, setPrivacyConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [communityWhatsApp, setCommunityWhatsApp] = useState('')

  const selectedProgramItems = programItems.map((item) => ({
    ...item,
    experience: catalog.find((activity) => activity.id === item.experienceId),
    slot: slots.find((slot) => slot.id === item.slotId && slot.experience_id === item.experienceId),
  }))
  const participantLimit = Math.min(100, ...selectedProgramItems.map((item) => item.experience?.maxParticipants || 100))
  const dietaryDetails = [
    hasAllergies && `Alergias: ${allergyDetails.trim()}`,
    dietaryRestrictions.trim() && `Restrições alimentares: ${dietaryRestrictions.trim()}`,
  ].filter(Boolean).join('\n')

  useEffect(() => {
    let active = true
    async function loadSlots() {
      if (!supabase || !experience) return
      const [slotsResult, contactResult] = await Promise.all([
        supabase.rpc('get_available_experience_slots'),
        supabase.from('community_settings').select('whatsapp_phone').eq('id', true).single(),
      ])
      if (!active) return
      if (slotsResult.error) setError(mensagemDeErro(slotsResult.error))
      else setSlots(slotsResult.data || [])
      if (contactResult.error) setError(mensagemDeErro(contactResult.error))
      else if (contactResult.data?.whatsapp_phone) setCommunityWhatsApp(contactResult.data.whatsapp_phone)
    }
    loadSlots()
    return () => { active = false }
  }, [experience])

  if (!experience) return <View style={styles.center}><Text>Experiência não encontrada.</Text></View>

  // Confere os dados localmente e deixa o banco validar novamente a identidade e a data.
  async function submit() {
    setError('')
    if (!experience) return setError('Experiência não encontrada.')
    if (!session || !profile || profile.role !== 'visitor') return setError('Entre com um perfil de visitante para solicitar uma data.')
    if (!supabase) return setError('O banco de dados ainda não foi conectado. Tente novamente mais tarde.')
    if (!selectedProgramItems.length || selectedProgramItems.some((item) => !item.experience || !item.slot)) return setError('Selecione uma atividade e um horário publicado para cada item da programação.')
    if (!privacyConsent) return setError('Leia e aceite o aviso sobre o uso dos dados para continuar.')
    if (hasAllergies === null || (hasAllergies && !allergyDetails.trim())) return setError('Informe se tem alguma alergia e descreva-a quando responder sim.')
    if (hasAllergies && allergyDetails.trim().length > 500) return setError('A descrição das alergias deve ter no máximo 500 caracteres.')
    if (dietaryDetails.length > 500) return setError('O total de alergias e restrições alimentares deve ter no máximo 500 caracteres.')
    if (!Number.isInteger(Number(participants)) || Number(participants) < 1) return setError('Informe um número válido de participantes.')
    if (Number(participants) > participantLimit) return setError(`O grupo excede o limite de participantes de uma das atividades.`)
    if (selectedProgramItems.some((item) => Number(participants) > (item.slot?.remaining ?? 0))) return setError('Não há vagas suficientes em um dos horários. Atualize a programação.')

    setBusy(true)
    const { error: insertError } = await supabase.rpc('request_experience_program', {
      target_slot_ids: selectedProgramItems.map((item) => item.slot?.id),
      participant_count: Number(participants),
      visitor_note: note.trim() || null,
      visitor_accessibility_needs: accessibilityNeeds.trim() || null,
      visitor_dietary_restrictions: dietaryDetails || null,
      visitor_privacy_consent: privacyConsent,
    })
    setBusy(false)
    if (insertError) setError(mensagemDeErro(insertError))
    else setSuccess(true)
  }

  if (!session) return <ScrollView contentContainerStyle={styles.content}><Text style={styles.kicker}>PEDIDO DE VISITA</Text><Text style={styles.title}>Entre para consultar uma data.</Text><Text style={styles.copy}>O perfil guarda seus pedidos e permite acompanhar a resposta da comunidade. Seu pedido ainda não é uma confirmação de reserva.</Text><Link href={'/login' as any} asChild><Pressable style={styles.primary}><Text style={styles.primaryText}>Entrar</Text></Pressable></Link><Link href={'/signup' as any} asChild><Pressable style={styles.secondary}><Text style={styles.secondaryText}>Criar perfil de visitante</Text></Pressable></Link></ScrollView>
  if (profile && profile.role !== 'visitor') return <View style={styles.center}><Text style={styles.kicker}>ACESSO DE GUIA</Text><Text style={styles.title}>O painel do guia fica no site de gestão.</Text></View>
  if (success) return <View style={styles.success}><Text style={styles.successIcon}>✓</Text><Text style={styles.title}>Programação enviada.</Text><Text style={styles.copy}>A comunidade recebeu seu pedido para {selectedProgramItems.map((item) => item.experience?.title).filter(Boolean).join(', ')}. Os anfitriões confirmarão as datas e entrarão em contato pelo telefone cadastrado para informar o preço.</Text>{communityWhatsApp ? <Pressable style={styles.secondary} onPress={() => Linking.openURL(`https://wa.me/${communityWhatsApp}`)}><Text style={styles.secondaryText}>WhatsApp da gestão da comunidade</Text></Pressable> : null}<Pressable style={styles.primary} onPress={() => router.replace('/(tabs)/reservas' as any)}><Text style={styles.primaryText}>Acompanhar minhas visitas</Text></Pressable></View>

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.kicker}>CONSULTAR DATA · RAPOSA I</Text>
    <Text style={styles.title}>Vamos combinar sua visita.</Text>
    <Text style={styles.activityName}>Monte uma programação com uma ou mais atividades.</Text>
    <View style={styles.notice}><Text style={styles.noticeTitle}>SOLICITAÇÃO, NÃO CONFIRMAÇÃO</Text><Text style={styles.noticeText}>A comunidade precisa confirmar a data, a disponibilidade e o guia. Os anfitriões entrarão em contato pelo telefone cadastrado para compartilhar o preço.</Text></View>
    {communityWhatsApp ? <Pressable style={styles.secondary} onPress={() => Linking.openURL(`https://wa.me/${communityWhatsApp}`)}><Text style={styles.secondaryText}>WhatsApp da gestão da comunidade</Text></Pressable> : null}
    <Field label="Atividades e datas da programação *">
      {selectedProgramItems.map((item, index) => <View style={styles.programItem} key={`program-${index}`}>
        <Text style={styles.label}>Atividade</Text>
        <View style={styles.slotList}>{catalog.filter((activity) => !programItems.some((selected, selectedIndex) => selectedIndex !== index && selected.experienceId === activity.id)).map((activity) => <Pressable key={activity.id} accessibilityRole="radio" accessibilityState={{ selected: item.experienceId === activity.id }} style={[styles.slotOption, item.experienceId === activity.id && styles.slotSelected]} onPress={() => setProgramItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, experienceId: activity.id, slotId: '' } : entry))}><Text style={[styles.slotText, item.experienceId === activity.id && styles.slotTextSelected]}>{activity.title}</Text></Pressable>)}</View>
        <Text style={styles.label}>Horário publicado pela comunidade</Text>
        {slots.filter((slot) => slot.experience_id === item.experienceId && !programItems.some((selected, selectedIndex) => selectedIndex !== index && selected.slotId === slot.id)).length
          ? <View style={styles.slotList}>{slots.filter((slot) => slot.experience_id === item.experienceId && !programItems.some((selected, selectedIndex) => selectedIndex !== index && selected.slotId === slot.id)).map((slot) => <Pressable key={slot.id} accessibilityRole="radio" accessibilityState={{ selected: item.slotId === slot.id }} style={[styles.slotOption, item.slotId === slot.id && styles.slotSelected]} onPress={() => setProgramItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, slotId: slot.id } : entry))}><Text style={[styles.slotText, item.slotId === slot.id && styles.slotTextSelected]}>{new Date(slot.starts_at).toLocaleString('pt-BR', { dateStyle:'medium', timeStyle:'short' })} · {slot.remaining} {slot.remaining === 1 ? 'vaga' : 'vagas'}</Text></Pressable>)}</View>
          : <Text style={styles.hint}>A comunidade ainda não publicou horários para esta atividade.</Text>}
        {programItems.length > 1 && <Pressable accessibilityRole="button" onPress={() => setProgramItems((current) => current.filter((_, entryIndex) => entryIndex !== index))}><Text style={styles.removeProgramItem}>Remover atividade</Text></Pressable>}
      </View>)}
      {programItems.length < 10 && <Pressable style={styles.secondary} onPress={() => setProgramItems((current) => [...current, { experienceId: catalog.find((activity) => !current.some((item) => item.experienceId === activity.id))?.id || '', slotId: '' }])}><Text style={styles.secondaryText}>+ Adicionar outra atividade ou data</Text></Pressable>}
    </Field>
    <Field label="Número de participantes"><TextInput value={participants} onChangeText={setParticipants} placeholder="1" placeholderTextColor="#8a8b80" style={styles.input} keyboardType="number-pad" maxLength={3}/>{selectedProgramItems.some((item) => item.slot) && <Text style={styles.hint}>O número será validado em todos os horários escolhidos.</Text>}</Field>
    <Field label="Observação para os anfitriões"><TextInput value={note} onChangeText={setNote} placeholder="Informações úteis para organizar a visita (opcional)" placeholderTextColor="#8a8b80" style={[styles.input, styles.noteInput]} multiline maxLength={1000}/></Field>
    <Field label="Necessidades de acessibilidade (opcional)"><TextInput value={accessibilityNeeds} onChangeText={setAccessibilityNeeds} placeholder="Informe somente o necessário" placeholderTextColor="#8a8b80" style={[styles.input, styles.noteInput]} multiline maxLength={500}/></Field>
    <Field label="Você tem alguma alergia? *">
      <View style={styles.radioGroup} accessibilityRole="radiogroup">
        {[{ label: 'Não', value: false }, { label: 'Sim', value: true }].map((option) => <Pressable key={option.label} accessibilityRole="radio" accessibilityState={{ checked: hasAllergies === option.value }} style={styles.radioOption} onPress={() => { setHasAllergies(option.value); if (!option.value) setAllergyDetails('') }}>
          <View style={[styles.radioCircle, hasAllergies === option.value && styles.radioCircleSelected]}>{hasAllergies === option.value && <View style={styles.radioDot}/>}</View>
          <Text style={styles.radioLabel}>{option.label}</Text>
        </Pressable>)}
      </View>
    </Field>
    {hasAllergies && <Field label="Quais alergias? *"><TextInput value={allergyDetails} onChangeText={setAllergyDetails} placeholder="Informe as alergias relevantes para a visita" placeholderTextColor="#8a8b80" style={[styles.input, styles.noteInput]} multiline maxLength={500}/></Field>}
    <Field label="Outras restrições alimentares (opcional)"><TextInput value={dietaryRestrictions} onChangeText={setDietaryRestrictions} placeholder="Informe outras restrições relevantes para a experiência" placeholderTextColor="#8a8b80" style={[styles.input, styles.noteInput]} multiline maxLength={500}/></Field>
    <View style={styles.privacy}><Text style={styles.noticeTitle}>PRIVACIDADE E CONFIRMAÇÃO</Text><Text style={styles.noticeText}>Seus dados e observações serão usados para organizar a visita e ficam acessíveis à equipe da comunidade e ao guia atribuído. Informe somente o necessário. Pedido enviado não confirma a visita; a comunidade entrará em contato pelo telefone cadastrado para informar o preço.</Text></View>
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: privacyConsent }} onPress={() => setPrivacyConsent(!privacyConsent)} style={styles.consent}><View style={[styles.checkbox, privacyConsent && styles.checkboxChecked]}><Text style={styles.checkmark}>{privacyConsent ? '✓' : ''}</Text></View><Text style={styles.consentText}>Li o aviso e autorizo o uso dessas informações para organizar esta visita. *</Text></Pressable>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={submit}><Text style={styles.primaryText}>{busy ? 'Enviando…' : 'Enviar pedido à comunidade'}</Text></Pressable>
    <Text style={styles.finePrint}>Não há cobrança online. A reserva depende de resposta dos anfitriões.</Text>
  </ScrollView>
}

// Agrupa rótulo e campo para manter o formulário legível em telas pequenas.
function Field({ label, children }: PropsWithChildren<{ label: string }>) { return <View style={styles.field}><Text style={styles.label}>{label}</Text>{children}</View> }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 22, paddingBottom: 38, backgroundColor: theme.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 30, backgroundColor: theme.background },
  kicker: { fontSize: 8, letterSpacing: 1.3, color: theme.green, fontWeight: '800' },
  title: { marginTop: 11, color: theme.ink, fontFamily: 'SpaceMono', fontSize: 24, lineHeight: 33, fontWeight: '700' },
  activityName: { marginTop: 5, color: theme.clay, fontFamily: 'SpaceMono', fontSize: 13, lineHeight: 20, fontWeight: '600' },
  copy: { marginTop: 12, color: theme.muted, fontSize: 12, lineHeight: 19 },
  notice: { marginTop: 19, backgroundColor: '#eeeee5', padding: 13, borderLeftWidth: 3, borderLeftColor: theme.ochre },
  noticeTitle: { color: theme.green, fontWeight: '800', fontSize: 8, letterSpacing: 1 },
  noticeText: { marginTop: 6, color: theme.muted, fontSize: 10, lineHeight: 16 },
  privacy: { marginTop: 18, backgroundColor: '#eeeee5', padding: 13 },
  consent: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  checkbox: { width: 20, height: 20, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.surface },
  checkboxChecked: { backgroundColor: theme.green, borderColor: theme.green },
  checkmark: { color: '#fff', fontSize: 13, fontWeight: '700' },
  consentText: { flex: 1, color: theme.ink, fontSize: 10, lineHeight: 16 },
  field: { marginTop: 18, gap: 7 },
  programItem: { gap: 9, padding: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  removeProgramItem: { color: theme.clay, fontSize: 10, fontWeight: '700', paddingVertical: 8 },
  slotList: { gap: 8 },
  slotOption: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 11, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  slotSelected: { backgroundColor: theme.green, borderColor: theme.green },
  slotText: { color: theme.ink, fontSize: 10, lineHeight: 16 },
  slotTextSelected: { color: '#fff', fontWeight: '700' },
  label: { fontSize: 10, color: theme.ink, fontWeight: '700' },
  input: { minHeight: 43, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, paddingHorizontal: 11, color: theme.ink, fontSize: 12 },
  noteInput: { minHeight: 83, paddingTop: 11, textAlignVertical: 'top' },
  radioGroup: { flexDirection: 'row', gap: 12 },
  radioOption: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: theme.muted, alignItems: 'center', justifyContent: 'center' },
  radioCircleSelected: { borderColor: theme.green },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.green },
  radioLabel: { color: theme.ink, fontSize: 11 },
  hint: { color: theme.muted, fontSize: 9, lineHeight: 14 },
  error: { marginTop: 13, color: theme.clay, fontSize: 10, lineHeight: 16 },
  primary: { minHeight: 46, marginTop: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15, backgroundColor: theme.green },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 11 },
  secondary: { minHeight: 43, marginTop: 9, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.green },
  secondaryText: { color: theme.green, fontWeight: '700', fontSize: 11 },
  finePrint: { marginTop: 10, textAlign: 'center', fontSize: 9, lineHeight: 14, color: theme.muted },
  disabled: { opacity: .65 },
  success: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: theme.background },
  successIcon: { width: 44, height: 44, textAlign: 'center', textAlignVertical: 'center', borderRadius: 24, backgroundColor: theme.sage, color: theme.green, fontSize: 23 },
})
