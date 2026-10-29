/* ════════════════════════════════════════════════
   💧  Water Reminder Web App — Main Logic
   ════════════════════════════════════════════════ */

/* ── Constants ──────────────────────────────────── */
const INTERVAL_MS  = 60 * 60 * 1000; // 1 hour
const SNOOZE_MS    = 10 * 60 * 1000; // 10 min
const DAILY_GOAL   = 8;              // glasses per day

/* ── State (persisted in localStorage) ─────────── */
let state = loadState();

function defaultState() {
  return {
    name:        '',
    glassesToday: 0,
    lastDrank:   null,
    streak:      0,
    lastDate:    null,
    nextReminder: Date.now() + INTERVAL_MS,
    notifEnabled: false,
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('hydrate-state') || 'null');
    if (!s) return defaultState();
    // Reset daily count if it's a new day
    const today = new Date().toDateString();
    if (s.lastDate !== today) {
      // Check streak
      const yesterday = new Date(Date.now() - 86400000).toDateString();
      s.streak = s.lastDate === yesterday ? (s.streak || 0) + 1 : 0;
      s.glassesToday = 0;
      s.lastDate = today;
    }
    return s;
  } catch { return defaultState(); }
}

function saveState() {
  state.lastDate = new Date().toDateString();
  localStorage.setItem('hydrate-state', JSON.stringify(state));
}

/* ── DOM References ─────────────────────────────── */
const $ = id => document.getElementById(id);
const charEl       = $('character');
const reminderOverlay = $('reminder-overlay');
const reminderChar = $('reminder-char');
const reminderMsg  = $('reminder-msg');
const reminderSub  = $('reminder-sub');
const countdownEl  = $('countdown');
const glassesFilled = $('glasses-filled');
const progressBar  = $('progress-bar');
const statGlasses  = $('stat-glasses');
const statStreak   = $('stat-streak');
const statGoal     = $('stat-goal');
const bubbleEl     = $('bubble');
const notifBanner  = $('notif-banner');
const toastEl      = $('toast');
const confettiWrap = $('confetti-wrap');

/* ── Animation frames ───────────────────────────── */
const FRAMES = ['f2', 'f3', 'f4', 'f5'];
let cancelSip = false;

function showFrame(id, parent = charEl) {
  parent.querySelectorAll('.pet-frame').forEach(el => {
    el.classList.toggle('active', el.id === id || el.dataset.frame === id);
  });
}

function showReminderFrame(id) {
  reminderChar.querySelectorAll('.pet-frame').forEach(el => {
    el.classList.toggle('active', el.dataset.frame === id);
  });
}

/* ── Main character state ───────────────────────── */
let charState = 'idle';
let idleTimer  = null;
let walkTimer  = null;
let walkToggle = 0;

function setCharState(s) {
  charState = s;
  charEl.className = s;
}

function startIdle() {
  setCharState('idle');
  showFrame('f5');
  bubbleEl.textContent = state.name
    ? `Hey ${state.name}! 💧 Stay hydrated!`
    : `Hey! 💧 Remember to drink water!`;
  bubbleEl.classList.remove('hidden');
}

/* ── PROMPTS ────────────────────────────────────── */
const PROMPTS = [
  n => `${n ? n + ', h' : 'H'}ey! Time to drink some water 💧`,
  n => `${n ? n + ', y' : 'Y'}our body needs water! Stay hydrated 🌊`,
  n => `${n ? n + '! ' : ''}Water break! Your brain will thank you 🧠✨`,
  n => `${n ? 'Psst, ' + n + '… ' : ''}Have you had a glass of water lately? 💙`,
  n => `${n ? n + ', d' : 'D'}on't forget to hydrate! You're doing great 🌟`,
  n => `${n ? n + ', ' : ''}It's water o'clock! 🕐💧`,
  n => `${n ? 'Hey ' + n + '! ' : ''}A sip of water keeps you fresh! 🩺`,
  n => `${n ? n + ', t' : 'T'}ake a water break — you deserve it! 🥰`,
];

const CHEERS = [
  'Yay! Great job staying hydrated! 🎉',
  'Your body loves you for this! 💙',
  'Hydration champion! 👑✨',
  'Water power activated! 💪💧',
  "That's the spirit! Keep it up! 🌟",
  'Splashhh! You\'re amazing! 🌊✨',
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

/* ── Reminder overlay ───────────────────────────── */
function showReminder() {
  const msg = pick(PROMPTS)(state.name || '');
  reminderMsg.textContent = msg;
  reminderSub.textContent = `${state.glassesToday}/${DAILY_GOAL} glasses today`;
  reminderOverlay.classList.add('show');
  // Animate character
  showReminderFrame('f5');
  startReminderCharAnim();
}

let reminderAnimTimer = null;
function startReminderCharAnim() {
  let t = 0;
  reminderAnimTimer = setInterval(() => {
    showReminderFrame(t % 2 === 0 ? 'f5' : 'f2');
    t++;
  }, 500);
}

function hideReminderOverlay() {
  clearInterval(reminderAnimTimer);
  reminderOverlay.classList.remove('show');
}

/* ── Drinking flow ──────────────────────────────── */
async function handleDrank() {
  hideReminderOverlay();

  // Record glass
  state.glassesToday = Math.min(state.glassesToday + 1, DAILY_GOAL);
  state.lastDrank = Date.now();
  state.nextReminder = Date.now() + INTERVAL_MS;
  saveState();
  updateUI();

  // Schedule next
  scheduleReminder(INTERVAL_MS);

  // Celebrate animation on main char
  cancelSip = false;
  setCharState('sipping');
  bubbleEl.textContent = pick(CHEERS);

  showFrame('f2');
  await wait(500); if (cancelSip) return;
  showFrame('f3');
  await wait(550); if (cancelSip) return;
  showFrame('f4');
  await wait(900); if (cancelSip) return;

  setCharState('celebrate');
  showFrame('f5');
  launchConfetti();
  showToast('💧 Great job! +1 glass recorded!');

  await wait(2000);
  setCharState('idle');
  showFrame('f5');
}

function handleSnooze() {
  hideReminderOverlay();
  state.nextReminder = Date.now() + SNOOZE_MS;
  saveState();
  scheduleReminder(SNOOZE_MS);
  showToast('😴 Reminder snoozed for 10 minutes');
}

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

/* ── Reminder timer ─────────────────────────────── */
let reminderTimeout = null;

function scheduleReminder(delayMs) {
  clearTimeout(reminderTimeout);
  reminderTimeout = setTimeout(() => {
    showReminder();
  }, delayMs);

  // Also ask service worker to schedule (works when app minimized)
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: 'SCHEDULE_REMINDER',
      delay: delayMs,
      message: pick(PROMPTS)(state.name || ''),
    });
  }
}

