// Guitar fretboard note data
const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const NOTE_DISPLAY = [
  'A', 'A#/Bb', 'B', 'C', 'C#/Db', 'D', 'D#/Eb', 'E', 'F', 'F#/Gb', 'G', 'G#/Ab'
];

// Standard tuning: E A D G B E (low to high, but displayed high to low visually)
const STRING_NOTES = ['E', 'B', 'G', 'D', 'A', 'E']; // High E first (top of display)
const STRING_START_INDICES = [4, 11, 7, 2, 9, 4]; // Note indices for open strings

const FRET_COUNT = 13; // 0-12
const FRET_MARKERS = [3, 5, 7, 9, 12];

// State
let currentPosition = { string: 0, fret: 0 };
let correctNote = '';
let hasAnswered = false;
let sessionCorrect = 0;
let sessionTotal = 0;
let autoAdvanceTimeout = null;

// Stats storage
const STORAGE_KEY = 'fretboard-trainer-stats';
const SETTINGS_KEY = 'fretboard-trainer-settings';

// Settings state
let settings = {
  frets: [true, true, true, true, true, true, true, true, true, true, true, true, true], // 0-12
  strings: [true, true, true, true, true, true] // indices 0-5
};

function loadSettings() {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate and merge with defaults
      if (parsed.frets && Array.isArray(parsed.frets) && parsed.frets.length === 13) {
        settings.frets = parsed.frets;
      }
      if (parsed.strings && Array.isArray(parsed.strings) && parsed.strings.length === 6) {
        settings.strings = parsed.strings;
      }
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

function loadStats() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load stats:', e);
  }
  return createEmptyStats();
}

function createEmptyStats() {
  const noteStats = {};
  NOTE_DISPLAY.forEach(note => {
    noteStats[note] = { correct: 0, total: 0 };
  });

  const fretStats = {};
  for (let i = 0; i < FRET_COUNT; i++) {
    fretStats[i] = { correct: 0, total: 0 };
  }

  return {
    totalCorrect: 0,
    totalAttempts: 0,
    noteStats,
    fretStats
  };
}

function saveStats(stats) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error('Failed to save stats:', e);
  }
}

// Get note at a specific fret position
function getNoteAtPosition(stringIndex, fret) {
  const startIndex = STRING_START_INDICES[stringIndex];
  const noteIndex = (startIndex + fret) % 12;
  return NOTES[noteIndex];
}

function getNoteDisplayName(note) {
  const index = NOTES.indexOf(note);
  // Map from NOTES order to NOTE_DISPLAY order
  // NOTES: C, C#, D, D#, E, F, F#, G, G#, A, A#, B
  // NOTE_DISPLAY: A, A#/Bb, B, C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab
  const displayMap = {
    'C': 'C', 'C#': 'C#/Db', 'D': 'D', 'D#': 'D#/Eb',
    'E': 'E', 'F': 'F', 'F#': 'F#/Gb', 'G': 'G',
    'G#': 'G#/Ab', 'A': 'A', 'A#': 'A#/Bb', 'B': 'B'
  };
  return displayMap[note];
}

// DOM elements
const fretboard = document.getElementById('fretboard');
const noteDot = document.getElementById('note-dot');
const noteWheelContainer = document.getElementById('note-wheel-container');
const feedbackEl = document.getElementById('feedback');
const nextBtn = document.getElementById('next-btn');
const statsToggle = document.getElementById('stats-toggle');
const statsView = document.getElementById('stats-view');
const closeStats = document.getElementById('close-stats');
const resetStatsBtn = document.getElementById('reset-stats');
const settingsToggle = document.getElementById('settings-toggle');
const settingsView = document.getElementById('settings-view');
const closeSettings = document.getElementById('close-settings');
const resetSettingsBtn = document.getElementById('reset-settings');

// Session stats elements
const sessionCorrectEl = document.getElementById('session-correct');
const sessionTotalEl = document.getElementById('session-total');
const sessionPercentEl = document.getElementById('session-percent');

