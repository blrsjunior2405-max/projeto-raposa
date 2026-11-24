// Centraliza consultas e operações da agenda para manter componentes focados na interface.
// Os nomes de tabelas e campos correspondem ao esquema definido nas migrações do Supabase.
const bookingFields = 'id, program_id, availability_slot_id, scheduled_for, participants, status, customer_note, accessibility_needs, dietary_restrictions, customer_id, experience_id, guide_id, customer:profiles!bookings_customer_id_fkey(full_name, phone, customer_code), experience:experiences!bookings_experience_id_fkey(id, title), guide:profiles!bookings_guide_id_fkey(full_name)'
const visitorBookingFields = 'id, program_id, experience_id, scheduled_for, participants, customer_note, accessibility_needs, dietary_restrictions, status, created_at, updated_at'
let bookingChannelSequence = 0

export function getManagementBookings(client) {
  return client.from('bookings').select(bookingFields).order('scheduled_for', { ascending: true })
}

export function getVisitorBookings(client, userId) {
  return client.from('bookings')
    .select(visitorBookingFields)
    .eq('customer_id', userId)
    .order('scheduled_for', { ascending: false })
}

export function getAvailableExperienceSlots(client) {
  // A função do banco retorna apenas horários futuros com vagas disponíveis.
  return client.rpc('get_available_experience_slots')
}

export function requestExperienceSlot(client, { slotId, participants, note, accessibilityNeeds, dietaryRestrictions, privacyConsent }) {
  // A RPC valida capacidade e grava o pedido em uma única transação no servidor.
  return client.rpc('request_experience_slot', {
    target_slot_id: slotId,
    participant_count: participants,
    visitor_note: note,
    visitor_accessibility_needs: accessibilityNeeds,
    visitor_dietary_restrictions: dietaryRestrictions,
    visitor_privacy_consent: privacyConsent,
  })
}

export function requestExperienceProgram(client, { slotIds, participants, note, accessibilityNeeds, dietaryRestrictions, privacyConsent }) {
  // Uma programação agrupa os horários escolhidos e só é criada se todos tiverem vaga.
  return client.rpc('request_experience_program', {
    target_slot_ids: slotIds,
    participant_count: participants,
    visitor_note: note,
    visitor_accessibility_needs: accessibilityNeeds,
    visitor_dietary_restrictions: dietaryRestrictions,
    visitor_privacy_consent: privacyConsent,
  })
}

export function getExperienceAvailabilityRules(client) {
  return client.from('experience_availability_rules')
    .select('experience_id, month, weekday')
    .order('experience_id')
    .order('month')
    .order('weekday')
}

export function getExperienceAvailabilityExceptions(client) {
  const today = new Date()
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return client.from('experience_availability_exceptions')
    .select('id, experience_id, available_on, is_available, note')
    .gte('available_on', todayKey)
    .order('available_on')
}

export function saveExperienceAvailabilityRules(client, experienceId, months, weekdays) {
  return client.rpc('save_experience_availability_rules', {
    target_experience_id: experienceId,
    target_months: months,
    target_weekdays: weekdays,
  })
}

export function saveExperienceAvailabilityException(client, { experienceId, date, isAvailable, note }) {
  return client.rpc('save_experience_availability_exception', {
    target_experience_id: experienceId,
    target_date: date,
    target_is_available: isAvailable,
    target_note: note,
  })
}

export function removeExperienceAvailabilityException(client, exceptionId) {
  return client.rpc('remove_experience_availability_exception', { target_exception_id: exceptionId })
}

export function addProgramItem(client, { programId, slotId, participants }) {
  return client.rpc('community_add_program_item', {
    target_program_id: programId,
    target_slot_id: slotId,
    participant_count: participants,
  })
}

export function removeProgramItem(client, bookingId) {
  return client.rpc('community_remove_program_item', { target_booking_id: bookingId })
}

export function cancelOwnBooking(client, bookingId) {
  return client.rpc('cancel_own_booking', { target_booking_id: bookingId })
}

export function assignBookingGuide(client, bookingId, guideId) {
  return client.from('bookings').update({ guide_id: guideId || null }).eq('id', bookingId)
}

export function updateBookingStatus(client, role, bookingId, nextStatus) {
  // A gestão administra diretamente; a RPC do guia confere que o pedido foi atribuído a ele.
  return role === 'community_admin'
    ? client.from('bookings').update({ status: nextStatus }).eq('id', bookingId)
    : client.rpc('guide_update_booking_status', { target_booking_id: bookingId, next_status: nextStatus })
}

export function subscribeToBookingChanges(client, onChange, onStatus) {
  // Cada inscrição recebe um canal único; a função retornada remove o canal ao desmontar a tela.
  bookingChannelSequence += 1
  const channel = client
    .channel(`management-bookings-${Date.now()}-${bookingChannelSequence}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, onChange)
    .subscribe(onStatus)

  return () => {
    void client.removeChannel(channel)
  }
}
