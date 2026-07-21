(function () {
  const form = document.getElementById('reservation-form');
  const summary = document.getElementById('summary');
  const message = document.getElementById('message');
  const submit = document.getElementById('submit');
  const calendar = document.getElementById('range-calendar');
  const calendarTitle = document.getElementById('calendar-title');
  const calendarDays = document.getElementById('calendar-days');
  const dogList = document.getElementById('dog-list');
  const addDogButton = document.getElementById('add-dog');
  const rates = { 4: 30000, 6: 35000, 8: 40000 };
  const maxDogs = 5;
  const apiBase = (document.querySelector('meta[name="reservation-api-base"]')?.content || '').replace(/\/$/, '');
  const monthFormatter = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', timeZone: 'UTC' });
  const today = parseDate(todayKey());
  let calendarMonth = firstDayOfMonth(today || new Date());

  function boolValue(value) {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return null;
  }

  function cleanPhone(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function todayKey() {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
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

  function fieldValue(container, name) {
    const field = container.querySelector(`[name="${name}"]`);
    return field ? field.value : '';
  }

  function readDogs() {
    return Array.from(dogList.querySelectorAll('[data-dog-card]')).map((card) => ({
      dog_name: String(fieldValue(card, 'dog_name') || '').trim(),
      breed: String(fieldValue(card, 'breed') || '').trim(),
      weight_kg: Number(fieldValue(card, 'weight_kg')),
      neutered: boolValue(String(fieldValue(card, 'neutered') || '')),
      vaccination_confirmed: boolValue(String(fieldValue(card, 'vaccination_confirmed') || '')),
      kindergarten_class: String(fieldValue(card, 'kindergarten_class') || '')
    }));
  }

  function readForm() {
    const data = new FormData(form);
    const dogs = readDogs();
    const firstDog = dogs[0] || {};
    return {
      branch: String(data.get('branch') || ''),
      source: 'instagram_bio',
      dogs,
      dog_name: firstDog.dog_name || '',
      breed: firstDog.breed || '',
      weight_kg: firstDog.weight_kg || 0,
      checkin: String(data.get('checkin') || ''),
      checkout: String(data.get('checkout') || ''),
      neutered: firstDog.neutered ?? null,
      vaccination_confirmed: firstDog.vaccination_confirmed ?? null,
      kindergarten_class: firstDog.kindergarten_class || '',
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

  function syncDateLimits() {
    const minCheckin = todayKey();
    const checkinInput = form.elements.checkin;
    const checkoutInput = form.elements.checkout;
    checkinInput.min = minCheckin;

    if (checkinInput.value && checkinInput.value < minCheckin) {
      checkinInput.value = '';
      checkoutInput.value = '';
      setMessage('오늘 이전 날짜는 예약할 수 없습니다.', 'error');
    }

    const checkin = parseDate(checkinInput.value);
    const minCheckout = checkin ? formatDate(addDays(checkin, 1)) : formatDate(addDays(parseDate(minCheckin), 1));
    checkoutInput.min = minCheckout;
    if (checkoutInput.value && checkoutInput.value < minCheckout) {
      checkoutInput.value = '';
    }
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
    syncSelectMenu(select);
  }

  function syncAllSelectButtons() {
    form.querySelectorAll('select').forEach(syncSelectButton);
  }

  function syncSelectMenu(select) {
    const menu = select.nextElementSibling?.nextElementSibling;
    if (!menu || !menu.classList.contains('select-menu')) return;
    menu.querySelectorAll('.select-option').forEach((option) => {
      option.setAttribute('aria-selected', String(option.dataset.value === select.value));
    });
  }

  function closeSelectMenus(exceptSelect) {
    form.querySelectorAll('select').forEach((select) => {
      if (exceptSelect && select === exceptSelect) return;
      const trigger = select.nextElementSibling;
      const menu = trigger?.nextElementSibling;
      trigger?.classList.remove('is-open');
      trigger?.setAttribute('aria-expanded', 'false');
      if (menu?.classList.contains('select-menu')) menu.hidden = true;
    });
  }

  function chooseSelectValue(select, value) {
    select.value = value;
    syncSelectButton(select);
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    closeSelectMenus();
  }

  function toggleSelectMenu(select) {
    const trigger = select.nextElementSibling;
    const menu = trigger?.nextElementSibling;
    if (!trigger || !menu?.classList.contains('select-menu')) return;
    const shouldOpen = menu.hidden;
    closeSelectMenus(select);
    trigger.classList.toggle('is-open', shouldOpen);
    menu.hidden = !shouldOpen;
    if (shouldOpen) syncSelectMenu(select);
  }

  function enhanceSelects() {
    form.querySelectorAll('select').forEach((select) => {
      if (select.classList.contains('native-select')) return;
      select.classList.add('native-select');
      select.tabIndex = -1;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.className = 'select-trigger';
      trigger.setAttribute('aria-haspopup', 'listbox');
      trigger.setAttribute('aria-expanded', 'false');
      trigger.innerHTML = '<span class="select-trigger-value"></span><span class="select-chevron" aria-hidden="true"></span>';
      const menu = document.createElement('div');
      menu.className = 'select-menu';
      menu.hidden = true;
      menu.setAttribute('role', 'listbox');
      Array.from(select.options).forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'select-option';
        item.dataset.value = option.value;
        item.setAttribute('role', 'option');
        item.innerHTML = `<span>${option.textContent}</span><span class="select-check" aria-hidden="true"></span>`;
        item.addEventListener('click', (event) => {
          event.stopPropagation();
          chooseSelectValue(select, option.value);
        });
        menu.appendChild(item);
      });
      trigger.addEventListener('click', (event) => {
        event.stopPropagation();
        toggleSelectMenu(select);
        trigger.setAttribute('aria-expanded', String(trigger.classList.contains('is-open')));
      });
      select.insertAdjacentElement('afterend', trigger);
      trigger.insertAdjacentElement('afterend', menu);
      syncSelectButton(select);
      select.addEventListener('change', () => syncSelectButton(select));
    });

    document.addEventListener('click', () => closeSelectMenus());
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSelectMenus();
    });
  }

  function dogCardTemplate(index) {
    const card = document.createElement('div');
    card.className = 'dog-card';
    card.dataset.dogCard = '';
    card.innerHTML = `
      <div class="dog-card-head">
        <strong>${index}번째 강아지</strong>
        <button class="dog-remove" type="button" aria-label="강아지 삭제">삭제</button>
      </div>
      <label>
        <span>강아지 이름</span>
        <input type="text" name="dog_name" maxlength="32" placeholder="예: 밴쭈" required>
      </label>
      <label>
        <span>종류</span>
        <input type="text" name="breed" maxlength="40" placeholder="예: 말티즈, 푸들, 비숑" required>
      </label>
      <label>
        <span>체중</span>
        <select name="weight_kg" required>
          <option value="">체중 선택</option>
          <option value="4">4kg 이하</option>
          <option value="6">4kg 초과~6kg 이하</option>
          <option value="8">6kg 초과~8kg 이하</option>
        </select>
      </label>
      <div class="grid">
        <label>
          <span>중성화 여부</span>
          <select name="neutered" required>
            <option value="">선택</option>
            <option value="true">완료</option>
            <option value="false">미완료</option>
          </select>
        </label>
        <label>
          <span>접종 여부</span>
          <select name="vaccination_confirmed" required>
            <option value="">선택</option>
            <option value="true">확인 완료</option>
            <option value="false">미확인</option>
          </select>
        </label>
      </div>
      <label>
        <span>바우센트 유치원생</span>
        <select name="kindergarten_class">
          <option value="">해당 없음</option>
          <option value="매일반">매일반</option>
        </select>
      </label>
    `;
    return card;
  }

  function syncDogCards() {
    const cards = Array.from(dogList.querySelectorAll('[data-dog-card]'));
    cards.forEach((card, index) => {
      card.querySelector('.dog-card-head strong').textContent = `${index + 1}번째 강아지`;
      const remove = card.querySelector('.dog-remove');
      remove.hidden = cards.length === 1;
    });
    addDogButton.disabled = cards.length >= maxDogs;
  }

  function addDogCard() {
    const count = dogList.querySelectorAll('[data-dog-card]').length;
    if (count >= maxDogs) return;
    const card = dogCardTemplate(count + 1);
    dogList.appendChild(card);
    enhanceSelects();
    syncDogCards();
    refreshSummary();
    card.querySelector('input[name="dog_name"]')?.focus();
  }

  dogList.addEventListener('click', (event) => {
    const remove = event.target.closest('.dog-remove');
    if (!remove) return;
    const card = remove.closest('[data-dog-card]');
    if (card && dogList.querySelectorAll('[data-dog-card]').length > 1) {
      card.remove();
      syncDogCards();
      refreshSummary();
    }
  });
  addDogButton.addEventListener('click', addDogCard);

  function refreshSummary() {
    const value = readForm();
    const nights = nightsBetween(value.checkin, value.checkout);
    const pricedDogs = value.dogs.filter((dog) => dog.weight_kg);
    if (!pricedDogs.length || !value.checkin || !value.checkout) {
      summary.textContent = '날짜와 강아지별 체중을 선택하면 예상 금액이 표시됩니다.';
      return;
    }
    if (nights <= 0) {
      summary.textContent = '체크아웃 날짜는 체크인 날짜보다 뒤로 선택해주세요.';
      return;
    }
    const amount = pricedDogs.reduce((sum, dog) => sum + (rates[dog.weight_kg] || 0) * nights, 0);
    const hasKindergarten = pricedDogs.some((dog) => dog.kindergarten_class === '매일반');
    const dogLabel = `${pricedDogs.length}마리`;
    if (hasKindergarten) {
      summary.textContent = `${dogLabel} · ${nights}박 · 정상가 합계 ${formatWon(amount)} · 매장 확인 후 할인승인 시 유치원생 강아지별 할인이 적용됩니다.`;
      return;
    }
    summary.textContent = `${dogLabel} · ${nights}박 · 결제 예정 합계 ${formatWon(amount)}`;
  }

  function renderCalendar() {
    syncDateLimits();
    const checkin = parseDate(form.elements.checkin.value);
    const checkout = parseDate(form.elements.checkout.value);
    const monthStart = firstDayOfMonth(calendarMonth);
    const firstCell = addDays(monthStart, -monthStart.getUTCDay());
    const minDate = parseDate(todayKey());

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
      if (minDate && date < minDate) {
        button.classList.add('is-disabled');
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      }
      if (checkin && dateKey === formatDate(checkin)) button.classList.add('is-start', 'is-in-range');
      if (checkout && dateKey === formatDate(checkout)) button.classList.add('is-end', 'is-in-range');
      if (checkin && checkout && date > checkin && date < checkout) button.classList.add('is-in-range');

      button.addEventListener('click', () => selectRangeDate(date));
      calendarDays.appendChild(button);
    }
  }

  function selectRangeDate(date) {
    const minDate = parseDate(todayKey());
    if (minDate && date < minDate) {
      setMessage('오늘 이전 날짜는 예약할 수 없습니다.', 'error');
      return;
    }
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
    syncDateLimits();
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
    const invalidDog = value.dogs.find((dog) => !dog.dog_name || !dog.breed || !dog.weight_kg || dog.neutered === null || dog.vaccination_confirmed === null);
    if (!value.branch || !value.checkin || !value.checkout || invalidDog || nights <= 0) {
      setMessage('지점, 강아지 정보, 일정, 필수 확인 항목을 모두 입력해주세요.', 'error');
      return;
    }
    if (value.checkin < todayKey()) {
      setMessage('오늘 이전 날짜는 예약할 수 없습니다.', 'error');
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
      const count = Number(body.reservation_count || value.dogs.length || 1);
      setMessage(`${count}마리 예약 요청이 접수되었습니다. 매장 확인 후 확정 문자를 보내드립니다.`, 'success');
      form.reset();
      while (dogList.querySelectorAll('[data-dog-card]').length > 1) {
        dogList.querySelector('[data-dog-card]:last-child').remove();
      }
      syncDogCards();
      refreshSummary();
    } catch (error) {
      setMessage(error.message || '예약 요청 중 문제가 생겼습니다.', 'error');
    } finally {
      submit.disabled = false;
    }
  });
  enhanceSelects();
  syncDogCards();
  applyBranchFromQuery();
  renderCalendar();
  refreshSummary();
})();