// Initialize fretboard display
function initFretboard() {
  // Create fret numbers: empty nut label + frets 1-12
  const fretNumbers = document.getElementById('fret-numbers');

  // Nut label (empty)
  const nutLabel = document.createElement('span');
  nutLabel.className = 'nut-label';
  fretNumbers.appendChild(nutLabel);

  // Fret numbers 1-12
  for (let i = 1; i < FRET_COUNT; i++) {
    const span = document.createElement('span');
    span.textContent = i;
    span.style.gridColumn = i + 1; // Column 2-13 (1 is nut)
    fretNumbers.appendChild(span);
  }

  // Create strings
  const stringsContainer = document.getElementById('strings');
  for (let i = 0; i < 6; i++) {
    const string = document.createElement('div');
    string.className = 'string';
    stringsContainer.appendChild(string);
  }

  // Create frets (12 frets, not including nut)
  const fretsContainer = document.getElementById('frets');
  for (let i = 1; i < FRET_COUNT; i++) {
    const fret = document.createElement('div');
    fret.className = 'fret';
    fretsContainer.appendChild(fret);
  }

  // Create fret markers (for frets 1-12)
  const markersContainer = document.getElementById('fret-markers');
  for (let i = 1; i < FRET_COUNT; i++) {
    const slot = document.createElement('div');
    slot.className = 'fret-marker-slot';

    if (FRET_MARKERS.includes(i)) {
      const marker = document.createElement('div');
      marker.className = i === 12 ? 'fret-marker double' : 'fret-marker';
      slot.appendChild(marker);
    }

    markersContainer.appendChild(slot);
  }
}

// Wheel constants
const WHEEL_RADIUS = 100;
const INNER_RADIUS = 35;
const LABEL_RADIUS = 67;