function startReminderLoop() {
  const remaining = state.nextReminder - Date.now();
  scheduleReminder(remaining > 0 ? remaining : INTERVAL_MS);
}

/* ── Countdown timer ─────────────────────────────── */
function updateCountdown() {
  const remaining = Math.max(0, state.nextReminder - Date.now());
  const m = Math.floor(remaining / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  countdownEl.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

setInterval(updateCountdown, 1000);

/* ── Update UI ──────────────────────────────────── */
function updateUI() {
  const g = state.glassesToday;
  const pct = Math.min(100, (g / DAILY_GOAL) * 100);

  statGlasses.textContent = g;
  statStreak.textContent  = state.streak || 0;
  statGoal.textContent    = `${Math.round(pct)}%`;
  progressBar.style.width = pct + '%';

  // Glasses row
  glassesFilled.innerHTML = '';
  for (let i = 0; i < DAILY_GOAL; i++) {
    const d = document.createElement('div');
    d.className = 'glass-dot' + (i < g ? ' filled' : '');
    d.textContent = i < g ? '💧' : '○';
    glassesFilled.appendChild(d);
  }

  // Name in settings
  const nameInput = $('input-name');
  if (nameInput && !nameInput.dataset.focused) nameInput.value = state.name || '';

  updateCountdown();
}

/* ── Notifications ──────────────────────────────── */
async function requestNotifications() {
  if (!('Notification' in window)) {
    showToast('Notifications not supported on this browser');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    state.notifEnabled = true;
    saveState();
    notifBanner.classList.add('hidden');
    showToast('✅ Notifications enabled!');
  } else {
    showToast('❌ Notifications blocked. Enable in browser settings.');
  }
}

function checkNotifPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    state.notifEnabled = true;
    notifBanner.classList.add('hidden');
  } else if (Notification.permission !== 'denied') {
    notifBanner.classList.remove('hidden');
  }
}

/* ── Service Worker ─────────────────────────────── */
async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    await navigator.serviceWorker.register('/sw.js');
    console.log('SW registered');
  } catch (e) {
    console.log('SW failed:', e);
  }
  // Listen for messages from SW (notification action clicks)
  navigator.serviceWorker.addEventListener('message', e => {
    if (e.data.action === 'drank') handleDrank();
    if (e.data.action === 'snooze') handleSnooze();
  });
}

/* ── Confetti ───────────────────────────────────── */
function launchConfetti() {
  const colors = ['#38bdf8', '#818cf8', '#f472b6', '#4ade80', '#fbbf24', '#f87171'];
  const shapes = ['■', '●', '▲', '★', '♦', '❤'];
  for (let i = 0; i < 50; i++) {
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.textContent = pick(shapes);
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      color: ${pick(colors)};
      font-size: ${8 + Math.random() * 12}px;
      animation-duration: ${1.5 + Math.random() * 2}s;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    confettiWrap.appendChild(p);
    setTimeout(() => p.remove(), 3000);
  }
}

/* ── Toast ──────────────────────────────────────── */
let toastTimer = null;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

/* ── Settings ───────────────────────────────────── */
function openSettings() {
  $('settings').classList.add('open');
  const nameInput = $('input-name');
  if (nameInput) nameInput.value = state.name || '';
}

function closeSettings() {
  // Save name
  const name = ($('input-name')?.value || '').trim();
  if (name !== state.name) {
    state.name = name;
    saveState();
    startIdle();
  }
  $('settings').classList.remove('open');
}

/* ── Init ───────────────────────────────────────── */
async function init() {
  await registerSW();
  checkNotifPermission();
  startIdle();
  updateUI();
  startReminderLoop();

  // If name not set, open settings right away
  if (!state.name) {
    setTimeout(openSettings, 600);
  }
}

/* ── Event listeners ─────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  init();

  $('btn-drank').addEventListener('click', handleDrank);
  $('btn-snooze').addEventListener('click', handleSnooze);
  $('reminder-drank').addEventListener('click', handleDrank);
  $('reminder-snooze').addEventListener('click', handleSnooze);
  $('menu-btn').addEventListener('click', openSettings);
  $('close-settings').addEventListener('click', closeSettings);
  $('btn-allow-notif').addEventListener('click', requestNotifications);

  // Close settings on backdrop click
  $('settings').addEventListener('click', e => {
    if (e.target === $('settings')) closeSettings();
  });

  // Name input — track focus
  const nameInput = $('input-name');
  if (nameInput) {
    nameInput.addEventListener('focus', () => { nameInput.dataset.focused = '1'; });
    nameInput.addEventListener('blur', () => { delete nameInput.dataset.focused; });
  }
});
