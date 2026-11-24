// Garante que a agenda de demonstração continue fictícia e navegue entre meses sem erro de fuso.
import assert from 'node:assert/strict'
import test from 'node:test'
import { experiences } from '../../data/experiences.js'
import { getCalendarDateKey } from './calendarUtils.js'
import { createDemoBookings, groupDemoBookingsByCustomer } from './demoBookings.js'

test('demo bookings populate adjacent months and include clearly fictitious visitors', () => {
  const referenceDate = new Date(2026, 10, 10, 12)
  const bookings = createDemoBookings(experiences, referenceDate)
  const dates = new Set(bookings.map((booking) => getCalendarDateKey(booking.scheduled_for)))
  const currentMonth = '2026-11'
  const nextMonth = '2026-12'
  const previousMonth = '2026-10'

  assert.ok([...dates].some((date) => date.startsWith(currentMonth)))
  assert.ok([...dates].some((date) => date.startsWith(nextMonth)))
  assert.ok([...dates].some((date) => date.startsWith(previousMonth)))
  assert.ok(bookings.filter((booking) => booking.status !== 'cancelled').every((booking) => booking.customer.full_name.startsWith('Exemplo fictício')))
  assert.ok(bookings.every((booking) => experiences.some((experience) => experience.title === booking.experience.title)))
  assert.ok(bookings.some((booking) => booking.status === 'cancelled'))
  const customers = groupDemoBookingsByCustomer(bookings)
  assert.ok(customers.length < bookings.length)
  assert.ok(customers.some(([, customerBookings]) => customerBookings.length > 1))
})

test('demo appointments stay on their intended local calendar day', () => {
  const referenceDate = new Date(2026, 10, 10, 12)
  const bookings = createDemoBookings(experiences, referenceDate)

  assert.equal(getCalendarDateKey(bookings[0].scheduled_for), '2026-11-10')
  assert.equal(new Date(bookings[0].scheduled_for).getHours(), 9)
})
