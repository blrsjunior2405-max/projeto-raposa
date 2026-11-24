// Apresenta pedidos por dia e permite explorar agenda, atividade, situação e dados do visitante.
import { useEffect, useMemo, useRef, useState } from 'react'
import { buildCalendarGrid, getCalendarDateKey, groupCalendarBookingsByDate } from './calendarUtils.js'
import './ManagementCalendar.css'
import './ManagementCalendarDetails.css'

const weekDays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const statusLabels = {
  requested: 'Pendente',
  confirmed: 'Confirmada',
  completed: 'Concluída',
}
const visibleStatuses = ['requested', 'confirmed', 'completed']

function monthLabel(date) {
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default function ManagementCalendar({ bookings, liveUpdates = false, demoMode = false, initialSelectedDate }) {
  const [experienceFilter, setExperienceFilter] = useState('all')
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [calendarView, setCalendarView] = useState('month')
  const [visibleMonth, setVisibleMonth] = useState(() => {
    if (initialSelectedDate) {
      const initialDate = new Date(`${initialSelectedDate}T12:00:00`)
      return new Date(initialDate.getFullYear(), initialDate.getMonth(), 1)
    }
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate || getCalendarDateKey(new Date()))
  const dayButtonRefs = useRef(new Map())
  const closeButtonRef = useRef(null)
  // Os dados exibidos são derivados das reservas recebidas e do filtro, sem cópias no estado.
  const calendarDays = useMemo(() => buildCalendarGrid(visibleMonth), [visibleMonth])
  const displayedCalendarRows = useMemo(() => {
    if (calendarView === 'month') {
      return Array.from({ length: 6 }, (_, index) => calendarDays.slice(index * 7, index * 7 + 7))
    }
    const selected = new Date(`${selectedDate}T12:00:00`)
    const mondayOffset = (selected.getDay() + 6) % 7
    const monday = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate() - mondayOffset)
    return [Array.from({ length: 7 }, (_, index) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + index)
      return {
        date,
        key: getCalendarDateKey(date),
        inCurrentMonth: date.getMonth() === visibleMonth.getMonth(),
      }
    })]
  }, [calendarDays, calendarView, selectedDate, visibleMonth])
  const visibleCalendarLabel = useMemo(() => {
    if (calendarView === 'month') return monthLabel(visibleMonth)
    const dates = displayedCalendarRows[0]
    return `${dates[0].date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}–${dates[6].date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  }, [calendarView, displayedCalendarRows, visibleMonth])
  const experienceOptions = useMemo(() => {
    const titles = bookings
      .filter((booking) => booking.status !== 'cancelled')
      .map((booking) => booking.experience?.title)
      .filter(Boolean)
    return [...new Set(titles)].sort((first, second) => first.localeCompare(second, 'pt-BR'))
  }, [bookings])
  const filteredBookings = useMemo(() => {
    if (experienceFilter === 'all') return bookings
    return bookings.filter((booking) => booking.experience?.title === experienceFilter)
  }, [bookings, experienceFilter])
  const bookingsByDate = useMemo(() => groupCalendarBookingsByDate(filteredBookings), [filteredBookings])
  const selectedBookings = bookingsByDate[selectedDate] || []

  useEffect(() => {
    if (!selectedBooking) return undefined

    function handleDialogKeyDown(event) {
      if (event.key === 'Escape') setSelectedBooking(null)
    }

    window.addEventListener('keydown', handleDialogKeyDown)
    closeButtonRef.current?.focus()
    return () => window.removeEventListener('keydown', handleDialogKeyDown)
  }, [selectedBooking])

  function changeMonth(offset) {
    const nextMonth = calendarView === 'month'
      ? new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1)
      : new Date(new Date(`${selectedDate}T12:00:00`).getFullYear(), new Date(`${selectedDate}T12:00:00`).getMonth(), new Date(`${selectedDate}T12:00:00`).getDate() + offset * 7)
    setVisibleMonth(nextMonth)
    setSelectedDate(getCalendarDateKey(calendarView === 'month' ? nextMonth : new Date(nextMonth.getFullYear(), nextMonth.getMonth(), nextMonth.getDate() + ((1 - nextMonth.getDay() + 7) % 7))))
  }

  function goToToday() {
    const today = new Date()
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(getCalendarDateKey(today))
  }

  function selectDate(day) {
    setSelectedDate(day.key)
    if (!day.inCurrentMonth) {
      setVisibleMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1))
    }
  }

  function handleDayKeyDown(event, day) {
    // As teclas de seta, Home/End e PageUp/PageDown permitem navegar sem mouse.
    let nextDate
    const weekdayOffset = (day.date.getDay() + 6) % 7
    if (event.key === 'ArrowLeft') nextDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() - 1)
    if (event.key === 'ArrowRight') nextDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() + 1)
    if (event.key === 'ArrowUp') nextDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() - 7)
    if (event.key === 'ArrowDown') nextDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() + 7)
    if (event.key === 'Home') nextDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() - weekdayOffset)
    if (event.key === 'End') nextDate = new Date(day.date.getFullYear(), day.date.getMonth(), day.date.getDate() + 6 - weekdayOffset)
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      const monthOffset = event.key === 'PageUp' ? -1 : 1
      const targetMonth = day.date.getMonth() + monthOffset * (event.shiftKey ? 12 : 1)
      const lastDayOfMonth = new Date(day.date.getFullYear(), targetMonth + 1, 0).getDate()
      nextDate = new Date(day.date.getFullYear(), targetMonth, Math.min(day.date.getDate(), lastDayOfMonth))
    }

    if (!nextDate) return
    event.preventDefault()
    const nextDay = {
      date: nextDate,
      key: getCalendarDateKey(nextDate),
      inCurrentMonth: nextDate.getMonth() === visibleMonth.getMonth() && nextDate.getFullYear() === visibleMonth.getFullYear(),
    }
    selectDate(nextDay)
    window.requestAnimationFrame(() => dayButtonRefs.current.get(nextDay.key)?.focus())
  }

  function formatBookingDate(value) {
    return new Date(value).toLocaleString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return <section className="management-calendar" aria-label="Calendário de visitas agendadas">
    <div className="calendar-month-heading">
      <button type="button" aria-label={calendarView === 'month' ? 'Mês anterior' : 'Semana anterior'} onClick={() => changeMonth(-1)}>‹</button>
      <h3>{visibleCalendarLabel}</h3>
      <button type="button" aria-label={calendarView === 'month' ? 'Próximo mês' : 'Próxima semana'} onClick={() => changeMonth(1)}>›</button>
      <button type="button" className="calendar-today-button" onClick={goToToday}>Hoje</button>
      <span className={`calendar-live-status${demoMode ? ' is-demo' : liveUpdates ? ' is-live' : ''}`} role="status"><i aria-hidden="true"/> {demoMode ? 'Demonstração' : liveUpdates ? 'Ao vivo' : 'Atualização manual'}</span>
    </div>
    <div className="calendar-view-switch" role="group" aria-label="Visualização do calendário">
      <button type="button" aria-pressed={calendarView === 'month'} className={calendarView === 'month' ? 'active' : ''} onClick={() => setCalendarView('month')}>Mês</button>
      <button type="button" aria-pressed={calendarView === 'week'} className={calendarView === 'week' ? 'active' : ''} onClick={() => setCalendarView('week')}>Semana</button>
    </div>
    <div className="calendar-tools">
      <label className="calendar-filter">Filtrar atividade
        <select value={experienceFilter} onChange={(event) => setExperienceFilter(event.target.value)}>
          <option value="all">Todas as atividades</option>
          {experienceOptions.map((title) => <option value={title} key={title}>{title}</option>)}
        </select>
      </label>
      <div className="calendar-legend" aria-label="Legenda de status">
        <span><i className="calendar-status-dot status-requested" aria-hidden="true"/> Pendente</span>
        <span><i className="calendar-status-dot status-confirmed" aria-hidden="true"/> Confirmada</span>
        <span><i className="calendar-status-dot status-completed" aria-hidden="true"/> Concluída</span>
      </div>
    </div>
    <div className="calendar-layout">
      <div className="calendar-grid" role="grid" aria-label={`Agenda de ${monthLabel(visibleMonth)}`}>
        <div className="calendar-week-row" role="row">{weekDays.map((day) => <span className="calendar-weekday" role="columnheader" key={day}>{day}</span>)}</div>
        {displayedCalendarRows.map((week, weekIndex) => <div className="calendar-week-row" role="row" key={`${calendarView}-${weekIndex}-${week[0].key}`}>
          {week.map((day) => {
            const dayBookings = bookingsByDate[day.key] || []
            const dayStatuses = [...new Set(dayBookings.map((booking) => booking.status))]
            const isSelected = selectedDate === day.key
            return <div className="calendar-cell" role="gridcell" key={day.key}>
              <button
                type="button"
                ref={(element) => {
                  if (element) dayButtonRefs.current.set(day.key, element)
                  else dayButtonRefs.current.delete(day.key)
                }}
                tabIndex={isSelected ? 0 : -1}
                className={`calendar-day${day.inCurrentMonth ? '' : ' outside-month'}${isSelected ? ' selected-day' : ''}${dayBookings.length ? ' has-bookings' : ''}`}
                aria-pressed={isSelected}
                aria-label={`${day.date.toLocaleDateString('pt-BR', { dateStyle: 'full' })}, ${dayBookings.length} ${dayBookings.length === 1 ? 'visita agendada' : 'visitas agendadas'}`}
                onClick={() => selectDate(day)}
                onKeyDown={(event) => handleDayKeyDown(event, day)}
              >
                <span>{day.date.getDate()}</span>
                {dayBookings.length > 0 && <span className="calendar-day-indicators">
                  <span className="calendar-day-count">{dayBookings.length}</span>
                  <span className="calendar-day-statuses" aria-hidden="true">{dayStatuses.map((status) => <i className={`calendar-status-dot status-${visibleStatuses.includes(status) ? status : 'other'}`} key={status}/>)}</span>
                </span>}
              </button>
            </div>
          })}
        </div>)}
      </div>
      <aside className="calendar-details" aria-live="polite">
        <h4>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
        {selectedBookings.length ? <div className="calendar-bookings">
          {selectedBookings.map((booking) => <article className="calendar-booking" key={booking.id}>
            <div className="calendar-booking-time">{new Date(booking.scheduled_for).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            <div className="calendar-booking-info">
              <b>{booking.customer?.full_name || 'Visitante'}</b>
              <span>{booking.experience?.title || 'Experiência'}</span>
              <span className="calendar-booking-status"><i className={`calendar-status-dot status-${visibleStatuses.includes(booking.status) ? booking.status : 'other'}`} aria-hidden="true"/>{booking.participants} {booking.participants === 1 ? 'pessoa' : 'pessoas'} · {statusLabels[booking.status] || booking.status}</span>
              {booking.customer?.phone && <a href={`tel:${booking.customer.phone}`}>{booking.customer.phone}</a>}
              <button type="button" className="calendar-booking-details" onClick={() => setSelectedBooking(booking)}>Ver detalhes</button>
            </div>
          </article>)}
        </div> : <p className="calendar-empty">Nenhum pedido ativo nesta data.</p>}
      </aside>
    </div>
    <p className="calendar-help">Selecione uma data para ver visitantes, horários e atividades. Pedidos cancelados não aparecem no calendário.</p>
    {selectedBooking && <div className="calendar-dialog-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) setSelectedBooking(null)
    }}>
      <section className="calendar-booking-dialog" role="dialog" aria-modal="true" aria-labelledby="calendar-dialog-title">
        <div className="calendar-dialog-heading">
          <div><span className="eyebrow">DETALHES DO AGENDAMENTO</span><h3 id="calendar-dialog-title">{selectedBooking.customer?.full_name || 'Visitante'}</h3></div>
          <button ref={closeButtonRef} type="button" className="calendar-dialog-close" aria-label="Fechar detalhes" onClick={() => setSelectedBooking(null)}>×</button>
        </div>
        <dl className="calendar-dialog-fields">
          <div><dt>Atividade</dt><dd>{selectedBooking.experience?.title || 'Experiência'}</dd></div>
          <div><dt>Data e horário</dt><dd>{formatBookingDate(selectedBooking.scheduled_for)}</dd></div>
          <div><dt>Situação</dt><dd><span className={`calendar-dialog-status status-${visibleStatuses.includes(selectedBooking.status) ? selectedBooking.status : 'other'}`}>{statusLabels[selectedBooking.status] || selectedBooking.status}</span></dd></div>
          <div><dt>Participantes</dt><dd>{selectedBooking.participants} {selectedBooking.participants === 1 ? 'pessoa' : 'pessoas'}</dd></div>
          <div><dt>Telefone</dt><dd>{selectedBooking.customer?.phone ? <a href={`tel:${selectedBooking.customer.phone}`}>{selectedBooking.customer.phone}</a> : 'Não informado'}</dd></div>
          <div><dt>Observações</dt><dd>{selectedBooking.customer_note || 'Nenhuma observação informada.'}</dd></div>
          {selectedBooking.accessibility_needs && <div><dt>Acessibilidade</dt><dd>{selectedBooking.accessibility_needs}</dd></div>}
          {selectedBooking.dietary_restrictions && <div><dt>Alergias e restrições</dt><dd>{selectedBooking.dietary_restrictions}</dd></div>}
        </dl>
      </section>
    </div>}
  </section>
}
