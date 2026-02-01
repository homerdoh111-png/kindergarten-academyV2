// ============================================
// SUPABASE AUTH & DATABASE INTEGRATION
// ============================================

// Supabase Configuration
const SUPABASE_URL = 'https://tybeiukfsuzwdvjwavtp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5YmVpdWtmc3V6d2R2andhdnRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk1MjE0ODUsImV4cCI6MjA4NTA5NzQ4NX0.1DI8_CQpxNdtxhhq9-dAxObFxxD-5xan0MvUzNuxd-Y';

// Initialize Supabase client
const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentProfile = null;

// Initialize auth when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuth();
});

// ===== Authentication Functions =====

async function checkAuth() {
    try {
        const { data: { session } } = await supabaseClient.auth.getSession();
        
        if (session) {
            currentUser = session.user;
            await loadUserProfile();
            showApp();
        } else {
            showAuth();
        }
    } catch (error) {
        console.error('Auth check error:', error);
        showAuth();
    }
}

async function loadUserProfile() {
    try {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id);
        
        if (error) throw error;
        
        if (data && data.length > 0) {
            currentProfile = data[0];
            updateUserDisplay();
        }
    } catch (error) {
        console.error('Error loading profile:', error);
    }
}

function updateUserDisplay() {
    if (currentProfile && currentProfile.full_name) {
        const displayElement = document.getElementById('childNameDisplay');
        if (displayElement) {
            displayElement.textContent = `Hi, ${currentProfile.full_name}! 👋`;
        }
        
        // Update speech bubble
        if (currentProfile.full_name) {
            setTimeout(() => {
                updateSpeechBubble(`Hi ${currentProfile.full_name}! Ready to learn? 🎉`);
            }, 1500);
        }
    }
}

function showApp() {
    document.getElementById('authScreen').classList.remove('active');
    document.getElementById('authScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');
}

function showAuth() {
    document.getElementById('authScreen').classList.add('active');
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appContainer').classList.add('hidden');
}

// Login Handler
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginFormElement');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔵 Login form submitted');
            
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            try {
                const { data, error } = await supabaseClient.auth.signInWithPassword({
                    email,
                    password
                });
                
                if (error) throw error;
                
                currentUser = data.user;
                await loadUserProfile();
                showApp();
            } catch (error) {
                showAuthError(error.message, 'authError');
            }
        });
    }
    
    // Signup Form Handler for Welcome Screen
    const signupForm = document.getElementById('signupFormElement');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('🔵 SIGNUP FORM SUBMITTED!');
            
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const childName = document.getElementById('childName').value;
            const childAge = document.getElementById('childAge').value;
            const parentName = document.getElementById('parentName').value;
            
            console.log('📝 Form values:', { email, childName, childAge, parentName });
            
            if (!email || !password || !childName || !childAge || !parentName) {
                showAuthError('Please fill in all fields', 'signupError');
                return;
            }
            
            if (password.length < 6) {
                showAuthError('Password must be at least 6 characters', 'signupError');
                return;
            }
            
            console.log('✅ Validation passed, calling Supabase...');
            
            try {
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password
                });
                
                console.log('📡 Supabase response:', { hasData: !!data, hasUser: !!data?.user, error: error?.message });
                
                if (error) throw error;
                
                if (data.user) {
                    console.log('✅ User created:', data.user.id);
                    
                    // Create profile
                    const { error: profileError } = await supabaseClient
                        .from('profiles')
                        .insert({
                            id: data.user.id,
                            email: email,
                            full_name: childName,
                            age: parseInt(childAge)
                        });
                    
                    if (profileError) {
                        console.error('⚠️ Profile error:', profileError);
                    } else {
                        console.log('✅ Profile created successfully');
                    }
                    
                    currentUser = data.user;
                    await loadUserProfile();
                    showApp();
                    
                    console.log('🎉 Signup complete!');
                }
            } catch (error) {
                console.error('❌ Signup error:', error);
                showAuthError(error.message || 'Signup failed. Please try again.', 'signupError');
            }
        });
    }
});

// Signup Handler
document.addEventListener('DOMContentLoaded', () => {
    const signupBtn = document.getElementById('signupBtn');
    if (signupBtn) {
        signupBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('🔵 Signup button clicked');
            
            const email = document.getElementById('signupEmail').value;
            const password = document.getElementById('signupPassword').value;
            const childName = document.getElementById('signupName').value;
            const childAge = document.getElementById('signupAge').value;
            
            console.log('📝 Form values:', { email, password: '***', childName, childAge });
            
            if (!email || !password || !childName || !childAge) {
                console.log('❌ Validation failed: Missing fields');
                showAuthError('Please fill in all fields');
                return;
            }
            
            if (password.length < 6) {
                console.log('❌ Validation failed: Password too short');
                showAuthError('Password must be at least 6 characters');
                return;
            }
            
            console.log('✅ Validation passed, calling Supabase...');
            
            try {
                // Sign up the user
                const { data, error } = await supabaseClient.auth.signUp({
                    email,
                    password
                });
                
                console.log('📡 Supabase response:', { data: !!data, error: error?.message });
                
                if (error) throw error;
                
                // Create profile with additional info
                if (data.user) {
                    console.log('👤 Creating profile for user:', data.user.id);
                    
                    const { error: profileError } = await supabaseClient
                        .from('profiles')
                        .insert({
                            id: data.user.id,
                            email: email,
                            full_name: childName,
                            age: parseInt(childAge)
                        });
                    
                    if (profileError) {
                        console.error('❌ Profile create error:', profileError);
                    } else {
                        console.log('✅ Profile created successfully');
                    }
                    
                    currentUser = data.user;
                    await loadUserProfile();
                    
                    // Hide auth modal and show app
                    console.log('🎉 Closing modal and showing celebration');
                    document.getElementById('authModal').classList.remove('active');
                    showCelebration(`Welcome, ${childName}! Let's learn together! 🎉`);
                }
            } catch (error) {
                console.error('❌ Signup error:', error);
                showAuthError(error.message || 'Signup failed. Please try again.');
            }
        });
    }
});

// Toggle between login and signup
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('showSignup')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
        document.getElementById('authError').textContent = '';
        document.getElementById('signupError').textContent = '';
    });
    
    document.getElementById('showLogin')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('authError').textContent = '';
        document.getElementById('signupError').textContent = '';
    });
});

// Logout Handler
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        try {
            await supabaseClient.auth.signOut();
            currentUser = null;
            currentProfile = null;
            showAuth();
            document.getElementById('settingsModal').classList.remove('active');
        } catch (error) {
            console.error('Logout error:', error);
        }
    });
});

function showAuthError(message, elementId = 'authError') {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        setTimeout(() => {
            errorElement.style.display = 'none';
        }, 5000);
    }
}

// ===== Progress Saving Functions =====

