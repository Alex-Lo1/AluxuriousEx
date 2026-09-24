document.addEventListener('DOMContentLoaded', () => {
  const flow = document.getElementById('bookingFlow');
  if (!flow) return;

  const errorBox = document.getElementById('bookingError');
  const confirmed = document.getElementById('bookingConfirmed');
  const steps = document.getElementById('bookingSteps');
  const state = {
    services: [],
    service: null,
    date: '',
    slot: null,
    customer: { name: '', email: '', phone: '', notes: '' },
    gift: null,
    month: null,
    openDates: new Set(),
  };

  const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const showError = (message) => {
    errorBox.hidden = !message;
    errorBox.textContent = message || '';
  };

  const NAME_PATTERN = /^[\p{L}\p{M}'’.\- ]{2,80}$/u;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PHONE_PATTERN = /^[0-9+().\-\s]{7,30}$/;
  const GIFT_PATTERN = /^GIFT-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;
  const detailFields = ['customerName', 'customerEmail', 'customerPhone', 'giftCode', 'customerNotes'];
  let detailsChecked = false;

  const setFieldError = (id, message) => {
    const field = document.getElementById(id);
    const error = document.getElementById(`${id}Error`);
    if (!field || !error) return;
    field.classList.toggle('is-invalid', Boolean(message));
    field.setAttribute('aria-invalid', message ? 'true' : 'false');
    error.hidden = !message;
    error.textContent = message || '';
  };

  const detailMessages = (customer, giftCode) => ({
    customerName: NAME_PATTERN.test(customer.name) ? '' : 'Enter your full name.',
    customerEmail: customer.email.length <= 254 && EMAIL_PATTERN.test(customer.email) ? '' : 'Enter a valid email address.',
    customerPhone: PHONE_PATTERN.test(customer.phone) && customer.phone.replace(/\D/g, '').length >= 7 ? '' : 'Enter a valid phone number.',
    giftCode: giftCode && !GIFT_PATTERN.test(giftCode) ? 'Enter a valid gift code.' : '',
    customerNotes: customer.notes.length > 1000 ? 'Notes must be 1000 characters or fewer.' : '',
  });

  const showDetailErrors = (messages) => {
    let firstInvalid = null;
    detailFields.forEach((id) => {
      setFieldError(id, messages[id] || '');
      if (messages[id] && !firstInvalid) firstInvalid = document.getElementById(id);
    });
    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
  };

  const formatPrice = (price) => {
    if (price == null || price === '') return 'Price on request';
    const amount = Number(price);
    return Number.isInteger(amount) ? `£${amount}` : `£${amount.toFixed(2)}`;
  };

  const formatDuration = (minutes) => {
    const hours = Math.floor(minutes / 60);
    const remainder = minutes % 60;
    if (hours && remainder) return `${hours} hour${hours > 1 ? 's' : ''} ${remainder} mins`;
    if (hours) return `${hours} hour${hours > 1 ? 's' : ''}`;
    return `${remainder} mins`;
  };

  const formatDate = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
    return `${weekday} ${day} ${MONTHS[month - 1]} ${year}`;
  };

  const isoDate = (year, monthIndex, day) => {
    const date = new Date(Date.UTC(year, monthIndex, day));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  };

  const showStep = (step) => {
    showError('');
    flow.hidden = false;
    confirmed.hidden = true;
    document.body.classList.remove('voucher-modal-open');
    document.querySelectorAll('[data-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.panel !== step;
    });
    steps.querySelectorAll('li').forEach((item) => {
      item.classList.toggle('is-current', item.dataset.step === step);
    });
  };

  const selectionText = () => {
    if (!state.service) return '';
    const bits = [`${state.service.name} · ${formatDuration(state.service.duration)} · ${formatPrice(state.service.price)}`];
    if (state.date) bits.push(formatDate(state.date));
    if (state.slot) bits.push(`${state.slot.start}–${state.slot.end}`);
    return bits.join(' · ');
  };

  const renderSummary = (target, rows) => {
    target.replaceChildren();
    rows.forEach(([label, value]) => {
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      target.append(term, detail);
    });
  };

  const serviceButton = (service) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'booking-service';
    if (state.service && state.service.id === service.id) button.classList.add('is-selected');
    button.innerHTML = `
      <span class="booking-service-name"></span>
      <span class="booking-service-meta"></span>
      <span class="booking-service-desc"></span>
    `;
    button.querySelector('.booking-service-name').textContent = service.name;
    button.querySelector('.booking-service-meta').textContent = `${formatDuration(service.duration)} · ${formatPrice(service.price)}`;
    button.querySelector('.booking-service-desc').textContent = service.description;
    button.addEventListener('click', () => {
      state.service = service;
      state.date = '';
      state.slot = null;
      const today = new Date();
      state.month = { year: today.getFullYear(), month: today.getMonth() };
      showStep('date');
      loadMonth();
    });
    return button;
  };

  const renderServices = () => {
    const list = document.getElementById('serviceList');
    const addOnSlugs = new Set(['cupping', 'iastm']);
    const groups = [
      ['Packages', (service) => service.slug.endsWith('-package')],
      ['Treatments', (service) => !service.slug.endsWith('-package') && !addOnSlugs.has(service.slug)],
      ['Add-ons', (service) => addOnSlugs.has(service.slug)],
    ];
    list.replaceChildren();
    groups.forEach(([title, include]) => {
      const services = state.services.filter(include);
      if (!services.length) return;
      const group = document.createElement('section');
      group.className = 'booking-group';
      const heading = document.createElement('h3');
      heading.className = 'service-category-title';
      heading.textContent = title;
      const grid = document.createElement('div');
      grid.className = 'booking-services';
      services.forEach((service) => grid.append(serviceButton(service)));
      group.append(heading, grid);
      list.append(group);
    });
    applyServiceSearch();
  };

  const applyServiceSearch = () => {
    const serviceSearch = document.getElementById('serviceSearch');
    const serviceSearchClear = document.getElementById('serviceSearchClear');
    const serviceSearchStatus = document.getElementById('serviceSearchStatus');
    if (!serviceSearch) return;

    const query = serviceSearch.value.trim().toLowerCase();
    let visibleCount = 0;
    document.querySelectorAll('.booking-service').forEach((button) => {
      const name = button.querySelector('.booking-service-name')?.textContent.toLowerCase() || '';
      const matches = !query || name.includes(query);
      button.classList.toggle('is-hidden', !matches);
      if (matches) visibleCount += 1;
    });
    document.querySelectorAll('.booking-group').forEach((group) => {
      const hasVisible = Boolean(group.querySelector('.booking-service:not(.is-hidden)'));
      group.classList.toggle('is-hidden', !hasVisible);
    });
    if (serviceSearchClear) serviceSearchClear.hidden = !query;
    if (!serviceSearchStatus) return;
    if (!query) {
      serviceSearchStatus.textContent = '';
    } else if (visibleCount === 0) {
      serviceSearchStatus.textContent = 'No services match that name. Try another service name.';
    } else {
      serviceSearchStatus.textContent = `${visibleCount} service${visibleCount === 1 ? '' : 's'} found.`;
    }
  };

  const loadServices = async () => {
    const response = await fetch('/api/services');
    if (!response.ok) throw new Error('Treatments could not be loaded.');
    state.services = await response.json();
    const requested = new URLSearchParams(window.location.search).get('service');
    if (requested) {
      state.service = state.services.find((service) => service.slug === requested) || null;
    }
    renderServices();
    const serviceSearch = document.getElementById('serviceSearch');
    const serviceSearchClear = document.getElementById('serviceSearchClear');
    serviceSearch?.addEventListener('input', applyServiceSearch);
    serviceSearchClear?.addEventListener('click', () => {
      serviceSearch.value = '';
      serviceSearch.focus();
      applyServiceSearch();
    });
    if (state.service) {
      const today = new Date();
      state.month = { year: today.getFullYear(), month: today.getMonth() };
      showStep('date');
      await loadMonth();
    }
  };

  const loadMonth = async () => {
    const { year, month } = state.month;
    document.getElementById('calLabel').textContent = `${MONTHS[month]} ${year}`;
    document.getElementById('dateSelection').textContent = selectionText();
    const from = isoDate(year, month, 1);
    const to = isoDate(year, month + 1, 1);
    const response = await fetch(`/api/availability/dates?serviceId=${state.service.id}&from=${from}&to=${to}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Dates could not be loaded.');
    state.openDates = new Set(data.dates);
    renderCalendar();
  };

  const renderCalendar = () => {
    const grid = document.getElementById('calGrid');
    const { year, month } = state.month;
    const firstWeekday = new Date(Date.UTC(year, month, 1)).getUTCDay();
    const leading = (firstWeekday + 6) % 7;
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    grid.replaceChildren();

    for (let i = 0; i < leading; i += 1) {
      const blank = document.createElement('span');
      blank.className = 'calendar-blank';
      grid.append(blank);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const value = isoDate(year, month, day);
      const open = state.openDates.has(value);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-day';
      button.textContent = String(day);
      button.disabled = !open;
      button.setAttribute('aria-pressed', String(state.date === value));
      button.setAttribute('aria-label', formatDate(value));
      if (state.date === value) button.classList.add('is-selected');
      if (open) {
        button.addEventListener('click', () => {
          state.date = value;
          state.slot = null;
          showStep('time');
          loadTimes();
        });
      }
      grid.append(button);
    }

    const now = new Date();
    const current = state.month.year * 12 + state.month.month;
    const minimum = now.getFullYear() * 12 + now.getMonth();
    document.getElementById('calPrev').disabled = current <= minimum;
    document.getElementById('calNext').disabled = current >= minimum + 11;
  };

  const loadTimes = async () => {
    document.getElementById('timeSelection').textContent = selectionText();
    const box = document.getElementById('timeSlots');
    box.textContent = 'Loading times…';
    const response = await fetch(`/api/availability?serviceId=${state.service.id}&date=${state.date}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Times could not be loaded.');
    box.replaceChildren();
    if (!data.slots.length) {
      box.textContent = 'There are no appointments left on this date. Please choose another day.';
      return;
    }
    data.slots.forEach((slot) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'time-slot';
      button.textContent = slot.start;
      button.addEventListener('click', () => {
        state.slot = slot;
        document.getElementById('detailsSelection').textContent = selectionText();
        showStep('details');
      });
      box.append(button);
    });
  };

  const showConfirmation = (booking) => {
    const serviceName = booking.serviceName || state.service?.name || '';
    const when = booking.date
      ? `${formatDate(booking.date)} · ${String(booking.startTime).slice(0, 5)}\u2011${String(booking.endTime).slice(0, 5)}`
      : '';
    document.getElementById('bookingReference').textContent = booking.reference;
    document.getElementById('bookingConfirmedDetail').textContent = [serviceName, when].filter(Boolean).join(' · ');
    confirmed.hidden = false;
    document.body.classList.add('voucher-modal-open');
    confirmed.querySelector('.booking-home')?.focus();
    const url = new URL(window.location.href);
    url.searchParams.set('ref', booking.reference);
    url.searchParams.delete('service');
    window.history.replaceState({}, '', url);
  };

  document.getElementById('calPrev').addEventListener('click', () => {
    const date = new Date(Date.UTC(state.month.year, state.month.month - 1, 1));
    state.month = { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    loadMonth().catch((error) => showError(error.message));
  });

  document.getElementById('calNext').addEventListener('click', () => {
    const date = new Date(Date.UTC(state.month.year, state.month.month + 1, 1));
    state.month = { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    loadMonth().catch((error) => showError(error.message));
  });

  document.querySelectorAll('[data-goto]').forEach((button) => {
    button.addEventListener('click', () => {
      const step = button.dataset.goto;
      showStep(step);
      if (step === 'date' && state.service) {
        document.getElementById('dateSelection').textContent = selectionText();
      }
      if (step === 'time' && state.date) loadTimes().catch((error) => showError(error.message));
    });
  });

  document.getElementById('giftCode')?.addEventListener('input', (event) => {
    const field = event.currentTarget;
    const start = field.selectionStart;
    const end = field.selectionEnd;
    const upper = field.value.toUpperCase();
    if (field.value === upper) return;
    field.value = upper;
    field.setSelectionRange(start, end);
  });

  detailFields.forEach((id) => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (!detailsChecked) return;
      const form = new FormData(document.getElementById('detailsForm'));
      const customer = {
        name: String(form.get('name') || '').trim(),
        email: String(form.get('email') || '').trim(),
        phone: String(form.get('phone') || '').trim(),
        notes: String(form.get('notes') || '').trim(),
      };
      const giftCode = String(form.get('giftCode') || '').trim().toUpperCase().replace(/\s+/g, '');
      setFieldError(id, detailMessages(customer, giftCode)[id]);
    });
  });

  document.getElementById('detailsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const button = event.submitter;
    state.customer = {
      name: String(form.get('name') || '').trim(),
      email: String(form.get('email') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      notes: String(form.get('notes') || '').trim(),
    };
    state.gift = null;
    detailsChecked = true;
    const giftCode = String(form.get('giftCode') || '').trim().toUpperCase().replace(/\s+/g, '');
    if (!showDetailErrors(detailMessages(state.customer, giftCode))) return;
    if (giftCode) {
      if (button) button.disabled = true;
      try {
        const response = await fetch(`/api/gift-vouchers/check?code=${encodeURIComponent(giftCode)}&serviceId=${state.service.id}`);
        const data = await response.json();
        if (!response.ok) {
          showDetailErrors({ giftCode: data.error || 'That gift code cannot be used.' });
          return;
        }
        state.gift = data;
      } catch (error) {
        showDetailErrors({ giftCode: 'That gift code could not be checked. Please try again.' });
        return;
      } finally {
        if (button) button.disabled = false;
      }
    }
    const rows = [
      ['Name', state.customer.name],
      ['Email', state.customer.email],
      ['Phone', state.customer.phone],
      ['Treatment', state.service.name],
      ['Date', formatDate(state.date)],
      ['Time', `${state.slot.start}–${state.slot.end}`],
      ['Duration', formatDuration(state.service.duration)],
      ['Price', formatPrice(state.service.price)],
    ];
    if (state.gift) {
      rows.push(['Gift code', state.gift.code]);
      rows.push(['Voucher applied', formatPrice(state.gift.applied)]);
      rows.push(['Amount due', formatPrice(state.gift.amountDue)]);
    }
    if (state.customer.notes) rows.push(['Notes', state.customer.notes]);
    renderSummary(document.getElementById('reviewSummary'), rows);
    showStep('review');
  });

  document.getElementById('confirmBooking').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    showError('');
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: state.service.id,
          date: state.date,
          startTime: state.slot.start,
          name: state.customer.name,
          email: state.customer.email,
          phone: state.customer.phone,
          notes: state.customer.notes,
          giftCode: state.gift ? state.gift.code : '',
        }),
      });
      const data = await response.json();
      if (response.status === 409) {
        state.slot = null;
        showStep('time');
        showError(data.error);
        await loadTimes();
        return;
      }
      if (!response.ok) throw new Error(data.error || 'The booking could not be saved.');
      showConfirmation(data);
    } catch (error) {
      showError(error.message);
    } finally {
      button.disabled = false;
    }
  });

  const existingRef = new URLSearchParams(window.location.search).get('ref');
  const start = async () => {
    if (existingRef) {
      const response = await fetch(`/api/bookings/${encodeURIComponent(existingRef)}`);
      if (response.ok) {
        showConfirmation(await response.json());
        return;
      }
    }
    await loadServices();
  };

  start().catch((error) => {
    document.getElementById('serviceList').textContent = 'Treatments could not be loaded. Please refresh the page.';
    showError(error.message);
  });
});
