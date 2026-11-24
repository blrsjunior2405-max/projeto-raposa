// Testes das funções puras que montam a grade e organizam pedidos por data.
import assert from 'node:assert/strict'
import test from 'node:test'
import { buildCalendarGrid, getCalendarDateKey, groupCalendarBookingsByDate } from './calendarUtils.js'

test('calendar grid starts on Monday and has complete weeks', () => {
  const grid = buildCalendarGrid(new Date(2024, 8, 15))

  assert.equal(grid.length, 42)
  assert.equal(grid[0].date.getDay(), 1)
  assert.equal(grid[0].key, '2024-08-26')
  assert.equal(grid.find((day) => day.key === '2024-08-31').inCurrentMonth, false)
  assert.equal(grid.find((day) => day.key === '2024-09-01').inCurrentMonth, true)
  assert.equal(grid.find((day) => day.key === '2024-09-30').inCurrentMonth, true)
})

test('calendar grid handles leap days', () => {
  const grid = buildCalendarGrid(new Date(2024, 1, 1))

  assert.ok(grid.some((day) => day.key === '2024-02-29' && day.inCurrentMonth))
  assert.equal(getCalendarDateKey(new Date(2024, 1, 29)), '2024-02-29')
})

test('active bookings are grouped by scheduled date and cancelled requests are omitted', () => {
  const grouped = groupCalendarBookingsByDate([
    { id: 'requested', scheduled_for: '2024-09-03T13:00:00', status: 'requested' },
    { id: 'confirmed', scheduled_for: '2024-09-03T16:00:00', status: 'confirmed' },
    { id: 'cancelled', scheduled_for: '2024-09-03T18:00:00', status: 'cancelled' },
  ])

  assert.deepEqual(grouped['2024-09-03'].map((booking) => booking.id), ['requested', 'confirmed'])
  assert.equal(grouped['2024-09-04'], undefined)
})