async function saveProgress(activity, score, starsEarned = 0) {
    if (!currentUser || !supabase) return;
    
    try {
        const { error } = await supabase
            .from('progress')
            .insert({
                user_id: currentUser.id,
                activity: activity,
                score: score,
                stars_earned: starsEarned,
                completed: true,
                timestamp: new Date().toISOString()
            });
        
        if (error) throw error;
        
        console.log('Progress saved:', activity, score);
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

// ===== Dashboard Functions =====

async function loadDashboard() {
    if (!currentUser || !supabase) return;
    
    try {
        // Get all progress for user
        const { data: progressData, error } = await supabase
            .from('progress')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('timestamp', { ascending: false });
        
        if (error) throw error;
        
        // Calculate stats
        const totalActivities = progressData.length;
        const totalStars = progressData.reduce((sum, p) => sum + (p.stars_earned || 0), 0);
        const bestScore = Math.max(...progressData.map(p => p.score), 0);
        
        // Update dashboard
        document.getElementById('totalActivities').textContent = totalActivities;
        document.getElementById('totalStars').textContent = totalStars;
        document.getElementById('bestScore').textContent = bestScore;
        
        // Group by activity
        const byActivity = {};
        progressData.forEach(p => {
            if (!byActivity[p.activity]) {
                byActivity[p.activity] = [];
            }
            byActivity[p.activity].push(p);
        });
        
        // Display activity breakdown
        const progressList = document.getElementById('progressList');
        progressList.innerHTML = '';
        
        Object.keys(byActivity).forEach(activity => {
            const activityData = byActivity[activity];
            const avgScore = Math.round(activityData.reduce((sum, p) => sum + p.score, 0) / activityData.length);
            const timesPlayed = activityData.length;
            
            const div = document.createElement('div');
            div.className = 'progress-item';
            div.innerHTML = `
                <div class="progress-activity">${activity}</div>
                <div class="progress-details">
                    Played: ${timesPlayed} times | Avg Score: ${avgScore}
                </div>
            `;
            progressList.appendChild(div);
        });
        
        // Display recent sessions
        const sessionsList = document.getElementById('sessionsList');
        sessionsList.innerHTML = '';
        
        progressData.slice(0, 10).forEach(p => {
            const date = new Date(p.timestamp);
            const div = document.createElement('div');
            div.className = 'session-item';
            div.innerHTML = `
                <div class="session-activity">${p.activity}</div>
                <div class="session-details">
                    Score: ${p.score} | Stars: ${p.stars_earned} | ${date.toLocaleDateString()}
                </div>
            `;
            sessionsList.appendChild(div);
        });
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// View Dashboard Handler
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('viewDashboard')?.addEventListener('click', async () => {
        document.getElementById('settingsModal').classList.remove('active');
        await loadDashboard();
        switchScreen('dashboardScreen');
    });
    
    document.getElementById('backFromDashboard')?.addEventListener('click', () => {
        switchScreen('activityScreen');
    });
});

// ===== App State =====
const AppState = {
    currentScreen: 'treehouseScreen',
    currentLetter: 0,
    currentNumber: 1,
    currentColor: 0,
    currentCoin: 0,
    shapeScore: 0,
    rhymeScore: 0,
    phonicsScore: 0,
    logicScore: 0,
    timeScore: 0,
    memoryMoves: 0,
    memoryMatches: 0,
    starsEarned: 0,
    soundEnabled: true,
    voiceEnabled: true,
    flippedCards: [],
    matchedCards: []
};

// ===== Data =====
const Letters = [
    { letter: 'A', words: [{emoji: '🍎', word: 'Apple'}, {emoji: '🐜', word: 'Ant'}] },
    { letter: 'B', words: [{emoji: '🎈', word: 'Balloon'}, {emoji: '🐻', word: 'Bear'}] },
    { letter: 'C', words: [{emoji: '🐱', word: 'Cat'}, {emoji: '🚗', word: 'Car'}] },
    { letter: 'D', words: [{emoji: '🐕', word: 'Dog'}, {emoji: '🦆', word: 'Duck'}] },
    { letter: 'E', words: [{emoji: '🥚', word: 'Egg'}, {emoji: '🐘', word: 'Elephant'}] },
    { letter: 'F', words: [{emoji: '🐸', word: 'Frog'}, {emoji: '🎏', word: 'Fish'}] },
    { letter: 'G', words: [{emoji: '🍇', word: 'Grapes'}, {emoji: '🦒', word: 'Giraffe'}] },
    { letter: 'H', words: [{emoji: '🏠', word: 'House'}, {emoji: '🐴', word: 'Horse'}] },
    { letter: 'I', words: [{emoji: '🍦', word: 'Ice Cream'}, {emoji: '👁️', word: 'Eye'}] },
    { letter: 'J', words: [{emoji: '🤹', word: 'Juggle'}, {emoji: '✈️', word: 'Jet'}] },
    { letter: 'K', words: [{emoji: '🔑', word: 'Key'}, {emoji: '🦘', word: 'Kangaroo'}] },
    { letter: 'L', words: [{emoji: '🦁', word: 'Lion'}, {emoji: '🍋', word: 'Lemon'}] },
    { letter: 'M', words: [{emoji: '🌙', word: 'Moon'}, {emoji: '🐵', word: 'Monkey'}] },
    { letter: 'N', words: [{emoji: '🪹', word: 'Nest'}, {emoji: '👃', word: 'Nose'}] },
    { letter: 'O', words: [{emoji: '🐙', word: 'Octopus'}, {emoji: '🍊', word: 'Orange'}] },
    { letter: 'P', words: [{emoji: '🐧', word: 'Penguin'}, {emoji: '🍕', word: 'Pizza'}] },
    { letter: 'Q', words: [{emoji: '👸', word: 'Queen'}, {emoji: '❓', word: 'Question'}] },
    { letter: 'R', words: [{emoji: '🌈', word: 'Rainbow'}, {emoji: '🚀', word: 'Rocket'}] },
    { letter: 'S', words: [{emoji: '☀️', word: 'Sun'}, {emoji: '⭐', word: 'Star'}] },
    { letter: 'T', words: [{emoji: '🐅', word: 'Tiger'}, {emoji: '🌳', word: 'Tree'}] },
    { letter: 'U', words: [{emoji: '☂️', word: 'Umbrella'}, {emoji: '🦄', word: 'Unicorn'}] },
    { letter: 'V', words: [{emoji: '🎻', word: 'Violin'}, {emoji: '🌋', word: 'Volcano'}] },
    { letter: 'W', words: [{emoji: '🍉', word: 'Watermelon'}, {emoji: '🐋', word: 'Whale'}] },
    { letter: 'X', words: [{emoji: '🦖', word: 'T-Rex'}, {emoji: '❌', word: 'X-Mark'}] },
    { letter: 'Y', words: [{emoji: '🧶', word: 'Yarn'}, {emoji: '🛶', word: 'Kayak'}] },
    { letter: 'Z', words: [{emoji: '🦓', word: 'Zebra'}, {emoji: '⚡', word: 'Zap'}] }
];

const Colors = [
    { name: 'Red', hex: '#FF4444', examples: [{emoji: '🍎', text: 'Apple'}, {emoji: '🚗', text: 'Car'}] },
    { name: 'Blue', hex: '#4444FF', examples: [{emoji: '💙', text: 'Heart'}, {emoji: '🌊', text: 'Water'}] },
    { name: 'Yellow', hex: '#FFD700', examples: [{emoji: '☀️', text: 'Sun'}, {emoji: '🍌', text: 'Banana'}] },
    { name: 'Green', hex: '#44FF44', examples: [{emoji: '🌳', text: 'Tree'}, {emoji: '🐸', text: 'Frog'}] },
    { name: 'Orange', hex: '#FFA500', examples: [{emoji: '🍊', text: 'Orange'}, {emoji: '🎃', text: 'Pumpkin'}] },
    { name: 'Purple', hex: '#9B59B6', examples: [{emoji: '🍇', text: 'Grapes'}, {emoji: '👾', text: 'Alien'}] },
    { name: 'Pink', hex: '#FF69B4', examples: [{emoji: '🌸', text: 'Flower'}, {emoji: '🐷', text: 'Pig'}] },
    { name: 'Brown', hex: '#8B4513', examples: [{emoji: '🐻', text: 'Bear'}, {emoji: '🍫', text: 'Chocolate'}] }
];

const Shapes = [
    { name: 'circle', color: '#FF6B9D' },
    { name: 'square', color: '#4ECDC4' },
    { name: 'triangle', color: '#FFE66D' },
    { name: 'star', color: '#FFA94D' }
];

const RhymeWords = [
    { word: 'CAT', emoji: '🐱', rhymes: ['HAT', 'BAT', 'DOG', 'SUN'], correct: ['HAT', 'BAT'] },
    { word: 'DOG', emoji: '🐕', rhymes: ['LOG', 'FOG', 'CAT', 'TREE'], correct: ['LOG', 'FOG'] },
    { word: 'SUN', emoji: '☀️', rhymes: ['FUN', 'RUN', 'MOON', 'STAR'], correct: ['FUN', 'RUN'] },
    { word: 'STAR', emoji: '⭐', rhymes: ['CAR', 'FAR', 'SUN', 'MOON'], correct: ['CAR', 'FAR'] },
    { word: 'TREE', emoji: '🌳', rhymes: ['BEE', 'SEE', 'CAR', 'DOG'], correct: ['BEE', 'SEE'] }
];

// Phonics blending words (CVC - consonant-vowel-consonant)
const PhonicsWords = [
    { word: 'CAT', sounds: ['C', 'A', 'T'], emoji: '🐱', decoys: [{emoji: '🐕', word: 'DOG'}, {emoji: '🌞', word: 'SUN'}] },
    { word: 'DOG', sounds: ['D', 'O', 'G'], emoji: '🐕', decoys: [{emoji: '🐱', word: 'CAT'}, {emoji: '🐸', word: 'FROG'}] },
    { word: 'SUN', sounds: ['S', 'U', 'N'], emoji: '☀️', decoys: [{emoji: '🌙', word: 'MOON'}, {emoji: '⭐', word: 'STAR'}] },
    { word: 'BUG', sounds: ['B', 'U', 'G'], emoji: '🐛', decoys: [{emoji: '🦋', word: 'FLY'}, {emoji: '🐝', word: 'BEE'}] },
    { word: 'PIG', sounds: ['P', 'I', 'G'], emoji: '🐷', decoys: [{emoji: '🐄', word: 'COW'}, {emoji: '🐑', word: 'SHEEP'}] },
    { word: 'HAT', sounds: ['H', 'A', 'T'], emoji: '🎩', decoys: [{emoji: '👟', word: 'SHOE'}, {emoji: '👕', word: 'SHIRT'}] }
];

// Logic patterns
const LogicPatterns = [
    { pattern: ['🔴', '🔵', '🔴', '🔵'], answer: '🔴', options: ['🔴', '🔵', '🟡'] },
    { pattern: ['⭐', '⭐', '🌙', '⭐', '⭐'], answer: '🌙', options: ['⭐', '🌙', '☀️'] },
    { pattern: ['🍎', '🍌', '🍎', '🍌'], answer: '🍎', options: ['🍎', '🍌', '🍇'] },
    { pattern: ['🐱', '🐶', '🐱', '🐶'], answer: '🐱', options: ['🐱', '🐶', '🐭'] },
    { pattern: ['1', '2', '1', '2'], answer: '1', options: ['1', '2', '3'] },
    { pattern: ['🔺', '🔲', '⭕', '🔺', '🔲'], answer: '⭕', options: ['🔺', '🔲', '⭕'] }
];

// Money (US coins)
const Coins = [
    { name: 'Penny', value: 1, display: '1¢', emoji: '🪙', color: '#CD7F32' },
    { name: 'Nickel', value: 5, display: '5¢', emoji: '🪙', color: '#C0C0C0' },
    { name: 'Dime', value: 10, display: '10¢', emoji: '🪙', color: '#D4AF37' },
    { name: 'Quarter', value: 25, display: '25¢', emoji: '🪙', color: '#E5E4E2' }
];

const MemoryEmojis = ['🐱', '🐶', '🐸', '🐻', '🦁', '🐼'];

// ===== Speech Synthesis =====
function speak(text) {
    if (!AppState.voiceEnabled || !window.speechSynthesis) {
        // If voice is off, still animate Buddy a bit.
        if (window.Buddy3D) window.Buddy3D.say(text);
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.8;
    utterance.pitch = 1.2;
    utterance.volume = 1;

    // Sync Buddy to speech events (talking + mouth boundaries)
    if (window.Buddy3D) {
        utterance.onstart = () => window.Buddy3D.talk(true, text);
        utterance.onend = () => window.Buddy3D.talk(false);
        utterance.onerror = () => window.Buddy3D.talk(false);
        utterance.onboundary = (evt) => window.Buddy3D.onBoundary(evt);
    }

    window.speechSynthesis.speak(utterance);
}

function playSound(type) {
    if (!AppState.soundEnabled) return;
    
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    switch(type) {
        case 'click':
            oscillator.frequency.value = 600;
            gainNode.gain.value = 0.3;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
            break;
        case 'correct':
            oscillator.frequency.value = 800;
            gainNode.gain.value = 0.3;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
            break;
        case 'incorrect':
            oscillator.frequency.value = 200;
            gainNode.gain.value = 0.3;
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.3);
            break;
        case 'celebrate':
            [400, 500, 600, 800].forEach((freq, i) => {
                setTimeout(() => {
                    const osc = audioContext.createOscillator();
                    const gain = audioContext.createGain();
                    osc.connect(gain);
                    gain.connect(audioContext.destination);
                    osc.frequency.value = freq;
                    gain.gain.value = 0.3;
                    osc.start();
                    osc.stop(audioContext.currentTime + 0.2);
                }, i * 100);
            });
            break;
    }
}

// ===== Screen Navigation =====
function switchScreen(screenId) {
    playSound('click');
    
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) {
        targetScreen.classList.add('active');
        AppState.currentScreen = screenId;
    }
}

// ===== Buddy Interactions =====
function updateSpeechBubble(text) {
    const bubble = document.getElementById('buddySpeech');
    if (!bubble) return;
    const speechText = bubble.querySelector('.speech-text');
    if (speechText) {
        speechText.textContent = text;
    }
    speak(text);
}

function buddyReact(emotion) {
    // Keep legacy CSS animation (if any) and also trigger Buddy3D.
    const center = document.getElementById('buddyCenter');
    if (window.Buddy3D) {
        window.Buddy3D.setEmotion(emotion);
        if (emotion === 'happy' || emotion === 'excited') window.Buddy3D.poke();
    }
    // Legacy fallback (no-op if element doesn't exist)
    const buddy = document.getElementById('buddy3d') || document.getElementById('buddyCenter') || document.getElementById('buddy');
    if (!buddy) return;
    switch(emotion) {
        case 'happy':
            buddy.classList.add('bounce');
            setTimeout(() => buddy.classList.remove('bounce'), 500);
            break;
        case 'excited':
            buddy.style.transform = 'scale(1.1)';
            setTimeout(() => buddy.style.transform = '', 300);
            break;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const buddy = document.getElementById('buddy');
    if (buddy) {
        buddy.addEventListener('click', () => {
            playSound('click');
            buddyReact('happy');
            const encouragements = [
                "You're doing great! 🎉",
                "I'm so proud of you! ⭐",
                "Keep learning! 🚀",
                "You're so smart! 🧠",
                "Let's keep going! 💪",
                "You're a star learner! ✨",
                "I believe in you! 🌟"
            ];
            updateSpeechBubble(encouragements[Math.floor(Math.random() * encouragements.length)]);
        });
    }
});

// ===== Phonics Activity (NEW - Challenger aligned) =====
let currentPhonicsWord = null;

function generatePhonicsChallenge() {
    currentPhonicsWord = PhonicsWords[Math.floor(Math.random() * PhonicsWords.length)];
    
    // Display sound parts with new classes
    const soundPartsContainer = document.getElementById('soundParts');
    soundPartsContainer.innerHTML = '';
    
    currentPhonicsWord.sounds.forEach((sound, index) => {
        const soundDiv = document.createElement('div');
        soundDiv.className = 'phonics-sound-tile';
        soundDiv.textContent = sound;
        soundDiv.style.animationDelay = `${index * 0.1}s`;
        soundPartsContainer.appendChild(soundDiv);
    });
    
    // Display blended word
    document.getElementById('blendedWord').textContent = currentPhonicsWord.word;
    
    // Create options with new classes
    const optionsContainer = document.getElementById('phonicsOptions');
    optionsContainer.innerHTML = '';
    
    // Shuffle correct answer with decoys
    const allOptions = [
        { emoji: currentPhonicsWord.emoji, word: currentPhonicsWord.word, correct: true },
        ...currentPhonicsWord.decoys.map(d => ({ ...d, correct: false }))
    ].sort(() => Math.random() - 0.5);
    
    allOptions.forEach(option => {
        const btn = document.createElement('button');
        btn.className = 'phonics-new-option';
        btn.innerHTML = `
            <span class="phonics-option-emoji-new">${option.emoji}</span>
            <span class="phonics-option-text-new">${option.word}</span>
        `;
        btn.addEventListener('click', () => checkPhonics(option.correct, btn));
        optionsContainer.appendChild(btn);
    });
}

async function checkPhonics(isCorrect, clickedBtn) {
    const buttons = document.querySelectorAll('#phonicsOptions .phonics-new-option');
    buttons.forEach(btn => btn.style.pointerEvents = 'none');

    if (isCorrect) {
        clickedBtn.classList.add('correct-flash');
        playSound('correct');
        AppState.phonicsScore++;
        document.getElementById('phonicsScore').textContent = `⭐ Score: ${AppState.phonicsScore}`;
        updateSpeechBubble('Yes! You blended the sounds! 📖');
        buddyReact('happy');
        earnStar();
        saveProgress('phonics', AppState.phonicsScore, 1);

        setTimeout(() => generatePhonicsChallenge(), 1500);
    } else {
        clickedBtn.classList.add('wrong-flash');
        playSound('incorrect');
        updateSpeechBubble('Try blending the sounds again! 🎵');

        setTimeout(() => {
            buttons.forEach(btn => { btn.classList.remove('wrong-flash'); btn.style.pointerEvents = ''; });
        }, 800);
    }
}

// ===== Logic Activity (NEW - Challenger aligned) =====
let currentPattern = null;

function generateLogicChallenge() {
    currentPattern = LogicPatterns[Math.floor(Math.random() * LogicPatterns.length)];
    
    const patternContainer = document.getElementById('patternDisplay');
    if (!patternContainer) { console.error('patternDisplay not found'); return; }
    patternContainer.innerHTML = '';
    
    currentPattern.pattern.forEach((item, index) => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'logic-pattern-item';
        itemDiv.textContent = item;
        itemDiv.style.animationDelay = `${index * 0.1}s`;
        patternContainer.appendChild(itemDiv);
    });
    
    // Question mark placeholder
    const questionDiv = document.createElement('div');
    questionDiv.className = 'logic-pattern-item logic-missing';
    questionDiv.textContent = '?';
    questionDiv.style.animationDelay = `${currentPattern.pattern.length * 0.1}s`;
    patternContainer.appendChild(questionDiv);
    
    // Answer options
    const optionsContainer = document.getElementById('patternOptions');
    if (!optionsContainer) { console.error('patternOptions not found'); return; }
    optionsContainer.innerHTML = '';
    
    currentPattern.options.forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'new-answer-option';
        btn.textContent = option;
        btn.style.animationDelay = `${(currentPattern.pattern.length + 1 + index) * 0.1}s`;
        btn.addEventListener('click', () => checkPattern(option));
        optionsContainer.appendChild(btn);
    });
}

