// Gera registros claramente fictícios para demonstrar a agenda sem gravar dados no banco.
function createDemoBooking(experience, monthDate, day, hour, index, status = 'requested') {
  // O horário é montado no fuso local antes de ser serializado para o formato ISO.
  const scheduledFor = new Date(monthDate.getFullYear(), monthDate.getMonth(), day, hour, 0)
  return {
    id: `demo-booking-${index}`,
    scheduled_for: scheduledFor.toISOString(),
    participants: index % 2 === 0 ? 2 : 4,
    status,
    customer: { full_name: `Exemplo fictício ${String(Math.ceil(index / 2)).padStart(2, '0')}` },
    experience: { title: experience.title },
  }
}

export function createDemoBookings(experiences, referenceDate = new Date()) {
  if (!experiences.length) return []

  // Distribui exemplos no mês atual e nos meses vizinhos para permitir testar a navegação.
  const bookings = []
  let bookingNumber = 1
  for (const monthOffset of [0, 1, -1]) {
    const monthDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + monthOffset, 1)
    const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
    const currentDay = monthOffset === 0 ? Math.min(referenceDate.getDate(), daysInMonth) : Math.min(7, daysInMonth)
    const sampleDays = [
      { day: currentDay, hour: 9, experienceIndex: 0 },
      { day: currentDay, hour: 14, experienceIndex: 1 },
      { day: Math.min(15, daysInMonth), hour: 10, experienceIndex: 2 },
      { day: Math.min(24, daysInMonth), hour: 8, experienceIndex: 3, status: 'confirmed' },
    ]

    for (const sample of sampleDays) {
      const experience = experiences[sample.experienceIndex % experiences.length]
      bookings.push(createDemoBooking(experience, monthDate, sample.day, sample.hour, bookingNumber, sample.status))
      bookingNumber += 1
    }
  }

  bookings.push(createDemoBooking(
    experiences[0],
    new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1),
    Math.min(20, new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate()),
    11,
    bookingNumber,
    'cancelled',
  ))

  return bookings
}

export function groupDemoBookingsByCustomer(bookings) {
  const groups = new Map()
  for (const booking of bookings) {
    const customerName = booking.customer.full_name
    const customerBookings = groups.get(customerName) || []
    customerBookings.push(booking)
    groups.set(customerName, customerBookings)
  }
  return [...groups.entries()]
}
