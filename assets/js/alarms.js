/**
 * alarms.js  —  Birthday alarm logic
 */

function daysUntilBirthday(dob) {
  if (!dob) return null;
  const today = new Date();
  const b = new Date(dob + 'T00:00:00');
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next - today) / 864e5);
}

function formatDob(dob) {
  if (!dob) return '';
  return new Date(dob + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ageToday(dob) {
  if (!dob) return null;
  const today = new Date(), b = new Date(dob + 'T00:00:00');
  let age = today.getFullYear() - b.getFullYear();
  const mo = today.getMonth() - b.getMonth();
  if (mo < 0 || (mo === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

function checkBirthdayAlarms() {
  const banner = document.getElementById('bdayBanner');
  if (!banner) return;
  const members  = getAllMembers();
  const todayB   = members.filter(m => m.alarm && m.dob && daysUntilBirthday(m.dob) === 0);
  const soonB    = members.filter(m => m.alarm && m.dob && daysUntilBirthday(m.dob) > 0 && daysUntilBirthday(m.dob) <= 7);
  const parts = [];
  todayB.forEach(m => parts.push(`🎂 Today is <strong>${m.name}</strong>'s Birthday! Turning ${ageToday(m.dob)}!`));
  soonB.forEach(m => {
    const d = daysUntilBirthday(m.dob);
    parts.push(`🔔 <strong>${m.name}</strong>'s birthday in ${d} day${d > 1 ? 's' : ''}`);
  });
  if (parts.length) { banner.style.display = 'block'; banner.innerHTML = parts.join(' &nbsp;·&nbsp; '); }
  else banner.style.display = 'none';
}

function startAlarmChecker() {
  checkBirthdayAlarms();
  setInterval(checkBirthdayAlarms, 60000);
}

function renderAlarmList() {
  const el = document.getElementById('alarmListEl');
  if (!el) return;
  el.innerHTML = '';
  const alarmed = getAllMembers()
    .filter(m => m.alarm && m.dob)
    .sort((a, b) => daysUntilBirthday(a.dob) - daysUntilBirthday(b.dob));
  if (!alarmed.length) {
    el.innerHTML = '<p class="alarm-empty">No alarms set. Tap the bell on any member card.</p>';
    return;
  }
  alarmed.forEach(m => {
    const d = daysUntilBirthday(m.dob);
    const item = document.createElement('div');
    item.className = 'alarm-item';
    item.innerHTML = `
      <div>
        <div class="a-name">${m.name}</div>
        <div class="a-dob">${formatDob(m.dob)} · Age ${ageToday(m.dob)}</div>
      </div>
      <div class="a-days ${d === 0 ? 'a-today' : ''}">${d === 0 ? '🎂 Today!' : d === 1 ? 'Tomorrow' : d + ' days'}</div>
    `;
    el.appendChild(item);
  });
}

function showAlarmsModal() {
  renderAlarmList();
  document.getElementById('alarmModal').classList.add('open');
}
function closeAlarmsModal() {
  document.getElementById('alarmModal').classList.remove('open');
}