async function checkPattern(selectedOption) {
    const buttons = document.querySelectorAll('#patternOptions .new-answer-option');
    buttons.forEach(btn => btn.style.pointerEvents = 'none');

    if (selectedOption === currentPattern.answer) {
        // Flash correct button green
        buttons.forEach(btn => { if (btn.textContent === selectedOption) btn.classList.add('correct-flash'); });
        playSound('correct');
        AppState.logicScore++;
        document.getElementById('logicScore').textContent = `⭐ Score: ${AppState.logicScore}`;
        updateSpeechBubble('Perfect pattern thinking! 🧩');
        buddyReact('happy');
        earnStar();
        saveProgress('logic', AppState.logicScore, 1); // fire and forget

        setTimeout(() => generateLogicChallenge(), 1500);
    } else {
        // Flash wrong button red + shake
        buttons.forEach(btn => { if (btn.textContent === selectedOption) btn.classList.add('wrong-flash'); });
        playSound('incorrect');
        updateSpeechBubble('Look at the pattern again! 🔍');

        setTimeout(() => {
            buttons.forEach(btn => { btn.classList.remove('wrong-flash'); btn.style.pointerEvents = ''; });
        }, 800);
    }
}

// ===== Money Activity (NEW - Challenger aligned) =====
function generateMoneyCounting() {
    // Random number of same coins (2-5)
    const numCoins = 2 + Math.floor(Math.random() * 4);
    const coinType = Math.floor(Math.random() * Coins.length);
    const coin = Coins[coinType];
    const correctAnswer = coin.value * numCoins;
    
    // Display coins with new 3D styling
    const coinsContainer = document.getElementById('coinsToCount');
    coinsContainer.innerHTML = '';
    
    for (let i = 0; i < numCoins; i++) {
        const coinDiv = document.createElement('div');
        coinDiv.className = `money-coin money-coin-${coin.name.toLowerCase()}`;
        coinDiv.style.animationDelay = `${i * 0.1}s`;
        coinDiv.innerHTML = `
            <div style="font-size: 2rem; color: white; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);">${coin.display}</div>
            <div style="font-size: 0.9rem; color: white; text-shadow: 0 2px 6px rgba(0, 0, 0, 0.5);">${coin.name}</div>
        `;
        coinsContainer.appendChild(coinDiv);
    }
    
    // Generate answer options with new classes
    const optionsContainer = document.getElementById('moneyAnswerOptions');
    optionsContainer.innerHTML = '';
    
    // Generate 3 unique positive answer options including the correct one
    const optionsSet = new Set([correctAnswer]);
    const candidates = [correctAnswer + 5, correctAnswer - 5, correctAnswer + 10, correctAnswer + 1, correctAnswer - 1];
    for (const c of candidates) {
        if (c > 0 && !optionsSet.has(c)) optionsSet.add(c);
        if (optionsSet.size === 3) break;
    }
    const options = [...optionsSet].sort(() => Math.random() - 0.5);
    
    options.forEach(value => {
        const btn = document.createElement('button');
        btn.className = 'new-answer-option';
        btn.textContent = value + '¢';
        btn.addEventListener('click', () => checkMoney(value === correctAnswer, btn));
        optionsContainer.appendChild(btn);
    });
}

function checkMoney(isCorrect, clickedBtn) {
    const buttons = document.querySelectorAll('#moneyAnswerOptions .new-answer-option');
    buttons.forEach(btn => btn.style.pointerEvents = 'none');

    if (isCorrect) {
        clickedBtn.classList.add('correct-flash');
        playSound('correct');
        AppState.moneyScore = (AppState.moneyScore || 0) + 1;
        document.getElementById('moneyScore').textContent = `⭐ Score: ${AppState.moneyScore}`;
        updateSpeechBubble('Great counting! 💰');
        buddyReact('happy');
        earnStar();
        saveProgress('money', AppState.moneyScore, 1);

        setTimeout(() => generateMoneyCounting(), 1500);
    } else {
        clickedBtn.classList.add('wrong-flash');
        playSound('incorrect');
        updateSpeechBubble('Count the coins again! 🪙');

        setTimeout(() => {
            buttons.forEach(btn => { btn.classList.remove('wrong-flash'); btn.style.pointerEvents = ''; });
        }, 800);
    }
}