// Calculate SVG path for a pie segment
function getSegmentPath(index, innerRadius, outerRadius) {
  const segmentAngle = 360 / NOTE_DISPLAY.length;
  const startAngle = (index * segmentAngle - 90) * (Math.PI / 180);
  const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180);

  const x1 = Math.cos(startAngle) * outerRadius;
  const y1 = Math.sin(startAngle) * outerRadius;
  const x2 = Math.cos(endAngle) * outerRadius;
  const y2 = Math.sin(endAngle) * outerRadius;
  const x3 = Math.cos(endAngle) * innerRadius;
  const y3 = Math.sin(endAngle) * innerRadius;
  const x4 = Math.cos(startAngle) * innerRadius;
  const y4 = Math.sin(startAngle) * innerRadius;

  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${outerRadius} ${outerRadius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} L ${x3.toFixed(2)} ${y3.toFixed(2)} A ${innerRadius} ${innerRadius} 0 0 0 ${x4.toFixed(2)} ${y4.toFixed(2)} Z`;
}

// Calculate label position at center of segment
function getLabelPosition(index, radius) {
  const segmentAngle = 360 / NOTE_DISPLAY.length;
  const angle = (index * segmentAngle + segmentAngle / 2 - 90) * (Math.PI / 180);
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius
  };
}

// Create circular note wheel
function initNoteWheel() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('id', 'note-wheel');
  svg.setAttribute('viewBox', '-120 -120 240 240');
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', 'Note selection wheel');

  NOTE_DISPLAY.forEach((note, index) => {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.classList.add('wheel-segment');
    group.setAttribute('data-note', note);
    group.setAttribute('role', 'button');
    group.setAttribute('tabindex', '0');
    group.setAttribute('aria-label', note);

    // Create segment path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.classList.add('segment-path');
    path.setAttribute('d', getSegmentPath(index, INNER_RADIUS, WHEEL_RADIUS));
    group.appendChild(path);

    // Create label
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.classList.add('segment-label');
    const labelPos = getLabelPosition(index, LABEL_RADIUS);
    label.setAttribute('x', labelPos.x.toFixed(2));
    label.setAttribute('y', labelPos.y.toFixed(2));
    label.textContent = note;
    group.appendChild(label);

    // Event listeners
    group.addEventListener('click', () => handleGuess(note));
    group.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleGuess(note);
      }
    });

    svg.appendChild(group);
  });

  noteWheelContainer.appendChild(svg);
}

// Position the dot on the fretboard using CSS grid
function positionDot(stringIndex, fret) {
  // Grid columns: 1 = nut, 2-13 = frets 1-12
  // Grid rows: 1 = fret numbers, 2-7 = strings
  noteDot.style.gridColumn = fret + 1; // fret 0 -> column 1 (nut), fret 1 -> column 2, etc.
  noteDot.style.gridRow = stringIndex + 2; // string 0 -> row 2, string 1 -> row 3, etc.
}

// Generate a new random position
function newPosition() {
  // Cancel any pending auto-advance
  if (autoAdvanceTimeout) {
    clearTimeout(autoAdvanceTimeout);
    autoAdvanceTimeout = null;
  }

  // Get valid frets and strings from settings
  const validFrets = settings.frets
    .map((enabled, i) => enabled ? i : -1)
    .filter(i => i >= 0);
  const validStrings = settings.strings
    .map((enabled, i) => enabled ? i : -1)
    .filter(i => i >= 0);

  currentPosition = {
    string: validStrings[Math.floor(Math.random() * validStrings.length)],
    fret: validFrets[Math.floor(Math.random() * validFrets.length)]
  };
  correctNote = getNoteDisplayName(getNoteAtPosition(currentPosition.string, currentPosition.fret));
  hasAnswered = false;

  // Reset UI
  noteDot.classList.remove('correct', 'incorrect');
  feedbackEl.classList.add('hidden');
  feedbackEl.classList.remove('correct', 'incorrect');
  nextBtn.classList.add('hidden');

  // Enable all wheel segments and remove styling
  document.querySelectorAll('.wheel-segment').forEach(segment => {
    segment.classList.remove('disabled', 'correct-answer', 'wrong-answer');
    segment.setAttribute('tabindex', '0');
  });

  positionDot(currentPosition.string, currentPosition.fret);
}

// Handle user's guess
function handleGuess(note) {
  if (hasAnswered) return;
  hasAnswered = true;

  const isCorrect = note === correctNote;
  const stats = loadStats();

  // Update stats
  stats.totalAttempts++;
  if (isCorrect) {
    stats.totalCorrect++;
    sessionCorrect++;
  }
  sessionTotal++;

  // Update note stats
  if (!stats.noteStats[correctNote]) {
    stats.noteStats[correctNote] = { correct: 0, total: 0 };
  }
  stats.noteStats[correctNote].total++;
  if (isCorrect) {
    stats.noteStats[correctNote].correct++;
  }

  // Update fret stats
  if (!stats.fretStats[currentPosition.fret]) {
    stats.fretStats[currentPosition.fret] = { correct: 0, total: 0 };
  }
  stats.fretStats[currentPosition.fret].total++;
  if (isCorrect) {
    stats.fretStats[currentPosition.fret].correct++;
  }

  saveStats(stats);
  updateSessionDisplay();

  // Visual feedback
  noteDot.classList.add(isCorrect ? 'correct' : 'incorrect');
  feedbackEl.textContent = isCorrect ? 'Correct!' : `Wrong! It was ${correctNote}`;
  feedbackEl.classList.remove('hidden');
  feedbackEl.classList.add(isCorrect ? 'correct' : 'incorrect');

  // Highlight wheel segments
  document.querySelectorAll('.wheel-segment').forEach(segment => {
    segment.classList.add('disabled');
    segment.setAttribute('tabindex', '-1');
    if (segment.dataset.note === correctNote) {
      segment.classList.add('correct-answer');
    } else if (segment.dataset.note === note && !isCorrect) {
      segment.classList.add('wrong-answer');
    }
  });

  if (isCorrect) {
    // Auto-advance after 800ms on correct answer
    autoAdvanceTimeout = setTimeout(newPosition, 800);
  } else {
    // Show Next button for incorrect answers so user can study
    nextBtn.classList.remove('hidden');
  }
}

// Update session display
function updateSessionDisplay() {
  sessionCorrectEl.textContent = sessionCorrect;
  sessionTotalEl.textContent = sessionTotal;
  const percent = sessionTotal > 0 ? Math.round((sessionCorrect / sessionTotal) * 100) : 0;
  sessionPercentEl.textContent = `(${percent}%)`;
}

// Render stats view
function renderStats() {
  const stats = loadStats();

  // Overall stats
  document.getElementById('total-attempts').textContent = stats.totalAttempts;
  const overallPercent = stats.totalAttempts > 0
    ? Math.round((stats.totalCorrect / stats.totalAttempts) * 100)
    : 0;
  document.getElementById('overall-accuracy').textContent = `${overallPercent}%`;

  // Note stats
  const noteStatsContainer = document.getElementById('note-stats');
  noteStatsContainer.innerHTML = '';

  NOTE_DISPLAY.forEach(note => {
    const data = stats.noteStats[note] || { correct: 0, total: 0 };
    const percent = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    const barClass = percent >= 80 ? 'good' : percent >= 50 ? 'medium' : 'poor';

    const row = document.createElement('div');
    row.className = 'stat-bar';
    row.innerHTML = `
      <span class="label">${note}</span>
      <div class="bar-container">
        <div class="bar ${data.total > 0 ? barClass : ''}" style="width: ${percent}%"></div>
      </div>
      <span class="value">${data.total > 0 ? `${percent}%` : '-'}</span>
    `;
    noteStatsContainer.appendChild(row);
  });

  // Fret stats
  const fretStatsContainer = document.getElementById('fret-stats');
  fretStatsContainer.innerHTML = '';

  for (let i = 0; i < FRET_COUNT; i++) {
    const data = stats.fretStats[i] || { correct: 0, total: 0 };
    const percent = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    const barClass = percent >= 80 ? 'good' : percent >= 50 ? 'medium' : 'poor';
    const fretLabel = i === 0 ? 'Open' : `Fret ${i}`;

    const row = document.createElement('div');
    row.className = 'stat-bar';
    row.innerHTML = `
      <span class="label">${fretLabel}</span>
      <div class="bar-container">
        <div class="bar ${data.total > 0 ? barClass : ''}" style="width: ${percent}%"></div>
      </div>
      <span class="value">${data.total > 0 ? `${percent}%` : '-'}</span>
    `;
    fretStatsContainer.appendChild(row);
  }
}

// Event listeners
nextBtn.addEventListener('click', newPosition);

statsToggle.addEventListener('click', () => {
  renderStats();
  statsView.classList.remove('hidden');
});

closeStats.addEventListener('click', () => {
  statsView.classList.add('hidden');
});

resetStatsBtn.addEventListener('click', () => {
  if (confirm('Reset all progress data?')) {
    localStorage.removeItem(STORAGE_KEY);
    sessionCorrect = 0;
    sessionTotal = 0;
    updateSessionDisplay();
    renderStats();
  }
});

// Settings event listeners
settingsToggle.addEventListener('click', () => {
  updateSettingsUI();
  settingsView.classList.remove('hidden');
});

closeSettings.addEventListener('click', () => {
  settingsView.classList.add('hidden');
});

// Update settings UI to reflect current state
function updateSettingsUI() {
  document.querySelectorAll('#fret-toggles .toggle-btn').forEach(btn => {
    const fret = parseInt(btn.dataset.fret);
    btn.classList.toggle('active', settings.frets[fret]);
  });
  document.querySelectorAll('#string-toggles .toggle-btn').forEach(btn => {
    const string = parseInt(btn.dataset.string);
    btn.classList.toggle('active', settings.strings[string]);
  });
}

// Fret toggle buttons
document.getElementById('fret-toggles').addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;

  const fret = parseInt(btn.dataset.fret);
  const newValue = !settings.frets[fret];

  // Prevent deselecting all frets
  const activeCount = settings.frets.filter(Boolean).length;
  if (!newValue && activeCount <= 1) return;

  settings.frets[fret] = newValue;
  btn.classList.toggle('active', newValue);
  saveSettings();
});

// String toggle buttons
document.getElementById('string-toggles').addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-btn');
  if (!btn) return;

  const string = parseInt(btn.dataset.string);
  const newValue = !settings.strings[string];

  // Prevent deselecting all strings
  const activeCount = settings.strings.filter(Boolean).length;
  if (!newValue && activeCount <= 1) return;

  settings.strings[string] = newValue;
  btn.classList.toggle('active', newValue);
  saveSettings();
});

// Frets All/None buttons
document.getElementById('frets-all').addEventListener('click', () => {
  settings.frets = settings.frets.map(() => true);
  saveSettings();
  updateSettingsUI();
});

document.getElementById('frets-none').addEventListener('click', () => {
  // Keep first fret selected
  settings.frets = settings.frets.map((_, i) => i === 0);
  saveSettings();
  updateSettingsUI();
});

// Strings All/None buttons
document.getElementById('strings-all').addEventListener('click', () => {
  settings.strings = settings.strings.map(() => true);
  saveSettings();
  updateSettingsUI();
});

document.getElementById('strings-none').addEventListener('click', () => {
  // Keep first string selected
  settings.strings = settings.strings.map((_, i) => i === 0);
  saveSettings();
  updateSettingsUI();
});

// Reset settings to defaults
resetSettingsBtn.addEventListener('click', () => {
  if (confirm('Reset settings to defaults?')) {
    settings.frets = [true, true, true, true, true, true, true, true, true, true, true, true, true];
    settings.strings = [true, true, true, true, true, true];
    saveSettings();
    updateSettingsUI();
  }
});

// No resize handler needed - CSS grid handles dot positioning automatically

// Keyboard support
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    if (!nextBtn.classList.contains('hidden')) {
      e.preventDefault();
      newPosition();
    }
  }
  if (e.key === 'Escape') {
    statsView.classList.add('hidden');
    settingsView.classList.add('hidden');
  }
});

// Initialize
function init() {
  loadSettings();
  initFretboard();
  initNoteWheel();
  updateSessionDisplay();
  newPosition();
}

// Wait for DOM and fonts to load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Register service worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed:', err));
  });
}
