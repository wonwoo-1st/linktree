(function () {
  const form = document.getElementById('reservation-form');
  const summary = document.getElementById('summary');
  const message = document.getElementById('message');
  const submit = document.getElementById('submit');
  const rates = { 4: 30000, 6: 35000, 8: 40000 };
  const apiBase = (document.querySelector('meta[name="reservation-api-base"]')?.content || '').replace(/\/$/, '');

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
      guardian_phone: cleanPhone(data.get('guardian_phone')),
      special_notes: String(data.get('special_notes') || '').trim(),
      company: String(data.get('company') || '')
    };
  }

  function applyBranchFromQuery() {
    const branch = new URLSearchParams(window.location.search).get('branch');
    if (branch === 'sasang' || branch === 'eomgung') {
      form.elements.branch.value = branch;
    }
  }

  function setMessage(text, type) {
    message.textContent = text;
    message.className = `message ${type || ''}`.trim();
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
    summary.textContent = `${nights}박 · 1박 ${formatWon(rate)} · 결제 예정 ${formatWon(rate * nights)}`;
  }

  form.addEventListener('input', refreshSummary);
  form.addEventListener('change', refreshSummary);
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
  applyBranchFromQuery();
  refreshSummary();
})();