// ===== Time Activity (NEW - Challenger aligned) =====
let currentTime = { hour: 3, minute: 0 };

function generateTimeChallenge() {
    // Generate time (on the hour or half hour for kindergarten)
    const hour = 1 + Math.floor(Math.random() * 12);
    const minute = Math.random() < 0.5 ? 0 : 30;
    
    currentTime = { hour, minute };
    
    // Update clock
    updateClockDisplay();
    
    // Generate options with new classes
    const optionsContainer = document.getElementById('timeOptions');
    optionsContainer.innerHTML = '';
    
    const correctTime = `${hour}:${minute.toString().padStart(2, '0')}`;
    const wrongTimes = [
        `${(hour % 12) + 1}:${minute.toString().padStart(2, '0')}`,
        `${hour}:${(minute === 0 ? 30 : 0).toString().padStart(2, '0')}`,
        `${((hour + 1) % 12) || 12}:${minute.toString().padStart(2, '0')}`
    ];
    
    const options = [correctTime, ...wrongTimes]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3);
    
    options.forEach(time => {
        const btn = document.createElement('button');
        btn.className = 'new-answer-option';
        btn.textContent = time;
        btn.addEventListener('click', function() {
            // Mark this button as clicked so checkTime knows which to flash
            document.querySelectorAll('#timeOptions .new-answer-option').forEach(b => b.classList.remove('clicked'));
            this.classList.add('clicked');
            checkTime(time === correctTime);
        });
        optionsContainer.appendChild(btn);
    });
}

function updateClockDisplay() {
    const hourHand = document.getElementById('hourHand');
    const minuteHand = document.getElementById('minuteHand');
    
    // Calculate angles (subtract 90 to start from 12 o'clock)
    const hourAngle = ((currentTime.hour % 12) * 30 + (currentTime.minute / 60) * 30) - 90;
    const minuteAngle = (currentTime.minute * 6) - 90;
    
    hourHand.style.transform = `rotate(${hourAngle}deg)`;
    minuteHand.style.transform = `rotate(${minuteAngle}deg)`;
}

async function checkTime(isCorrect) {
    const buttons = document.querySelectorAll('#timeOptions .new-answer-option');
    buttons.forEach(btn => btn.style.pointerEvents = 'none');

    if (isCorrect) {
        // Find and flash the clicked (correct) button
        buttons.forEach(btn => { if (btn.classList.contains('clicked')) btn.classList.add('correct-flash'); });
        playSound('correct');
        AppState.timeScore++;
        document.getElementById('timeScore').textContent = `⭐ Score: ${AppState.timeScore}`;
        updateSpeechBubble('You can tell time! 🕐');
        buddyReact('happy');
        earnStar();
        saveProgress('time', AppState.timeScore, 1);

        setTimeout(() => generateTimeChallenge(), 1500);
    } else {
        buttons.forEach(btn => { if (btn.classList.contains('clicked')) btn.classList.add('wrong-flash'); });
        playSound('incorrect');
        updateSpeechBubble('Look at the clock hands! 🔍');

        setTimeout(() => {
            buttons.forEach(btn => { btn.classList.remove('wrong-flash', 'clicked'); btn.style.pointerEvents = ''; });
        }, 800);
    }
}

// ===== Letter Activity =====
function updateLetterDisplay() {
    const letterData = Letters[AppState.currentLetter];
    
    // Update letter display
    document.getElementById('letterBig').textContent = letterData.letter;
    
    // Update back of card with example
    const firstWord = letterData.words[0];
    document.getElementById('exampleEmoji').textContent = firstWord.emoji;
    document.getElementById('exampleWord').textContent = firstWord.word;
    
    // Reset flip if needed
    const card = document.getElementById('letterCard');
    if (card.classList.contains('flipped')) {
        card.classList.remove('flipped');
    }
    
    // Generate alphabet grid
    const examplesContainer = document.getElementById('letterExamples');
    examplesContainer.innerHTML = '';
    
    Letters.forEach((letter, index) => {
        const btn = document.createElement('button');
        btn.className = 'letters-alphabet-btn';
        if (index === AppState.currentLetter) {
            btn.classList.add('current');
        }
        btn.textContent = letter.letter;
        btn.addEventListener('click', () => {
            AppState.currentLetter = index;
            updateLetterDisplay();
        });
        examplesContainer.appendChild(btn);
    });
}

// Add flip card functionality
document.addEventListener('DOMContentLoaded', () => {
    const letterCard = document.getElementById('letterCard');
    if (letterCard) {
        letterCard.addEventListener('click', function() {
            this.classList.toggle('flipped');
        });
    }
});

// ===== Number Activity =====
function updateNumberDisplay() {
    document.getElementById('numberBig').textContent = AppState.currentNumber;
    document.getElementById('totalCount').textContent = AppState.currentNumber;
    document.getElementById('countedValue').textContent = '0';
    
    const objectsContainer = document.getElementById('countingObjects');
    objectsContainer.innerHTML = '';
    
    const emojis = ['🌟', '🎈', '🍎', '🌸', '⚽', '🦋', '🍕', '🎨', '🚀', '🎁'];
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    
    let countedObjects = 0;
    const objectsToCount = [];
    
    for (let i = 0; i < AppState.currentNumber; i++) {
        const obj = document.createElement('div');
        obj.className = 'math-counting-object';
        obj.textContent = randomEmoji;
        obj.style.animationDelay = `${i * 0.1}s`;
        obj.dataset.index = i;
        obj.dataset.counted = 'false';
        
        obj.addEventListener('click', function() {
            if (this.dataset.counted === 'false') {
                this.dataset.counted = 'true';
                this.classList.add('counted');
                countedObjects++;
                document.getElementById('countedValue').textContent = countedObjects;
                
                if (countedObjects === AppState.currentNumber) {
                    playSound('correct');
                    setTimeout(() => {
                        buddyReact('happy');
                        updateSpeechBubble('Great counting! 🎉');
                    }, 300);
                }
            }
        });
        
        objectsContainer.appendChild(obj);
        objectsToCount.push(obj);
    }
}

// ===== Shapes Activity =====
let currentShape = null;

function generateShapeChallenge() {
    currentShape = Shapes[Math.floor(Math.random() * Shapes.length)];
    document.getElementById('shapePrompt').textContent = `Tap the ${currentShape.name}!`;
    
    const optionsContainer = document.getElementById('shapeOptions');
    optionsContainer.innerHTML = '';
    
    const shuffled = [...Shapes].sort(() => Math.random() - 0.5);
    
    shuffled.forEach(shape => {
        const btn = document.createElement('button');
        btn.className = 'shape-option';
        btn.innerHTML = createShapeSVG(shape.name, shape.color);
        btn.addEventListener('click', () => checkShape(shape.name, btn));
        optionsContainer.appendChild(btn);
    });
}

function createShapeSVG(shapeName, color) {
    const svgs = {
        circle: `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="${color}"/></svg>`,
        square: `<svg viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" fill="${color}"/></svg>`,
        triangle: `<svg viewBox="0 0 100 100"><polygon points="50,15 90,85 10,85" fill="${color}"/></svg>`,
        star: `<svg viewBox="0 0 100 100"><polygon points="50,10 61,35 87,35 66,52 75,77 50,60 25,77 34,52 13,35 39,35" fill="${color}"/></svg>`
    };
    return svgs[shapeName] || '';
}

async function checkShape(selectedShape, clickedBtn) {
    const buttons = document.querySelectorAll('#shapeOptions .shape-option');
    buttons.forEach(btn => btn.style.pointerEvents = 'none');

    if (selectedShape === currentShape.name) {
        clickedBtn.classList.add('correct-flash');
        playSound('correct');
        AppState.shapeScore++;
        document.getElementById('shapeScore').textContent = `⭐ Score: ${AppState.shapeScore}`;
        updateSpeechBubble('Amazing! That\'s correct! 🎉');
        buddyReact('happy');
        earnStar();
        saveProgress('shapes', AppState.shapeScore, 1);

        setTimeout(() => generateShapeChallenge(), 1500);
    } else {
        clickedBtn.classList.add('wrong-flash');
        playSound('incorrect');
        updateSpeechBubble('Oops! Try again! 🤔');

        setTimeout(() => {
            buttons.forEach(btn => { btn.classList.remove('wrong-flash'); btn.style.pointerEvents = ''; });
        }, 800);
    }
}

// ===== Color Activity =====
function updateColorDisplay() {
    const colorData = Colors[AppState.currentColor];
    
    // Update paint bucket fill
    document.getElementById('colorPaintFill').style.background = colorData.hex;
    document.getElementById('colorName').textContent = colorData.name;
    document.getElementById('colorName').style.color = colorData.hex;
    
    // Generate color palette swatches
    const examplesContainer = document.getElementById('colorExamples');
    examplesContainer.innerHTML = '';
    
    Colors.forEach((color, index) => {
        const swatch = document.createElement('button');
        swatch.className = 'colors-swatch';
        swatch.style.background = color.hex;
        swatch.style.animationDelay = `${index * 0.05}s`;
        swatch.addEventListener('click', () => {
            AppState.currentColor = index;
            updateColorDisplay();
        });
        examplesContainer.appendChild(swatch);
    });
}

// ===== Rhyme Activity =====
let currentRhyme = null;

function generateRhymeChallenge() {
    currentRhyme = RhymeWords[Math.floor(Math.random() * RhymeWords.length)];
    
    const emojiEl = document.getElementById('rhymeEmoji');
    const wordEl = document.getElementById('rhymeWord');
    const targetEl = document.getElementById('targetRhymeWord');
    const optionsContainer = document.getElementById('rhymeOptions');
    
    if (!emojiEl || !wordEl || !targetEl || !optionsContainer) {
        console.error('Rhyme elements missing:', {emojiEl: !!emojiEl, wordEl: !!wordEl, targetEl: !!targetEl, optionsContainer: !!optionsContainer});
        return;
    }
    
    emojiEl.textContent = currentRhyme.emoji;
    wordEl.textContent = currentRhyme.word.toUpperCase();
    targetEl.textContent = currentRhyme.word.toLowerCase();
    
    optionsContainer.innerHTML = '';
    
    currentRhyme.rhymes.forEach((word, index) => {
        const btn = document.createElement('button');
        btn.className = 'rhymes-word-option';
        btn.innerHTML = `<div style="font-size: 2.5rem; font-weight: 700; color: #2D3748;">${word}</div>`;
        btn.style.animationDelay = `${index * 0.15}s`;
        btn.addEventListener('click', () => checkRhyme(word, btn));
        optionsContainer.appendChild(btn);
    });
}

