// --- Application Initialization & Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').catch(err => console.log("SW registration failed", err));
    });
}

// --- Configuration Constants ---
const presets = [
    { id: 'starting', label: 'Just Starting Out', run: 60, walk: 120 },
    { id: 'equal', label: 'Equal Intervals', run: 60, walk: 60 },
    { id: 'building', label: 'Building Up', run: 120, walk: 60 },
    { id: 'stronger', label: 'Getting Stronger', run: 180, walk: 60 },
    { id: 'race', label: 'Race Ready', run: 240, walk: 60 },
    { id: 'speed', label: 'Speed Intervals', run: 30, walk: 30 },
    { id: 'advanced', label: 'Advanced Core', run: 300, walk: 60 }
];

// --- Application State Context ---
let activeIntervalConfig = { run: 60, walk: 60 };
let isWorkoutRunning = false;
let isWorkoutPaused = false;
let currentPhaseType = 'run'; 
let phaseTimeRemaining = 0;
let totalTimeElapsed = 0;
let targetBpm = 165;

// --- Web Audio Hardware Connectors & Scheduler State ---
let audioCtx = null;
let backgroundKeepAliveOsc = null;
let backgroundKeepAliveGain = null;
let schedulerIntervalTimer = null;

const SCHEDULER_LOOKAHEAD = 0.4; // How far ahead to schedule audio events (seconds)
const SCHEDULER_TICK_RATE = 100; // How often to run the scheduling loop (milliseconds)
let nextMetronomeBeatTime = 0.0;
let nextLogicalSecondTime = 0.0;

// --- Document UI Object Mapping ---
const presetContainer = document.getElementById('presetContainer');
const setupSection = document.getElementById('setupSection');
const activeTimerSection = document.getElementById('activeTimerSection');
const phaseDisplay = document.getElementById('currentPhase');
const timeDisplay = document.getElementById('timeRemaining');
const totalTimeDisplay = document.getElementById('totalTimeElapsed');
const activeBpmDisplay = document.getElementById('activeBpmDisplay');

// --- Process Presets Grid Interface ---
presets.forEach((preset, index) => {
    const btn = document.createElement('button');
    btn.className = 'preset-card bg-gray-800 hover:bg-gray-700 text-left p-3 rounded-xl border border-gray-700 transition-all active:scale-95';
    btn.innerHTML = `
        <div class="font-bold text-sm text-gray-200 tracking-tight">${preset.label}</div>
        <div class="text-xs font-mono text-gray-400 mt-0.5">${formatTime(preset.run)} Run / ${formatTime(preset.walk)} Walk</div>
    `;
    btn.onclick = () => {
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('border-blue-500'));
        btn.classList.add('border-blue-500');
        activeIntervalConfig = { run: preset.run, walk: preset.walk };
        
        // Sync custom entry fields with preset selection for clarity
        document.getElementById('manualRunMin').value = Math.floor(preset.run / 60);
        document.getElementById('manualRunSec').value = preset.run % 60;
        document.getElementById('manualWalkMin').value = Math.floor(preset.walk / 60);
        document.getElementById('manualWalkSec').value = preset.walk % 60;
    };
    presetContainer.appendChild(btn);
    if(index === 1) btn.click(); // Select Equal Intervals by default
});

function formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// --- Audio Generation Core (Screen-Locked Background System) ---
function spinUpAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // Low frequency sub-audible pipeline keeps mobile OS thread from sleeping
    if (!backgroundKeepAliveOsc) {
        backgroundKeepAliveOsc = audioCtx.createOscillator();
        backgroundKeepAliveGain = audioCtx.createGain();
        backgroundKeepAliveOsc.frequency.setValueAtTime(25, audioCtx.currentTime); 
        backgroundKeepAliveGain.gain.setValueAtTime(0.001, audioCtx.currentTime); 
        backgroundKeepAliveOsc.connect(backgroundKeepAliveGain);
        backgroundKeepAliveGain.connect(audioCtx.destination);
        backgroundKeepAliveOsc.start();
    }
}

function tearDownAudioContext() {
    if (backgroundKeepAliveOsc) {
        try { backgroundKeepAliveOsc.stop(); } catch(e){}
        backgroundKeepAliveOsc.disconnect();
        backgroundKeepAliveOsc = null;
    }
    if (backgroundKeepAliveGain) {
        backgroundKeepAliveGain.disconnect();
        backgroundKeepAliveGain = null;
    }
}

// Schedules a wooden block sound for the metronome cadence track
function scheduleMetronomeTick(time) {
    // Only tick the metronome during the 'run' phase
    if (currentPhaseType !== 'run') return;

    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, time); // Crisp percussive pop
    
    gainNode.gain.setValueAtTime(0.2, time);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    
    osc.start(time);
    osc.stop(time + 0.05);
}

// Schedules high-contrast interval shift chimes
function schedulePhaseChime(type, time) {
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    if (type === 'run') {
        // High double-beep alerting you to pick up the pace
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, time);
        osc.frequency.setValueAtTime(1200, time + 0.12);
        gainNode.gain.setValueAtTime(0.7, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
        osc.start(time);
        osc.stop(time + 0.45);
    } else {
        // Flat, authoritative structural alert tone signaling your recovery period
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(330, time);
        gainNode.gain.setValueAtTime(0.5, time);
        gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
        osc.start(time);
        osc.stop(time + 0.65);
    }
}

