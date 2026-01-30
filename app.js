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

// Stats storage
const STORAGE_KEY = 'fretboard-trainer-stats';

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
const noteButtonsContainer = document.getElementById('note-buttons');
const feedbackEl = document.getElementById('feedback');
const nextBtn = document.getElementById('next-btn');
const statsToggle = document.getElementById('stats-toggle');
const statsView = document.getElementById('stats-view');
const closeStats = document.getElementById('close-stats');
const resetStatsBtn = document.getElementById('reset-stats');

// Session stats elements
const sessionCorrectEl = document.getElementById('session-correct');
const sessionTotalEl = document.getElementById('session-total');
const sessionPercentEl = document.getElementById('session-percent');

// Initialize fretboard display
function initFretboard() {
  // Create fret numbers
  const fretNumbers = document.getElementById('fret-numbers');
  for (let i = 0; i < FRET_COUNT; i++) {
    const span = document.createElement('span');
    span.textContent = i;
    fretNumbers.appendChild(span);
  }

  // Create strings
  const stringsContainer = document.getElementById('strings');
  for (let i = 0; i < 6; i++) {
    const string = document.createElement('div');
    string.className = 'string';
    stringsContainer.appendChild(string);
  }

  // Create frets
  const fretsContainer = document.getElementById('frets');
  for (let i = 0; i < FRET_COUNT; i++) {
    const fret = document.createElement('div');
    fret.className = 'fret';
    fretsContainer.appendChild(fret);
  }

  // Create fret markers
  const markersContainer = document.getElementById('fret-markers');
  for (let i = 0; i < FRET_COUNT; i++) {
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

// Create note buttons
function initNoteButtons() {
  NOTE_DISPLAY.forEach(note => {
    const btn = document.createElement('button');
    btn.className = 'note-btn';
    btn.textContent = note;
    btn.dataset.note = note;
    btn.addEventListener('click', () => handleGuess(note));
    noteButtonsContainer.appendChild(btn);
  });
}

// Position the dot on the fretboard
function positionDot(stringIndex, fret) {
  const fretboardRect = fretboard.getBoundingClientRect();
  const fretWidth = fretboardRect.width / FRET_COUNT;
  const stringHeight = (fretboardRect.height - 18) / 6; // Subtract fret number area

  // Position in the middle of the fret
  const x = (fret * fretWidth) + (fretWidth / 2);
  // Position on the string (accounting for fret number area at top)
  const y = 18 + (stringIndex * stringHeight) + (stringHeight / 2) + 3;

  noteDot.style.left = `${x}px`;
  noteDot.style.top = `${y}px`;
}

// Generate a new random position
function newPosition() {
  currentPosition = {
    string: Math.floor(Math.random() * 6),
    fret: Math.floor(Math.random() * FRET_COUNT)
  };
  correctNote = getNoteDisplayName(getNoteAtPosition(currentPosition.string, currentPosition.fret));
  hasAnswered = false;

  // Reset UI
  noteDot.classList.remove('correct', 'incorrect');
  feedbackEl.classList.add('hidden');
  feedbackEl.classList.remove('correct', 'incorrect');
  nextBtn.classList.add('hidden');

  // Enable all buttons and remove styling
  document.querySelectorAll('.note-btn').forEach(btn => {
    btn.disabled = false;
    btn.classList.remove('correct-answer', 'wrong-answer');
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

  // Highlight buttons
  document.querySelectorAll('.note-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.note === correctNote) {
      btn.classList.add('correct-answer');
    } else if (btn.dataset.note === note && !isCorrect) {
      btn.classList.add('wrong-answer');
    }
  });

  nextBtn.classList.remove('hidden');
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

    const row = document.createElement('div');
    row.className = 'stat-bar';
    row.innerHTML = `
      <span class="label">Fret ${i}</span>
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

// Handle window resize to reposition dot
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    positionDot(currentPosition.string, currentPosition.fret);
  }, 100);
});

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
  }
});

// Initialize
function init() {
  initFretboard();
  initNoteButtons();
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