async function checkRhyme(selectedWord, clickedBtn) {
    const buttons = document.querySelectorAll('#rhymeOptions .rhymes-word-option');
    buttons.forEach(btn => btn.style.pointerEvents = 'none');

    if (currentRhyme.correct.includes(selectedWord)) {
        clickedBtn.classList.add('correct-flash');
        playSound('correct');
        AppState.rhymeScore++;
        document.getElementById('rhymeScore').textContent = `⭐ Score: ${AppState.rhymeScore}`;
        updateSpeechBubble('Yes! That rhymes! 🎵');
        buddyReact('happy');
        earnStar();
        saveProgress('rhymes', AppState.rhymeScore, 1);

        setTimeout(() => generateRhymeChallenge(), 1500);
    } else {
        clickedBtn.classList.add('wrong-flash');
        playSound('incorrect');
        updateSpeechBubble('Not quite! Try another one! 🤔');

        setTimeout(() => {
            buttons.forEach(btn => { btn.classList.remove('wrong-flash'); btn.style.pointerEvents = ''; });
        }, 800);
    }
}

// ===== Memory Game =====
function initMemoryGame() {
    AppState.memoryMoves = 0;
    AppState.memoryMatches = 0;
    AppState.flippedCards = [];
    AppState.matchedCards = [];
    
    document.getElementById('memoryMoves').textContent = 'Moves: 0';
    document.getElementById('memoryMatches').textContent = 'Matches: 0/6';
    
    const board = document.getElementById('memoryBoard');
    board.innerHTML = '';
    
    const cards = [...MemoryEmojis, ...MemoryEmojis]
        .sort(() => Math.random() - 0.5)
        .map((emoji, index) => ({
            emoji,
            id: index,
            flipped: false,
            matched: false
        }));
    
    cards.forEach((card, index) => {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'memory-card';
        cardDiv.dataset.id = index;
        cardDiv.dataset.emoji = card.emoji;
        cardDiv.textContent = '?';
        cardDiv.addEventListener('click', () => handleCardClick(index, cards));
        board.appendChild(cardDiv);
    });
}

function handleCardClick(index, cards) {
    if (AppState.flippedCards.length === 2) return;
    
    const card = cards[index];
    if (card.flipped || card.matched) return;
    
    playSound('click');
    
    const cardElement = document.querySelector(`[data-id="${index}"]`);
    cardElement.textContent = card.emoji;
    cardElement.classList.add('flipped');
    
    card.flipped = true;
    AppState.flippedCards.push({ index, emoji: card.emoji });
    
    if (AppState.flippedCards.length === 2) {
        AppState.memoryMoves++;
        document.getElementById('memoryMoves').textContent = `Moves: ${AppState.memoryMoves}`;
        
        setTimeout(() => checkMatch(cards), 1000);
    }
}

async function checkMatch(cards) {
    const [card1, card2] = AppState.flippedCards;
    
    if (card1.emoji === card2.emoji) {
        playSound('correct');
        cards[card1.index].matched = true;
        cards[card2.index].matched = true;
        
        document.querySelector(`[data-id="${card1.index}"]`).classList.add('matched');
        document.querySelector(`[data-id="${card2.index}"]`).classList.add('matched');
        
        AppState.memoryMatches++;
        await saveProgress('memory', AppState.memoryMoves, 1);
        document.getElementById('memoryMatches').textContent = `Matches: ${AppState.memoryMatches}/6`;
        
        if (AppState.memoryMatches === 6) {
            setTimeout(() => {
                showCelebration('You matched them all! Amazing memory! 🧠');
                earnStar();
            }, 500);
        }
    } else {
        playSound('incorrect');
        cards[card1.index].flipped = false;
        cards[card2.index].flipped = false;
        
        document.querySelector(`[data-id="${card1.index}"]`).textContent = '?';
        document.querySelector(`[data-id="${card2.index}"]`).textContent = '?';
        document.querySelector(`[data-id="${card1.index}"]`).classList.remove('flipped');
        document.querySelector(`[data-id="${card2.index}"]`).classList.remove('flipped');
    }
    
    AppState.flippedCards = [];
}

// ===== Stars System =====
function earnStar() {
    if (AppState.starsEarned < 3) {
        AppState.starsEarned++;
        const star = document.getElementById(`star${AppState.starsEarned}`);
        if (star) {
            star.classList.add('earned');
            playSound('celebrate');
        }
    }
}

// ===== Celebration =====
function showCelebration(message) {
    playSound('celebrate');
    
    const overlay = document.getElementById('celebrationOverlay');
    const messageEl = document.getElementById('celebrationMessage');
    
    messageEl.textContent = message;
    overlay.classList.add('active');
    
    createConfetti();
    
    speak(message);
    buddyReact('happy');
}

function createConfetti() {
    const confettiContainer = document.getElementById('confetti');
    confettiContainer.innerHTML = '';
    
    const colors = ['#FF6B9D', '#FFA94D', '#4ECDC4', '#FFE66D', '#95E1D3'];
    
    for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.style.position = 'absolute';
        confetti.style.width = '10px';
        confetti.style.height = '10px';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '-20px';
        confetti.style.opacity = Math.random();
        confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
        
        confettiContainer.appendChild(confetti);
        
        const duration = 2000 + Math.random() * 1000;
        confetti.animate([
            { transform: `translateY(0) rotate(0deg)`, opacity: 1 },
            { transform: `translateY(${window.innerHeight}px) rotate(${360 + Math.random() * 360}deg)`, opacity: 0 }
        ], {
            duration: duration,
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        });
    }
}

// ===== Event Listeners =====
document.addEventListener('DOMContentLoaded', () => {
    // Note: Start button removed - treehouse is now the main screen
    /*
    document.getElementById('startBtn')?.addEventListener('click', () => {
        switchScreen('activityScreen');
        updateSpeechBubble('Choose what you want to learn! 🎓');
    });
    */
    
    // Activity Selection - OLD CODE (now handled by treehouse bubbles)
    /*
    document.querySelectorAll('.activity-card').forEach(card => {
        card.addEventListener('click', (e) => {
            const activity = e.currentTarget.dataset.activity;
            
            switch(activity) {
                case 'phonics':
                    switchScreen('phonicsScreen');
                    generatePhonicsChallenge();
                    updateSpeechBubble('Let\'s blend sounds together! 📖');
                    break;
                case 'letters':
                    switchScreen('lettersScreen');
                    updateLetterDisplay();
                    updateSpeechBubble('Let\'s learn the alphabet! 🔤');
                    break;
                case 'numbers':
                    switchScreen('numbersScreen');
                    updateNumberDisplay();
                    updateSpeechBubble('Let\'s count together! 🔢');
                    break;
                case 'logic':
                    switchScreen('logicScreen');
                    generateLogicChallenge();
                    updateSpeechBubble('Find the pattern! 🧩');
                    break;
                case 'shapes':
                    switchScreen('shapesScreen');
                    generateShapeChallenge();
                    updateSpeechBubble('Can you find the right shape? ⭐');
                    break;
                case 'colors':
                    switchScreen('colorsScreen');
                    updateColorDisplay();
                    updateSpeechBubble('Let\'s explore colors! 🎨');
                    break;
                case 'money':
                    switchScreen('moneyScreen');
                    updateCoinDisplay();
                    updateSpeechBubble('Let\'s count money! 💰');
                    break;
                case 'time':
                    switchScreen('timeScreen');
                    generateTimeChallenge();
                    updateSpeechBubble('Can you tell time? 🕐');
                    break;
                case 'rhymes':
                    switchScreen('rhymesScreen');
                    generateRhymeChallenge();
                    updateSpeechBubble('Let\'s find words that rhyme! 🎵');
                    break;
                case 'memory':
                    switchScreen('memoryScreen');
                    initMemoryGame();
                    updateSpeechBubble('Match the cards! 🧠');
                    break;
            }
        });
    });
    */
    
    // Back Buttons
    const backButtons = [
        'backToWelcome', 'backFromPhonics', 'backFromLetters', 'backFromNumbers',
        'backFromLogic', 'backFromShapes', 'backFromColors', 'backFromMoney',
        'backFromTime', 'backFromRhymes', 'backFromMemory'
    ];
    
    backButtons.forEach(btnId => {
        document.getElementById(btnId)?.addEventListener('click', () => {
            // All back buttons return to treehouse
            switchScreen('treehouseScreen');
            const buddySpeech = document.getElementById('buddySpeech');
            if (buddySpeech) {
                const speechText = buddySpeech.querySelector('.speech-text');
                if (speechText) speechText.textContent = 'Welcome back! 🏡';
            }
        });
    });
    
    // Letters navigation
    document.getElementById('prevLetter')?.addEventListener('click', () => {
        playSound('click');
        AppState.currentLetter = (AppState.currentLetter - 1 + Letters.length) % Letters.length;
        updateLetterDisplay();
    });
    
    document.getElementById('nextLetter')?.addEventListener('click', () => {
        playSound('click');
        AppState.currentLetter = (AppState.currentLetter + 1) % Letters.length;
        updateLetterDisplay();
    });
    
    document.getElementById('sayLetter')?.addEventListener('click', () => {
        playSound('click');
        const letterData = Letters[AppState.currentLetter];
        speak(`The letter ${letterData.letter}. ${letterData.letter} is for ${letterData.words[0].word}`);
        buddyReact('excited');
    });
    
    // Numbers navigation
    document.getElementById('prevNumber')?.addEventListener('click', () => {
        playSound('click');
        AppState.currentNumber = AppState.currentNumber === 1 ? 10 : AppState.currentNumber - 1;
        updateNumberDisplay();
    });
    
    document.getElementById('nextNumber')?.addEventListener('click', () => {
        playSound('click');
        AppState.currentNumber = AppState.currentNumber === 10 ? 1 : AppState.currentNumber + 1;
        updateNumberDisplay();
    });
    
    document.getElementById('sayNumber')?.addEventListener('click', () => {
        playSound('click');
        speak(`The number ${AppState.currentNumber}`);
        buddyReact('excited');
    });
    
    // Colors navigation
    document.getElementById('prevColor')?.addEventListener('click', () => {
        playSound('click');
        AppState.currentColor = (AppState.currentColor - 1 + Colors.length) % Colors.length;
        updateColorDisplay();
    });
    
    document.getElementById('nextColor')?.addEventListener('click', () => {
        playSound('click');
        AppState.currentColor = (AppState.currentColor + 1) % Colors.length;
        updateColorDisplay();
    });
    
    document.getElementById('sayColor')?.addEventListener('click', () => {
        playSound('click');
        const colorData = Colors[AppState.currentColor];
        speak(`The color ${colorData.name}`);
        buddyReact('excited');
    });
    
    // Money navigation (legacy nav buttons — regenerate full challenge)
    document.getElementById('prevCoin')?.addEventListener('click', () => {
        playSound('click');
        generateMoneyCounting();
    });
    
    document.getElementById('nextCoin')?.addEventListener('click', () => {
        playSound('click');
        generateMoneyCounting();
    });
    
    document.getElementById('sayCoin')?.addEventListener('click', () => {
        playSound('click');
        const coinData = Coins[AppState.currentCoin];
        speak(`This is a ${coinData.name}. It's worth ${coinData.value} cent${coinData.value > 1 ? 's' : ''}`);
        buddyReact('excited');
    });
    
    // Settings
    document.getElementById('settingsBtn')?.addEventListener('click', () => {
        document.getElementById('settingsModal').classList.add('active');
    });
    
    document.getElementById('closeSettings')?.addEventListener('click', () => {
        document.getElementById('settingsModal').classList.remove('active');
    });
    
    document.getElementById('soundToggle')?.addEventListener('change', (e) => {
        AppState.soundEnabled = e.target.checked;
    });
    
    document.getElementById('voiceToggle')?.addEventListener('change', (e) => {
        AppState.voiceEnabled = e.target.checked;
    });
    
    // Celebration Continue
    document.getElementById('continueBtn')?.addEventListener('click', () => {
        document.getElementById('celebrationOverlay').classList.remove('active');
    });
    
    // Initial speech
    setTimeout(() => {
        updateSpeechBubble('Hi! I\'m Buddy! Let\'s learn together! 🎉');
    }, 1000);
});

