(function () {
  const form = document.getElementById('reservation-form');
  const summary = document.getElementById('summary');
  const message = document.getElementById('message');
  const submit = document.getElementById('submit');
  const calendar = document.getElementById('range-calendar');
  const calendarTitle = document.getElementById('calendar-title');
  const calendarDays = document.getElementById('calendar-days');
  const selectSheet = document.getElementById('select-sheet');
  const selectTitle = document.getElementById('select-title');
  const selectOptions = document.getElementById('select-options');
  const rates = { 4: 30000, 6: 35000, 8: 40000 };
  const apiBase = (document.querySelector('meta[name="reservation-api-base"]')?.content || '').replace(/\/$/, '');
  const monthFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  let calendarMonth = firstDayOfMonth(new Date());
  let activeSelect = null;

  function boolValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  }

  function cleanPhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function nightsBetween(checkin, checkout) {
    if (!checkin || !checkout) return 0;
    const start = new Date(`${checkin}T00:00:00`);
    const end = new Date(`${checkout}T00:00:00`);
    return Math.round((end - start) / 86400000);
  }

  function parseDate(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12));
  }

  function formatDate(date) {
    return date.toISOString().slice(0, 10);
  }

  function firstDayOfMonth(date) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 12));
  }

  function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  function addMonths(date, months) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12));
  }

  function formatWon(value) {
    return `${value.toLocaleString('ko-KR')}원`;
  }

  function readForm() {
    const data = new FormData(form);
    return {
      branch: String(data.get('branch') || ''),
      source: 'instagram_bio',
      dog_name: String(data.get('dog_name') || '').trim(),
      breed: String(data.get('breed') || '').trim(),
      weight_kg: Number(data.get('weight_kg')),
      checkin: String(data.get('checkin') || ''),
      checkout: String(data.get('checkout') || ''),
      neutered: boolValue(String(data.get('neutered') || '')),
      vaccination_confirmed: boolValue(String(data.get('vaccination_confirmed') || '')),
      kindergarten_class: String(data.get('kindergarten_class') || ''),
      guardian_phone: cleanPhone(data.get('guardian_phone')),
      special_notes: String(data.get('special_notes') || '').trim(),
      company: String(data.get('company') || '')
    };
  }

  function applyBranchFromQuery() {
    const branch = new URLSearchParams(window.location.search).get('branch');
    if (branch === 'sasang' || branch === 'eomgung') {
      form.elements.branch.value = branch;
      form.elements.branch.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function setMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type || ''}`.trim();
  }

  function selectedOptionText(select) {
    return select.selectedOptions[0]?.textContent || select.options[0]?.textContent || '선택';
  }

  function syncSelectButton(select) {
    const button = select.nextElementSibling;
    if (!button || !button.classList.contains('select-trigger')) return;
    const value = selectedOptionText(select);
    button.querySelector('.select-trigger-value').textContent = value;
    button.classList.toggle('is-placeholder', !select.value);
    button.setAttribute('aria-label', `${select.closest('label')?.querySelector('span')?.textContent || '항목'}: ${value}`);
  }

  function syncAllSelectButtons() {
    form.querySelectorAll('select').forEach(syncSelectButton);
  }

  function closeSelectSheet() {
    selectSheet.hidden = true;
    selectSheet.classList.remove('is-open');
    document.body.classList.remove('sheet-open');
    activeSelect = null;
  }

  function chooseSelectValue(value) {
    if (!activeSelect) return;
    activeSelect.value = value;
    syncSelectButton(activeSelect);
    activeSelect.dispatchEvent(new Event('input', { bubbles: true }));
    activeSelect.dispatchEvent(new Event('change', { bubbles: true }));
    closeSelectSheet();
  }

  function openSelectSheet(select) {
    activeSelect = select;
    const label = select.closest('label')?.querySelector('span')?.textContent || '선택';
    selectTitle.textContent = label;
    selectOptions.textContent = '';

    Array.from(select.options).forEach((option) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'select-option';
      item.dataset.value = option.value;
      item.setAttribute('aria-pressed', String(option.value === select.value));
      item.innerHTML = `<span>${option.textContent}</span><span class="select-check" aria-hidden="true"></span>`;
      item.addEventListener('click', () => chooseSelectValue(option.value));
      selectOptions.appendChild(item);
    });

    selectSheet.hidden = false;
    requestAnimationFrame(() => selectSheet.classList.add('is-open'));
    document.body.classList.add('sheet-open');
  }

  function enhanceSelects() {
    form.querySelectorAll('select').forEach((select) => {
      if (select.classList.contains('native-select')) return;
      select.classList.add('native-select');
      select.tabIndex = -1;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'select-trigger';
      trigger.innerHTML = '<span class="select-trigger-value"></span><span class="select-chevron" aria-hidden="true"></span>';
      trigger.addEventListener('click', () => openSelectSheet(select));
      select.insertAdjacentElement('afterend', trigger);
      syncSelectButton(select);
      select.addEventListener('change', () => syncSelectButton(select));
    });

    selectSheet.querySelectorAll('[data-select-close]').forEach((control) => {
      control.addEventListener('click', closeSelectSheet);
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !selectSheet.hidden) closeSelectSheet();
    });
  }

  function refreshSummary() {
    const value = readForm();
    const nights = nightsBetween(value.checkin, value.checkout);
    const rate = rates[value.weight_kg];
    if (!value.weight_kg || !value.checkin || !value.checkout) {
      summary.textContent = '날짜와 체중을 선택하면 예상 금액이 표시됩니다.';
      return;
    }
    if (nights <= 0) {
      summary.textContent = '체크아웃 날짜는 체크인 날짜보다 뒤로 선택해주세요.';
      return;
    }
    const amount = rate * nights;
    if (value.kindergarten_class === '매일반') {
      summary.textContent = `${nights}박 · 정상가 ${formatWon(amount)} · 매장 확인 후 할인승인 시 평일 50%, 주말·공휴일 30% 할인이 적용됩니다.`;
      return;
    }
    summary.textContent = `${nights}박 · 1박 ${formatWon(rate)} · 결제 예정 ${formatWon(amount)}`;
  }

  function renderCalendar() {
    const checkin = parseDate(form.elements.checkin.value);
    const checkout = parseDate(form.elements.checkout.value);
    const monthStart = firstDayOfMonth(calendarMonth);
    const firstCell = addDays(monthStart, -monthStart.getUTCDay());

    calendarTitle.textContent = monthFormatter.format(monthStart);
    calendarDays.textContent = '';

    for (let i = 0; i < 42; i += 1) {
      const date = addDays(firstCell, i);
      const dateKey = formatDate(date);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'calendar-day';
      button.dataset.date = dateKey;
      button.textContent = String(date.getUTCDate());
      button.setAttribute('aria-label', dateKey);

      if (date.getUTCMonth() !== monthStart.getUTCMonth()) button.classList.add('is-muted');
      if (checkin && dateKey === formatDate(checkin)) button.classList.add('is-start', 'is-in-range');
      if (checkout && dateKey === formatDate(checkout)) button.classList.add('is-end', 'is-in-range');
      if (checkin && checkout && date > checkin && date < checkout) button.classList.add('is-in-range');

      button.addEventListener('click', () => selectRangeDate(date));
      calendarDays.appendChild(button);
    }
  }

  function selectRangeDate(date) {
    const checkin = parseDate(form.elements.checkin.value);
    const checkout = parseDate(form.elements.checkout.value);
    const selected = formatDate(date);

    if (!checkin || checkout || date <= checkin) {
      form.elements.checkin.value = selected;
      form.elements.checkout.value = '';
    } else {
      form.elements.checkout.value = selected;
    }

    form.elements.checkin.dispatchEvent(new Event('change', { bubbles: true }));
    form.elements.checkout.dispatchEvent(new Event('change', { bubbles: true }));
    renderCalendar();
  }

  function syncCalendarMonthFromInput(event) {
    const selected = parseDate(event.target.value);
    if (selected) calendarMonth = firstDayOfMonth(selected);
    renderCalendar();
  }

  form.addEventListener('input', refreshSummary);
  form.addEventListener('change', refreshSummary);
  form.addEventListener('reset', () => {
    requestAnimationFrame(() => {
      syncAllSelectButtons();
      renderCalendar();
      refreshSummary();
    });
  });
  form.elements.checkin.addEventListener('change', syncCalendarMonthFromInput);
  form.elements.checkout.addEventListener('change', syncCalendarMonthFromInput);
  calendar.querySelector('[data-calendar-prev]').addEventListener('click', () => {
    calendarMonth = addMonths(calendarMonth, -1);
    renderCalendar();
  });
  calendar.querySelector('[data-calendar-next]').addEventListener('click', () => {
    calendarMonth = addMonths(calendarMonth, 1);
    renderCalendar();
  });
  submit.addEventListener('click', () => {
    submit.classList.remove('is-popping');
    void submit.offsetWidth;
    submit.classList.add('is-popping');
  });
  submit.addEventListener('animationend', () => {
    submit.classList.remove('is-popping');
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const value = readForm();
    const nights = nightsBetween(value.checkin, value.checkout);

    if (value.company) {
      setMessage('예약 요청이 접수되었습니다. 매장 확인 후 안내드립니다.', 'success');
      form.reset();
      refreshSummary();
      return;
    }
    if (!value.branch || !value.dog_name || !value.breed || !value.weight_kg || !value.checkin || !value.checkout || value.neutered === null || value.vaccination_confirmed === null || nights <= 0) {
      setMessage('지점, 강아지 정보, 일정, 필수 확인 항목을 모두 입력해주세요.', 'error');
      return;
    }
    if (!/^\d{10,11}$/.test(value.guardian_phone)) {
      setMessage('보호자 연락처는 하이픈 없이 10~11자리 숫자로 입력해주세요.', 'error');
      return;
    }

    submit.disabled = true;
    setMessage('예약 요청을 접수하고 있습니다.');
    try {
      const response = await fetch(`${apiBase}/api/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(value)
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || '예약 요청에 실패했습니다.');
      setMessage('예약 요청이 접수되었습니다. 매장 확인 후 확정 문자를 보내드립니다.', 'success');
      form.reset();
      refreshSummary();
    } catch (error) {
      setMessage(error.message || '예약 요청 중 문제가 생겼습니다.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
  enhanceSelects();
  applyBranchFromQuery();
  renderCalendar();
  refreshSummary();
})();
