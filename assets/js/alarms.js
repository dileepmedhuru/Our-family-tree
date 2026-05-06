/**
 * alarms.js
 * Birthday alarm checking, banner display, and alarm list rendering.
 */

const ALARM_CHECK_INTERVAL_MS = 60 * 1000; /* check every minute */

/* ─── Date helpers ─────────────────────────────────────────────────── */

/**
 * Days until next birthday (0 = today, negative = invalid).
 * @param {string} dob  YYYY-MM-DD
 * @returns {number|null}
 */
function daysUntilBirthday(dob) {
  if (!dob) return null;
  const today = new Date();
  const b     = new Date(dob + 'T00:00:00');
  let next    = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  return Math.round((next - today) / 864e5);
}

/**
 * Format a YYYY-MM-DD string to "6 May 1945" style.
 * @param {string} dob
 * @returns {string}
 */
function formatDob(dob) {
  if (!dob) return '';
  const d = new Date(dob + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Return today's age for a given dob string.
 * @param {string} dob
 * @returns {number|null}
 */
function ageToday(dob) {
  if (!dob) return null;
  const today = new Date();
  const b     = new Date(dob + 'T00:00:00');
  let age     = today.getFullYear() - b.getFullYear();
  const m     = today.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < b.getDate())) age--;
  return age;
}

/* ─── Banner ───────────────────────────────────────────────────────── */

function checkBirthdayAlarms() {
  const members = getAllMembers();
  const banner  = document.getElementById('bdayBanner');

  const todayBdays  = members.filter(m => m.alarm && m.dob && daysUntilBirthday(m.dob) === 0);
  const soonBdays   = members.filter(m => m.alarm && m.dob && daysUntilBirthday(m.dob) > 0 && daysUntilBirthday(m.dob) <= 7);

  const parts = [];
  todayBdays.forEach(m => {
    const age = ageToday(m.dob);
    parts.push(`🎂 Today is <strong>${m.name}</strong>'s Birthday! Turning ${age} — Wishing many blessings!`);
  });
  soonBdays.forEach(m => {
    const d = daysUntilBirthday(m.dob);
    parts.push(`🔔 <strong>${m.name}</strong>'s birthday in ${d} day${d > 1 ? 's' : ''} (${formatDob(m.dob)})`);
  });

  if (parts.length) {
    banner.style.display = 'block';
    banner.innerHTML = parts.join('&nbsp;&nbsp;·&nbsp;&nbsp;');
  } else {
    banner.style.display = 'none';
  }
}

function startAlarmChecker() {
  checkBirthdayAlarms();
  setInterval(checkBirthdayAlarms, ALARM_CHECK_INTERVAL_MS);
}

/* ─── Alarm list modal ─────────────────────────────────────────────── */

function renderAlarmList() {
  const el      = document.getElementById('alarmListEl');
  const members = getAllMembers();
  el.innerHTML  = '';

  const alarmed = members
    .filter(m => m.alarm && m.dob)
    .sort((a, b) => daysUntilBirthday(a.dob) - daysUntilBirthday(b.dob));

  if (!alarmed.length) {
    el.innerHTML = '<p class="alarm-empty">No alarms set. Tap the bell icon on any member card to enable.</p>';
    return;
  }

  alarmed.forEach(m => {
    const d    = daysUntilBirthday(m.dob);
    const age  = ageToday(m.dob);
    const item = document.createElement('div');
    item.className = 'alarm-item';

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="a-name">${m.name}</div>
      <div class="a-dob">${formatDob(m.dob)} · Age ${age}</div>
    `;

    const right = document.createElement('div');
    right.className = 'a-days' + (d === 0 ? ' a-today' : '');
    right.textContent = d === 0 ? '🎂 Today!' : d === 1 ? 'Tomorrow' : `${d} days`;

    item.appendChild(left);
    item.appendChild(right);
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