// ===== Supabase Integration (Progress Saving) =====
// saveProgress is defined earlier (line ~306) using supabaseClient

// ===== Service Worker for PWA =====
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered'))
            .catch(err => console.log('SW registration failed'));
    });
}

// ===== Install Prompt for iOS =====
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're on iOS and not in standalone mode
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    
    if (isIOS && !isStandalone) {
        // Don't show immediately - wait for user to interact first
        setTimeout(() => {
            showInstallPrompt();
        }, 10000); // Show after 10 seconds
    }
});

function showInstallPrompt() {
    // Check if user has dismissed before
    if (localStorage.getItem('installPromptDismissed') === 'true') {
        return;
    }
    
    const prompt = document.createElement('div');
    prompt.className = 'install-prompt show';
    prompt.innerHTML = `
        <span class="install-prompt-icon">📱</span>
        <span class="install-prompt-text">
            <strong>Install this app!</strong>
            <br>Tap <span style="font-size: 1.2em;">⎋</span> then "Add to Home Screen"
        </span>
        <button class="install-prompt-close" onclick="dismissInstallPrompt()">✕</button>
    `;
    document.body.appendChild(prompt);
}

function dismissInstallPrompt() {
    const prompt = document.querySelector('.install-prompt');
    if (prompt) {
        prompt.remove();
        localStorage.setItem('installPromptDismissed', 'true');
    }
}

// ===== iPad Specific Optimizations =====
// Prevent double-tap zoom
let lastTouchEnd = 0;
document.addEventListener('touchend', (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
        event.preventDefault();
    }
    lastTouchEnd = now;
}, false);

// Prevent pinch zoom
document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
});

// Handle viewport height changes (for when keyboard appears)
function updateViewportHeight() {
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--vh', `${vh}px`);
}

window.addEventListener('resize', updateViewportHeight);
window.addEventListener('orientationchange', updateViewportHeight);
updateViewportHeight();
// ============================================
// SUPABASE AUTHENTICATION & PROGRESS TRACKING
// Add this entire section to the END of your app.js file
// ============================================

// ===== Authentication Functions =====

// Show login modal
function showLoginScreen() {
    document.getElementById('authModal').classList.add('active');
}

// Hide login modal  
function hideLoginScreen() {
    document.getElementById('authModal').classList.remove('active');
}

function clearAuthError() {
    const errorEl = document.getElementById('authError');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
}

// Switch between login/signup forms
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('showSignup')?.addEventListener('click', () => {
        document.getElementById('loginForm').classList.add('hidden');
        document.getElementById('signupForm').classList.remove('hidden');
        clearAuthError();
    });

    document.getElementById('showLogin')?.addEventListener('click', () => {
        document.getElementById('signupForm').classList.add('hidden');
        document.getElementById('loginForm').classList.remove('hidden');
        clearAuthError();
    });
    
    // Check auth on page load
    checkAuthOnLoad();
});

// Check if user is already logged in
function checkAuthOnLoad() {
    const user = localStorage.getItem('supabase_user');
    // AUTH MODAL DISABLED - Won't auto-show
    // Can be re-enabled later as enhancement
    // if (!user) {
    //     // Show login after welcome animation
    //     setTimeout(() => {
    //         showLoginScreen();
    //     }, 2000);
    // } else {
    //     // User is logged in, load their profile
    //     const userData = JSON.parse(user);
    //     loadUserProfile(userData.id);
    // }
}


// Sign In
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('loginBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        if (!email || !password) {
            showAuthError('Please enter email and password');
            return;
        }
        
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            if (data.user) {
                currentUser = data.user;
                await loadUserProfile();
                
                // Hide auth modal and show app
                document.getElementById('authModal').classList.remove('active');
                showCelebration(`Welcome back, ${currentProfile?.full_name || 'friend'}! 🎉`);
            }
        } catch (error) {
            console.error('Login error:', error);
            showAuthError('Invalid email or password');
        }
    });
});


// Save user profile to database
async function saveUserProfile(userId, name, age, email) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                id: userId,
                full_name: name,
                age: parseInt(age),
                email: email
            })
        });
        
        if (!response.ok) {
            console.error('Failed to save profile');
        }
    } catch (error) {
        console.error('Error saving profile:', error);
    }
}

// Get user profile from database
async function getUserProfile(userId) {
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`, {
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });
        
        const data = await response.json();
        return data[0] || null;
    } catch (error) {
        console.error('Error getting profile:', error);
        return null;
    }
}


// Get current user ID
async function getCurrentUserId() {
    const user = localStorage.getItem('supabase_user');
    if (user) {
        return JSON.parse(user).id;
    }
    return null;
}

// Get current auth token
function getAuthToken() {
    return localStorage.getItem('supabase_token') || SUPABASE_ANON_KEY;
}

// ===== Progress Tracking Functions =====
// saveProgress is defined earlier using supabaseClient - no duplicate needed here

// Load user's progress history
async function loadProgressHistory() {
    const userId = await getCurrentUserId();
    
    if (!userId) {
        return [];
    }
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/progress?user_id=eq.${userId}&order=created_at.desc&limit=50`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        
        return [];
    } catch (error) {
        console.error('Error loading progress:', error);
        return [];
    }
}

// Get activity statistics
async function getActivityStats(activity) {
    const userId = await getCurrentUserId();
    
    if (!userId) {
        return null;
    }
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/progress?user_id=eq.${userId}&activity=eq.${activity}&order=created_at.desc`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.length === 0) return null;
            
            const scores = data.map(d => d.score);
            const stars = data.reduce((sum, d) => sum + (d.stars_earned || 0), 0);
            
            return {
                timesPlayed: data.length,
                bestScore: Math.max(...scores),
                averageScore: scores.reduce((a, b) => a + b, 0) / scores.length,
                totalStars: stars,
                lastPlayed: data[0].created_at
            };
        }
        
        return null;
    } catch (error) {
        console.error('Error getting stats:', error);
        return null;
    }
}

// ===== Session Tracking =====

let currentSessionId = null;

// Start a new learning session
async function startSession() {
    const userId = await getCurrentUserId();
    
    if (!userId) return;
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${getAuthToken()}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                user_id: userId,
                started_at: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            currentSessionId = data[0]?.id;
            console.log('Session started:', currentSessionId);
        }
    } catch (error) {
        console.error('Error starting session:', error);
    }
}

// End the current session
async function endSession() {
    if (!currentSessionId) return;
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/sessions?id=eq.${currentSessionId}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({
                    ended_at: new Date().toISOString(),
                    total_stars: AppState.starsEarned
                })
            }
        );
        
        if (response.ok) {
            console.log('Session ended');
        }
    } catch (error) {
        console.error('Error ending session:', error);
    }
}

// Start session when app loads (if user is logged in)
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        const user = localStorage.getItem('supabase_user');
        if (user) {
            startSession();
        }
    }, 1000);
});

// End session when page unloads
window.addEventListener('beforeunload', () => {
    endSession();
});

// ===== Achievement System =====

// Check and award achievements
async function checkAchievements() {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    // Example achievements
    const progress = await loadProgressHistory();
    
    // Achievement: First Activity
    if (progress.length === 1) {
        await awardAchievement('first_activity', 'First Steps');
    }
    
    // Achievement: 10 Activities
    if (progress.length === 10) {
        await awardAchievement('ten_activities', '10 Activities Completed');
    }
    
    // Achievement: Master of Phonics (10 perfect phonics scores)
    const phonicsScores = progress.filter(p => p.activity === 'phonics' && p.score >= 5);
    if (phonicsScores.length >= 10) {
        await awardAchievement('phonics_master', 'Phonics Master');
    }
}

// Award an achievement
async function awardAchievement(type, name) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/achievements`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${getAuthToken()}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                user_id: userId,
                achievement_type: type,
                achievement_name: name,
                earned_at: new Date().toISOString()
            })
        });
        
        if (response.ok) {
            // Show celebration
            showCelebration(`🏆 Achievement Unlocked: ${name}! 🏆`);
        }
    } catch (error) {
        // Achievement might already exist (unique constraint)
        console.log('Achievement:', name);
    }
}

// ===== Logout Function =====

