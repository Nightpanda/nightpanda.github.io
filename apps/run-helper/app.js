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

// --- Enter Your Personal Spotify Credentials Here ---
const SPOTIFY_CLIENT_ID = 'YOUR_SPOTIFY_CLIENT_ID'; 

// --- Application State Context ---
let activeIntervalConfig = { run: 60, walk: 60 };
let isWorkoutRunning = false;
let isWorkoutPaused = false;
let currentPhaseType = 'run'; 
let phaseTimeRemaining = 0;
let totalTimeElapsed = 0;
let spotifyAccessToken = null;

// --- Web Audio Hardware Connectors ---
let audioCtx = null;
let backgroundKeepAliveOsc = null;
let backgroundKeepAliveGain = null;
let trackingEngineClock = null;

// --- Document UI Object Mapping ---
const presetContainer = document.getElementById('presetContainer');
const setupSection = document.getElementById('setupSection');
const activeTimerSection = document.getElementById('activeTimerSection');
const phaseDisplay = document.getElementById('currentPhase');
const timeDisplay = document.getElementById('timeRemaining');
const totalTimeDisplay = document.getElementById('totalTimeElapsed');
const spotifyBtn = document.getElementById('spotifyBtn');
const spotifyStatus = document.getElementById('spotifyStatus');
const upNextTrack = document.getElementById('upNextTrack');

// --- Process Presets Grid Interface ---
presets.forEach((preset, index) => {
    const btn = document.createElement('button');
    btn.className = 'preset-card bg-gray-800 hover:bg-gray-700 text-left p-3 rounded-xl border border-gray-700 transition-all active:scale-95';
    btn.dataset.run = preset.run;
    btn.dataset.walk = preset.walk;
    btn.innerHTML = `
        <div class="font-bold text-sm text-gray-200 tracking-tight">${preset.label}</div>
        <div class="text-xs font-mono text-gray-400 mt-0.5">${formatTime(preset.run)} Run / ${formatTime(preset.walk)} Walk</div>
    `;
    btn.onclick = (e) => {
        document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('border-blue-500', 'bg-gray-750'));
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

// --- Audio Generation Core (Screen-Locked Background Hack) ---
function spinUpAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    // Continuous sub-audible hum pipeline preventing mobile background OS suspension threads
    if (!backgroundKeepAliveOsc) {
        backgroundKeepAliveOsc = audioCtx.createOscillator();
        backgroundKeepAliveGain = audioCtx.createGain();
        backgroundKeepAliveOsc.frequency.setValueAtTime(25, audioCtx.currentTime); // Low frequency hum
        backgroundKeepAliveGain.gain.setValueAtTime(0.001, audioCtx.currentTime); // Mimic pure silence securely
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

function emitChime(type) {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const targetGain = audioCtx.createGain();
    osc.connect(targetGain);
    targetGain.connect(audioCtx.destination);
    
    if (type === 'run') {
        // Double High Beep for RUN transitions
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1200, audioCtx.currentTime + 0.12);
        targetGain.gain.setValueAtTime(0.8, audioCtx.currentTime);
        targetGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.40);
    } else {
        // Low Warning Drone for WALK transitions
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(380, audioCtx.currentTime);
        targetGain.gain.setValueAtTime(0.6, audioCtx.currentTime);
        targetGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.7);
        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 0.75);
    }
}

// --- Native Mobile Media Session Integrations ---
function synchronizeLockScreenMedia() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: `Phase: ${currentPhaseType.toUpperCase()} (${formatTime(phaseTimeRemaining)})`,
            artist: 'Galloway Interval Runner',
            album: `Interval Configuration: ${formatTime(activeIntervalConfig.run)} / ${formatTime(activeIntervalConfig.walk)}`,
            artwork: [{ src: 'https://cdn-icons-png.flaticon.com/512/5219/5219258.png', sizes: '512x512', type: 'image/png' }]
        });
        
        navigator.mediaSession.setActionHandler('play', () => handlePauseToggle());
        navigator.mediaSession.setActionHandler('pause', () => handlePauseToggle());
    }
}

// --- Workout Execution Loop Mechanics ---
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
}

function processTimerTick() {
    if (!isWorkoutRunning || isWorkoutPaused) return;

    phaseTimeRemaining--;
    totalTimeElapsed++;

    if (phaseTimeRemaining <= 0) {
        currentPhaseType = currentPhaseType === 'run' ? 'walk' : 'run';
        phaseTimeRemaining = activeIntervalConfig[currentPhaseType];
        emitChime(currentPhaseType);
    }

    updateUIStateDisplays();
    synchronizeLockScreenMedia();
}