// --- Unified Time Window Scheduler Loop ---
function runAudioScheduler() {
    if (!isWorkoutRunning || isWorkoutPaused) return;

    const currentTime = audioCtx.currentTime;

    // Timeline Segment A: Schedule Metronome Cadence Beats
    const secondsPerBeat = 60.0 / targetBpm;
    while (nextMetronomeBeatTime < currentTime + SCHEDULER_LOOKAHEAD) {
        scheduleMetronomeTick(nextMetronomeBeatTime);
        nextMetronomeBeatTime += secondsPerBeat;
    }

    // Timeline Segment B: Schedule Logical Time Progression & Transition Alerts
    while (nextLogicalSecondTime < currentTime + SCHEDULER_LOOKAHEAD) {
        executeLogicalClockTick(nextLogicalSecondTime);
        nextLogicalSecondTime += 1.0;
    }
}

function executeLogicalClockTick(scheduledTime) {
    // Process counters
    phaseTimeRemaining--;
    totalTimeElapsed++;

    // Look ahead to check boundary swaps
    if (phaseTimeRemaining <= 0) {
        currentPhaseType = currentPhaseType === 'run' ? 'walk' : 'run';
        phaseTimeRemaining = activeIntervalConfig[currentPhaseType];
        schedulePhaseChime(currentPhaseType, scheduledTime);
    }

    // Push state metrics safely back to UI indicators
    // (Happens slightly ahead of time inside the look-ahead window, unnoticeable to runner)
    updateUIStateDisplays();
    synchronizeLockScreenMedia();
}

// --- UI Engine Displays ---
function updateUIStateDisplays() {
    timeDisplay.textContent = formatTime(phaseTimeRemaining);
    totalTimeDisplay.textContent = `Total Execution: ${formatTime(totalTimeElapsed)}`;
    
    if (currentPhaseType === 'run') {
        phaseDisplay.textContent = 'RUN';
        phaseDisplay.className = 'text-6xl font-extrabold uppercase tracking-widest text-green-400';
        activeBpmDisplay.textContent = `Metronome Active: ${targetBpm} BPM`;
    } else {
        phaseDisplay.textContent = 'WALK';
        phaseDisplay.className = 'text-6xl font-extrabold uppercase tracking-widest text-blue-400';
        activeBpmDisplay.textContent = 'Metronome Paused (Walk Recovery)';
    }
}

function synchronizeLockScreenMedia() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: `Phase: ${currentPhaseType.toUpperCase()} (${formatTime(phaseTimeRemaining)})`,
            artist: `Cadence Tracker (${targetBpm} BPM)`,
            album: `Interval Pattern: ${formatTime(activeIntervalConfig.run)} / ${formatTime(activeIntervalConfig.walk)}`,
            artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/5219/5219258.png', sizes: '512x512', type: 'image/png' }]
        });
    }
}

// --- Input Processing ---
function readManualInputSettings() {
    const runM = parseInt(document.getElementById('manualRunMin').value) || 0;
    const runS = parseInt(document.getElementById('manualRunSec').value) || 0;
    const walkM = parseInt(document.getElementById('manualWalkMin').value) || 0;
    const walkS = parseInt(document.getElementById('manualWalkSec').value) || 0;
    
    const calculatedRun = (runM * 60) + runS;
    const calculatedWalk = (walkM * 60) + walkS;
    
    if (calculatedRun > 0 && calculatedWalk > 0) {
        activeIntervalConfig = { run: calculatedRun, walk: calculatedWalk };
    }
    
    targetBpm = parseInt(document.getElementById('metronomeBpm').value) || 165;
}

// --- App Control Flows ---
document.getElementById('startBtn').addEventListener('click', () => {
    spinUpAudioContext();
    readManualInputSettings();
    
    setupSection.classList.add('hidden');
    activeTimerSection.classList.remove('hidden');
    activeTimerSection.classList.add('flex');
    
    isWorkoutRunning = true;
    isWorkoutPaused = false;
    currentPhaseType = 'run';
    phaseTimeRemaining = activeIntervalConfig.run;
    totalTimeElapsed = 0;
    
    // Align internal schedule tracking variables exactly to audio clock start point
    nextMetronomeBeatTime = audioCtx.currentTime;
    nextLogicalSecondTime = audioCtx.currentTime;
    
    schedulePhaseChime('run', audioCtx.currentTime);
    updateUIStateDisplays();
    synchronizeLockScreenMedia();
    
    // Fire up structural engine scheduler loop
    schedulerIntervalTimer = setInterval(runAudioScheduler, SCHEDULER_TICK_RATE);
});

document.getElementById('pauseBtn').addEventListener('click', (e) => {
    isWorkoutPaused = !isWorkoutPaused;
    if (isWorkoutPaused) {
        e.target.textContent = 'Resume';
        e.target.className = 'flex-1 bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-xl shadow-md transition-colors';
        if(audioCtx) audioCtx.suspend();
    } else {
        e.target.textContent = 'Pause';
        e.target.className = 'flex-1 bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl font-bold text-xl shadow-md transition-colors';
        if(audioCtx) audioCtx.resume();
        // Reset timelines to prevent sudden sound bursts when unpausing
        nextMetronomeBeatTime = audioCtx.currentTime;
        nextLogicalSecondTime = audioCtx.currentTime;
    }
});

document.getElementById('stopBtn').addEventListener('click', () => {
    clearInterval(schedulerIntervalTimer);
    isWorkoutRunning = false;
    tearDownAudioContext();
    
    setupSection.classList.remove('hidden');
    activeTimerSection.classList.add('hidden');
    activeTimerSection.classList.remove('flex');
    
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('pauseBtn').className = 'flex-1 bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl font-bold text-xl shadow-md transition-colors';
});

// Setup Media Session hardware command hooks to catch lock screen pause taps
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => document.getElementById('pauseBtn').click());
    navigator.mediaSession.setActionHandler('pause', () => document.getElementById('pauseBtn').click());
}