function logout() {
    localStorage.removeItem('supabase_user');
    localStorage.removeItem('supabase_token');
    currentSessionId = null;
    location.reload();
}

// Optional: Add logout button to settings
document.addEventListener('DOMContentLoaded', () => {
    // You can add a logout button in the settings modal if you want
    const settingsContent = document.querySelector('.modal-content');
    if (settingsContent) {
        const logoutBtn = document.createElement('button');
        logoutBtn.className = 'close-btn';
        logoutBtn.textContent = 'Logout';
        logoutBtn.style.marginTop = '20px';
        logoutBtn.style.background = '#FF6B9D';
        logoutBtn.addEventListener('click', logout);
        settingsContent.appendChild(logoutBtn);
    }
});

// ============================================
// END OF SUPABASE INTEGRATION
// ============================================
// Remember to update your activity functions to call saveProgress()!
// Example: saveProgress('phonics', AppState.phonicsScore);
// ============================================
// DAILY ACTIVITY TRACKER
// ============================================

const TrackerState = {
    currentWeekStart: null,
    currentReward: null,
    activities: [],
    completions: [],
    parentPin: '1234' // Change this!
};

// Initialize tracker
function initActivityTracker() {
    const today = new Date();
    TrackerState.currentWeekStart = getWeekStart(today);
    
    loadActivities();
    loadReward();
    renderCalendar();
    renderTodaysActivities();
}

// Get start of week (Sunday)
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
}

// Format date as YYYY-MM-DD
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Load activities from Supabase
async function loadActivities() {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/daily_activities?user_id=eq.${userId}&active=eq.true&order=created_at.desc`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            TrackerState.activities = await response.json();
            await loadCompletions();
            renderTodaysActivities();
        }
    } catch (error) {
        console.error('Error loading activities:', error);
    }
}

// Load completions
async function loadCompletions() {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    const today = formatDate(new Date());
    const weekAgo = formatDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/activity_completions?user_id=eq.${userId}&completed_date=gte.${weekAgo}`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            TrackerState.completions = await response.json();
            renderCalendar();
        }
    } catch (error) {
        console.error('Error loading completions:', error);
    }
}

// Load current reward
async function loadReward() {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rewards?user_id=eq.${userId}&claimed=eq.false&order=created_at.desc&limit=1`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            const rewards = await response.json();
            TrackerState.currentReward = rewards[0] || null;
            updateRewardProgress();
        }
    } catch (error) {
        console.error('Error loading reward:', error);
    }
}

// Render calendar
function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    if (!grid) return;
    
    grid.innerHTML = '';
    
    // Generate 7 days
    for (let i = 0; i < 7; i++) {
        const date = new Date(TrackerState.currentWeekStart);
        date.setDate(date.getDate() + i);
        
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        
        // Check if today
        const today = new Date();
        if (formatDate(date) === formatDate(today)) {
            dayEl.classList.add('today');
        }
        
        // Count completions for this day
        const dateStr = formatDate(date);
        const dayCompletions = TrackerState.completions.filter(
            c => c.completed_date === dateStr
        );
        
        if (dayCompletions.length > 0) {
            dayEl.classList.add('completed');
        }
        
        dayEl.innerHTML = `
            <div class="calendar-day-number">${date.getDate()}</div>
            <div class="calendar-day-dots">
                ${dayCompletions.slice(0, 3).map(() => '<div class="calendar-dot"></div>').join('')}
            </div>
        `;
        
        grid.appendChild(dayEl);
    }
    
    // Update week title
    const weekTitle = document.getElementById('weekTitle');
    if (weekTitle) {
        const endDate = new Date(TrackerState.currentWeekStart);
        endDate.setDate(endDate.getDate() + 6);
        
        const options = { month: 'short', day: 'numeric' };
        weekTitle.textContent = `${TrackerState.currentWeekStart.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }
}

// Render today's activities
function renderTodaysActivities() {
    const list = document.getElementById('activityList');
    if (!list) return;
    
    const today = formatDate(new Date());
    
    if (TrackerState.activities.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <p>No tasks yet! Ask a parent to create some.</p>
            </div>
        `;
        return;
    }
    
    list.innerHTML = '';
    
    TrackerState.activities.forEach(activity => {
        const isCompleted = TrackerState.completions.some(
            c => c.activity_id === activity.id && c.completed_date === today
        );
        
        const item = document.createElement('div');
        item.className = 'activity-item' + (isCompleted ? ' completed' : '');
        item.innerHTML = `
            <div class="activity-checkbox ${isCompleted ? 'checked' : ''}" data-activity-id="${activity.id}">
                ${isCompleted ? '✓' : ''}
            </div>
            <div class="activity-icon-display">${activity.icon}</div>
            <div class="activity-content">
                <h4>${activity.title}</h4>
                ${activity.description ? `<p>${activity.description}</p>` : ''}
            </div>
            <div class="activity-points">+${activity.points}</div>
        `;
        
        // Click handler
        const checkbox = item.querySelector('.activity-checkbox');
        checkbox.addEventListener('click', () => toggleActivity(activity.id, isCompleted));
        
        list.appendChild(item);
    });
}

// Toggle activity completion
async function toggleActivity(activityId, currentlyCompleted) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    playSound('click');
    
    if (currentlyCompleted) {
        // Uncomplete
        await uncompleteActivity(activityId);
    } else {
        // Complete
        await completeActivity(activityId);
        
        // Show celebration
        showActivityCelebration();
        
        // Update reward progress
        await updateRewardPointsAfterCompletion(activityId);
    }
    
    // Reload
    await loadCompletions();
    await loadReward();
    renderTodaysActivities();
}

// Complete activity
async function completeActivity(activityId) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/activity_completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${getAuthToken()}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                user_id: userId,
                activity_id: activityId,
                completed_date: formatDate(new Date())
            })
        });
        
        if (response.ok) {
            playSound('correct');
        }
    } catch (error) {
        console.error('Error completing activity:', error);
    }
}

// Uncomplete activity
async function uncompleteActivity(activityId) {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    const today = formatDate(new Date());
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/activity_completions?user_id=eq.${userId}&activity_id=eq.${activityId}&completed_date=eq.${today}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            playSound('click');
        }
    } catch (error) {
        console.error('Error uncompleting activity:', error);
    }
}

// Update reward progress
async function updateRewardPointsAfterCompletion(activityId) {
    if (!TrackerState.currentReward) return;
    
    const activity = TrackerState.activities.find(a => a.id === activityId);
    if (!activity) return;
    
    const newPoints = TrackerState.currentReward.current_points + activity.points;
    
    // Update reward
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rewards?id=eq.${TrackerState.currentReward.id}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({
                    current_points: newPoints
                })
            }
        );
        
        if (response.ok) {
            // Check if goal reached
            if (newPoints >= TrackerState.currentReward.points_required) {
                showGoalAchieved();
            }
        }
    } catch (error) {
        console.error('Error updating reward:', error);
    }
}

// Update reward progress display
function updateRewardProgress() {
    const card = document.getElementById('rewardProgressCard');
    const icon = document.getElementById('currentRewardIcon');
    const title = document.getElementById('currentRewardTitle');
    const bar = document.getElementById('rewardProgressBar');
    const text = document.getElementById('rewardProgressText');
    
    if (!TrackerState.currentReward) {
        if (card) card.style.display = 'none';
        return;
    }
    
    if (card) card.style.display = 'block';
    if (icon) icon.textContent = TrackerState.currentReward.icon;
    if (title) title.textContent = `Working towards: ${TrackerState.currentReward.title}`;
    
    const progress = Math.min(100, (TrackerState.currentReward.current_points / TrackerState.currentReward.points_required) * 100);
    
    if (bar) {
        bar.style.width = progress + '%';
        bar.textContent = progress >= 10 ? Math.round(progress) + '%' : '';
    }
    
    if (text) {
        text.textContent = `${TrackerState.currentReward.current_points} / ${TrackerState.currentReward.points_required} tasks complete`;
    }
}

// Show activity celebration
function showActivityCelebration() {
    updateSpeechBubble('Great job! Keep going! ⭐');
    buddyReact('happy');
}

// Show goal achieved
function showGoalAchieved() {
    showCelebration(`🏆 You earned: ${TrackerState.currentReward.title}! 🏆`);
    playSound('celebrate');
}

// Parent mode
let parentModeUnlocked = false;

function showParentMode() {
    document.getElementById('parentModeModal').classList.add('active');
}

function verifyParentPin() {
    const pin = document.getElementById('parentPin').value;
    
    if (pin === TrackerState.parentPin) {
        parentModeUnlocked = true;
        document.getElementById('pinEntry').style.display = 'none';
        document.getElementById('parentDashboard').classList.remove('hidden');
        loadParentDashboard();
    } else {
        showAuthError('Incorrect PIN');
        document.getElementById('parentPin').value = '';
    }
}

// Load parent dashboard
async function loadParentDashboard() {
    await loadActivities();
    await loadReward();
    renderActivitiesManager();
    renderRewardsManager();
}

// Render activities manager
function renderActivitiesManager() {
    const container = document.getElementById('activitiesManager');
    if (!container) return;
    
    if (TrackerState.activities.length === 0) {
        container.innerHTML = '<p>No activities yet. Create one!</p>';
        return;
    }
    
    container.innerHTML = '';
    
    TrackerState.activities.forEach(activity => {
        const item = document.createElement('div');
        item.className = 'manager-item';
        item.innerHTML = `
            <div class="manager-item-icon">${activity.icon}</div>
            <div class="manager-item-content">
                <h4>${activity.title}</h4>
                <p>${activity.points} points • ${activity.recurring ? 'Daily' : 'One-time'}</p>
            </div>
            <div class="manager-item-actions">
                <button class="action-icon-btn" onclick="deleteActivity('${activity.id}')">🗑️</button>
            </div>
        `;
        container.appendChild(item);
    });
}

// Create activity
async function createActivity() {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    const title = document.getElementById('activityTitle').value;
    const description = document.getElementById('activityDescription').value;
    const icon = document.getElementById('selectedIcon').value;
    const points = parseInt(document.getElementById('activityPoints').value);
    const recurring = document.getElementById('activityRecurring').checked;
    
    if (!title) {
        alert('Please enter a task name');
        return;
    }
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/daily_activities`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${getAuthToken()}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                user_id: userId,
                title,
                description,
                icon,
                points,
                recurring,
                active: true
            })
        });
        
        if (response.ok) {
            document.getElementById('createActivityModal').classList.remove('active');
            await loadParentDashboard();
            
            // Reset form
            document.getElementById('activityTitle').value = '';
            document.getElementById('activityDescription').value = '';
        }
    } catch (error) {
        console.error('Error creating activity:', error);
    }
}

