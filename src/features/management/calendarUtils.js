// Funções puras de data usadas pelo calendário para manter a grade previsível e testável.
export function getCalendarDateKey(value) {
  // Usa o dia local para que a chave corresponda à data que a pessoa vê no calendário.
  const date = value instanceof Date ? value : new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function buildCalendarGrid(monthDate) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()
  // A grade começa na segunda-feira e sempre ocupa seis semanas completas.
  const firstDay = new Date(year, month, 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return {
      date,
      key: getCalendarDateKey(date),
      inCurrentMonth: date.getMonth() === month,
    }
  })
}

export function groupCalendarBookingsByDate(bookings) {
  // Pedidos cancelados permanecem no histórico, mas não ocupam espaço na agenda.
  return bookings.reduce((groups, booking) => {
    if (booking.status === 'cancelled') return groups
    const key = getCalendarDateKey(booking.scheduled_for)
    groups[key] ||= []
    groups[key].push(booking)
    return groups
  }, {})
}
