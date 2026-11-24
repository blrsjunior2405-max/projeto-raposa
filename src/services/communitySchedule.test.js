// Confere inscrição no canal de atualizações e limpeza do recurso ao sair da tela.
import assert from 'node:assert/strict'
import test from 'node:test'
import { addProgramItem, removeProgramItem, requestExperienceProgram, saveExperienceAvailabilityException, saveExperienceAvailabilityRules, subscribeToBookingChanges } from './communitySchedule.js'

test('a visitor sends all selected slots as one itinerary request', () => {
  let request
  const client = {
    rpc(name, payload) {
      request = { name, payload }
      return Promise.resolve({ data: 'program-id', error: null })
    },
  }

  requestExperienceProgram(client, {
    slotIds: ['slot-one', 'slot-two'],
    participants: 3,
    note: 'Chegaremos pela manhã',
    accessibilityNeeds: null,
    dietaryRestrictions: 'Alergia: castanha',
    privacyConsent: true,
  })

  assert.deepEqual(request, {
    name: 'request_experience_program',
    payload: {
      target_slot_ids: ['slot-one', 'slot-two'],
      participant_count: 3,
      visitor_note: 'Chegaremos pela manhã',
      visitor_accessibility_needs: null,
      visitor_dietary_restrictions: 'Alergia: castanha',
      visitor_privacy_consent: true,
    },
  })
})

test('community itinerary changes use protected database functions', () => {
  const calls = []
  const client = {
    rpc(name, payload) {
      calls.push({ name, payload })
      return Promise.resolve({ data: null, error: null })
    },
  }

  addProgramItem(client, { programId: 'program-id', slotId: 'slot-id', participants: 2 })
  removeProgramItem(client, 'booking-id')

  assert.deepEqual(calls, [
    {
      name: 'community_add_program_item',
      payload: { target_program_id: 'program-id', target_slot_id: 'slot-id', participant_count: 2 },
    },
    { name: 'community_remove_program_item', payload: { target_booking_id: 'booking-id' } },
  ])
})

test('season rules and date exceptions use the management database functions', () => {
  const calls = []
  const client = {
    rpc(name, payload) {
      calls.push({ name, payload })
      return Promise.resolve({ data: null, error: null })
    },
  }

  saveExperienceAvailabilityRules(client, 'cachoeira', [1, 2, 12], [0, 6])
  saveExperienceAvailabilityException(client, {
    experienceId: 'cachoeira',
    date: '2027-01-03',
    isAvailable: false,
    note: 'Período de cheia',
  })

  assert.deepEqual(calls, [
    {
      name: 'save_experience_availability_rules',
      payload: { target_experience_id: 'cachoeira', target_months: [1, 2, 12], target_weekdays: [0, 6] },
    },
    {
      name: 'save_experience_availability_exception',
      payload: {
        target_experience_id: 'cachoeira',
        target_date: '2027-01-03',
        target_is_available: false,
        target_note: 'Período de cheia',
      },
    },
  ])
})

test('booking updates subscribe to public booking changes and clean up their channel', () => {
  const callbacks = {}
  let subscriptionStatus
  let removedChannel
  const channel = {
    on(event, filter, callback) {
      callbacks.change = { event, filter, callback }
      return this
    },
    subscribe(callback) {
      subscriptionStatus = callback
      return this
    },
  }
  const client = {
    channel(name) {
      callbacks.name = name
      return channel
    },
    removeChannel(value) {
      removedChannel = value
      return Promise.resolve('ok')
    },
  }
  let changePayload
  let channelStatus
  const unsubscribe = subscribeToBookingChanges(
    client,
    (payload) => { changePayload = payload },
    (status) => { channelStatus = status },
  )

  callbacks.change.callback({ eventType: 'INSERT' })
  subscriptionStatus('SUBSCRIBED')
  unsubscribe()

  assert.match(callbacks.name, /^management-bookings-/)
  assert.deepEqual(callbacks.change, {
    event: 'postgres_changes',
    filter: { event: '*', schema: 'public', table: 'bookings' },
    callback: callbacks.change.callback,
  })
  assert.deepEqual(changePayload, { eventType: 'INSERT' })
  assert.equal(channelStatus, 'SUBSCRIBED')
  assert.equal(removedChannel, channel)
})