// Delete activity
async function deleteActivity(activityId) {
    if (!confirm('Delete this activity?')) return;
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/daily_activities?id=eq.${activityId}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            await loadParentDashboard();
        }
    } catch (error) {
        console.error('Error deleting activity:', error);
    }
}

// Render rewards manager
function renderRewardsManager() {
    const container = document.getElementById('rewardsManager');
    if (!container) return;
    
    // Show current reward
    if (TrackerState.currentReward) {
        container.innerHTML = `
            <div class="manager-item">
                <div class="manager-item-icon">${TrackerState.currentReward.icon}</div>
                <div class="manager-item-content">
                    <h4>${TrackerState.currentReward.title}</h4>
                    <p>${TrackerState.currentReward.current_points} / ${TrackerState.currentReward.points_required} tasks</p>
                </div>
                <div class="manager-item-actions">
                    <button class="action-icon-btn" onclick="deleteReward('${TrackerState.currentReward.id}')">🗑️</button>
                </div>
            </div>
        `;
    } else {
        container.innerHTML = '<p>No active reward. Create one!</p>';
    }
}

// Create reward
async function createReward() {
    const userId = await getCurrentUserId();
    if (!userId) return;
    
    const title = document.getElementById('rewardTitle').value;
    const description = document.getElementById('rewardDescription').value;
    const icon = document.getElementById('selectedRewardIcon').value;
    const points = parseInt(document.getElementById('rewardPoints').value);
    
    if (!title) {
        alert('Please enter a reward name');
        return;
    }
    
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/rewards`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${getAuthToken()}`,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                user_id: userId,
                title,
                description,
                icon,
                points_required: points,
                current_points: 0,
                claimed: false
            })
        });
        
        if (response.ok) {
            document.getElementById('createRewardModal').classList.remove('active');
            await loadParentDashboard();
            
            // Reset form
            document.getElementById('rewardTitle').value = '';
            document.getElementById('rewardDescription').value = '';
        }
    } catch (error) {
        console.error('Error creating reward:', error);
    }
}

// Delete reward
async function deleteReward(rewardId) {
    if (!confirm('Delete this reward?')) return;
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/rewards?id=eq.${rewardId}`,
            {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${getAuthToken()}`
                }
            }
        );
        
        if (response.ok) {
            await loadParentDashboard();
            await loadReward();
            updateRewardProgress();
        }
    } catch (error) {
        console.error('Error deleting reward:', error);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    // Navigate to tracker
    document.querySelectorAll('[data-activity="tracker"]').forEach(btn => {
        btn.addEventListener('click', () => {
            switchScreen('activityTrackerScreen');
            initActivityTracker();
        });
    });
    
    // Back button
    document.getElementById('backFromTracker')?.addEventListener('click', () => {
        switchScreen('activityScreen');
    });
    
    // Parent mode button
    document.getElementById('parentModeBtn')?.addEventListener('click', showParentMode);
    
    // Verify PIN
    document.getElementById('verifyPin')?.addEventListener('click', verifyParentPin);
    
    // Close parent mode
    document.getElementById('closeParentMode')?.addEventListener('click', () => {
        document.getElementById('parentModeModal').classList.remove('active');
        parentModeUnlocked = false;
        document.getElementById('pinEntry').style.display = 'block';
        document.getElementById('parentDashboard').classList.add('hidden');
        document.getElementById('parentPin').value = '';
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            
            // Update buttons
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tab + 'Tab').classList.add('active');
        });
    });
    
    // Create activity button
    document.getElementById('createActivityBtn')?.addEventListener('click', () => {
        document.getElementById('createActivityModal').classList.add('active');
    });
    
    // Save activity
    document.getElementById('saveActivityBtn')?.addEventListener('click', createActivity);
    
    // Cancel activity
    document.getElementById('cancelActivityBtn')?.addEventListener('click', () => {
        document.getElementById('createActivityModal').classList.remove('active');
    });
    
    // Create reward button
    document.getElementById('createRewardBtn')?.addEventListener('click', () => {
        document.getElementById('createRewardModal').classList.add('active');
    });
    
    // Save reward
    document.getElementById('saveRewardBtn')?.addEventListener('click', createReward);
    
    // Cancel reward
    document.getElementById('cancelRewardBtn')?.addEventListener('click', () => {
        document.getElementById('createRewardModal').classList.remove('active');
    });
    
    // Icon pickers
    document.querySelectorAll('.icon-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const icon = btn.dataset.icon;
            const modalId = btn.closest('.modal').id;
            
            // Deselect all
            btn.parentElement.querySelectorAll('.icon-option').forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            
            // Set value
            if (modalId === 'createActivityModal') {
                document.getElementById('selectedIcon').value = icon;
            } else {
                document.getElementById('selectedRewardIcon').value = icon;
            }
        });
    });
    
    // Points sliders
    document.getElementById('activityPoints')?.addEventListener('input', (e) => {
        document.getElementById('pointsValue').textContent = e.target.value;
    });
    
    document.getElementById('rewardPoints')?.addEventListener('input', (e) => {
        document.getElementById('tasksRequiredValue').textContent = e.target.value;
    });
    
    // Week navigation
    document.getElementById('prevWeek')?.addEventListener('click', () => {
        const newStart = new Date(TrackerState.currentWeekStart);
        newStart.setDate(newStart.getDate() - 7);
        TrackerState.currentWeekStart = newStart;
        renderCalendar();
    });
    
    document.getElementById('nextWeek')?.addEventListener('click', () => {
        const newStart = new Date(TrackerState.currentWeekStart);
        newStart.setDate(newStart.getDate() + 7);
        TrackerState.currentWeekStart = newStart;
        renderCalendar();
    });
});

// ============================================
// AUTH MODAL CLOSE HANDLERS
// ============================================

// Close auth modal with close button
document.addEventListener('DOMContentLoaded', () => {
    const closeBtn = document.getElementById('closeAuthModal');
    const authModal = document.getElementById('authModal');
    
    if (closeBtn && authModal) {
        closeBtn.addEventListener('click', () => {
            authModal.classList.remove('active');
        });
    }
    
    // Close with ESC key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && authModal && authModal.classList.contains('active')) {
            authModal.classList.remove('active');
        }
    });
    
    // Close by clicking outside modal
    authModal?.addEventListener('click', (e) => {
        if (e.target === authModal) {
            authModal.classList.remove('active');
        }
    });
});

// ===== TREEHOUSE INTERACTIONS =====
document.addEventListener('DOMContentLoaded', () => {
    const buddyCenter = document.getElementById('buddyCenter');
    const buddySpeech = document.getElementById('buddySpeech');
    const activityBubbles = document.querySelectorAll('.activity-bubble');
    
    if (!buddyCenter || !buddySpeech) return;
    
    const buddyMessages = [
        "Welcome to my treehouse! 🏡",
        "Let's learn together! 🎉",
        "Pick something fun! 🌟",
        "I'm so happy you're here! 😊",
        "Learning is fun! 🎪"
    ];
    
    const activityMessages = {
        phonics: "Let's blend sounds! 📖",
        numbers: "Time to count! 🔢",
        letters: "Learn your ABCs! 🔤",
        shapes: "Find shapes! ⭐",
        colors: "Learn colors! 🎨",
        time: "Tell time! 🕐",
        logic: "Solve puzzles! 🧩",
        rhymes: "Make rhymes! 🎵",
        money: "Count coins! 💰",
        tracker: "Daily tasks! 📅"
    };
    
    let messageIndex = 0;
    
    // Buddy click interaction
    buddyCenter.addEventListener('click', () => {
        messageIndex = (messageIndex + 1) % buddyMessages.length;
        const speechText = buddySpeech.querySelector('.speech-text');
        if (speechText) speechText.textContent = buddyMessages[messageIndex];
        
        // Bounce animation
        buddyCenter.style.animation = 'none';
        setTimeout(() => {
            buddyCenter.style.animation = 'buddyFloat 3s ease-in-out infinite';
        }, 10);
    });
    
    // Activity bubble interactions
    activityBubbles.forEach(bubble => {
        bubble.addEventListener('mouseenter', function() {
            const activity = this.dataset.activity;
            const message = activityMessages[activity] || "Let's play! 🎮";
            const speechText = buddySpeech.querySelector('.speech-text');
            if (speechText) speechText.textContent = message;
        });
        
        bubble.addEventListener('mouseleave', () => {
            const speechText = buddySpeech.querySelector('.speech-text');
            if (speechText) speechText.textContent = buddyMessages[messageIndex];
        });
        
        bubble.addEventListener('click', function(e) {
            const activity = this.dataset.activity;
            
            // Trigger the existing activity switch logic
            switch(activity) {
                case 'phonics':
                    switchScreen('phonicsScreen');
                    generatePhonicsChallenge();
                    break;
                case 'letters':
                    switchScreen('lettersScreen');
                    updateLetterDisplay();
                    break;
                case 'numbers':
                    switchScreen('numbersScreen');
                    updateNumberDisplay();
                    break;
                case 'logic':
                    switchScreen('logicScreen');
                    generateLogicChallenge();
                    break;
                case 'shapes':
                    switchScreen('shapesScreen');
                    generateShapeChallenge();
                    break;
                case 'colors':
                    switchScreen('colorsScreen');
                    updateColorDisplay();
                    break;
                case 'money':
                    switchScreen('moneyScreen');
                    generateMoneyCounting();
                    break;
                case 'time':
                    switchScreen('timeScreen');
                    generateTimeChallenge();
                    break;
                case 'rhymes':
                    switchScreen('rhymesScreen');
                    generateRhymeChallenge();
                    break;
                case 'tracker':
                    switchScreen('activityTrackerScreen');
                    initActivityTracker();
                    break;
            }
        });
    });
});


// ===== Buddy3D Boot =====
document.addEventListener('DOMContentLoaded', () => {
    if (window.Buddy3D) {
        // Mount 3D Buddy into the center stage.
        window.Buddy3D.attach('buddy3d');
    }
});