function updateUIStateDisplays() {
    timeDisplay.textContent = formatTime(phaseTimeRemaining);
    totalTimeDisplay.textContent = `Total Execution: ${formatTime(totalTimeElapsed)}`;
    upNextTrack.textContent = `Up Next: ${currentPhaseType === 'run' ? 'WALK segment' : 'RUN segment'}`;
    
    if (currentPhaseType === 'run') {
        phaseDisplay.textContent = 'RUN';
        phaseDisplay.className = 'text-6xl font-extrabold uppercase tracking-widest text-green-400';
    } else {
        phaseDisplay.textContent = 'WALK';
        phaseDisplay.className = 'text-6xl font-extrabold uppercase tracking-widest text-blue-400';
    }
}

function handlePauseToggle() {
    isWorkoutPaused = !isWorkoutPaused;
    const pauseBtn = document.getElementById('pauseBtn');
    if (isWorkoutPaused) {
        pauseBtn.textContent = 'Resume';
        pauseBtn.className = 'flex-1 bg-green-600 hover:bg-green-500 py-4 rounded-xl font-bold text-xl shadow-md transition-colors';
        if(audioCtx) audioCtx.suspend();
    } else {
        pauseBtn.textContent = 'Pause';
        pauseBtn.className = 'flex-1 bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl font-bold text-xl shadow-md transition-colors';
        if(audioCtx) audioCtx.resume();
    }
}

// --- Interface Actions / Click Handlers ---
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
    
    emitChime('run');
    updateUIStateDisplays();
    synchronizeLockScreenMedia();
    
    trackingEngineClock = setInterval(processTimerTick, 1000);
    triggerSpotifyRemoteBpmPlaylist();
});

document.getElementById('pauseBtn').addEventListener('click', () => handlePauseToggle());

document.getElementById('stopBtn').addEventListener('click', () => {
    clearInterval(trackingEngineClock);
    isWorkoutRunning = false;
    tearDownAudioContext();
    
    setupSection.classList.remove('hidden');
    activeTimerSection.classList.add('hidden');
    activeTimerSection.classList.remove('flex');
    
    document.getElementById('pauseBtn').textContent = 'Pause';
    document.getElementById('pauseBtn').className = 'flex-1 bg-yellow-600 hover:bg-yellow-500 py-4 rounded-xl font-bold text-xl shadow-md transition-colors';
});

// --- Spotify API Remote Execution Tunnel ---
function parseIncomingSpotifyTokens() {
    if (window.location.hash) {
        const hashParams = {};
        window.location.hash.substring(1).split('&').forEach(item => {
            const parts = item.split('=');
            hashParams[parts[0]] = decodeURIComponent(parts[1]);
        });
        
        if (hashParams.access_token) {
            spotifyAccessToken = hashParams.access_token;
            spotifyStatus.textContent = '🟢 Connected to Spotify Remote';
            spotifyStatus.className = 'text-xs text-green-400 font-medium';
            spotifyBtn.textContent = 'Disconnect';
            spotifyBtn.classList.replace('bg-green-500', 'bg-gray-700');
            spotifyBtn.classList.replace('text-black', 'text-gray-300');
            window.location.hash = ''; // Clean up access tokens visibility from browser URL
        }
    }
}

spotifyBtn.addEventListener('click', () => {
    if (spotifyAccessToken) {
        // Disconnect Routine
        spotifyAccessToken = null;
        spotifyStatus.textContent = 'Spotify Disconnected';
        spotifyStatus.className = 'text-xs text-gray-400';
        spotifyBtn.textContent = 'Connect Spotify';
        spotifyBtn.classList.replace('bg-gray-700', 'bg-green-500');
        spotifyBtn.classList.replace('text-gray-300', 'text-black');
        return;
    }

    const redirectUri = window.location.origin + window.location.pathname;
    const scopes = 'user-modify-playback-state user-read-playback-state';
    window.location.href = `https://accounts.spotify.com/authorize?client_id=$${SPOTIFY_CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`;
});

async function triggerSpotifyRemoteBpmPlaylist() {
    if (!spotifyAccessToken) return;
    
    const targetBpmValue = document.getElementById('spotifyBpm').value || 165;
    const searchQuery = `${targetBpmValue} BPM Running`;
    
    try {
        // Step 1: Query for an optimized matching public playlist
        const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=playlist&limit=1`, {
            headers: { 'Authorization': `Bearer ${spotifyAccessToken}` }
        });
        const searchData = await searchResponse.json();
        
        if (searchData.playlists && searchData.playlists.items.length > 0) {
            const chosenPlaylistUri = searchData.playlists.items[0].uri;
            
            // Step 2: Push remote control instruction to the active mobile player state instance
            await fetch('https://api.spotify.com/v1/me/player/play', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${spotifyAccessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ context_uri: chosenPlaylistUri })
            });
        }
    } catch (err) {
        console.error("Spotify Remote Control execution instruction failure: ", err);
    }
}

// Read authentication payload when returning via Spotify Auth redirection rules
parseIncomingSpotifyTokens();