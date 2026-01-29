// DOM Elements
const passwordOutput = document.getElementById('passwordOutput');
const lengthRange = document.getElementById('lengthRange');
const lengthValue = document.getElementById('lengthValue');
const uppercaseEl = document.getElementById('uppercase');
const lowercaseEl = document.getElementById('lowercase');
const numbersEl = document.getElementById('numbers');
const symbolsEl = document.getElementById('symbols');
const generateBtn = document.getElementById('generateBtn');
const copyBtn = document.getElementById('copyBtn');
const copyFeedback = document.getElementById('copyFeedback');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');

// Character Sets
const UPPERCASE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LOWERCASE_CHARS = "abcdefghijklmnopqrstuvwxyz";
const NUMBER_CHARS = "0123456789";
const SYMBOL_CHARS = "!@#$%^&*()_+~`|}{[]:;?><,./-=";

// State
let db;

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    initDB();
    registerServiceWorker();

    // Set initial length display
    lengthValue.textContent = lengthRange.value;

    // Generate one on start
    setTimeout(generatePassword, 500);
});

// Event Listeners
lengthRange.addEventListener('input', (e) => {
    lengthValue.textContent = e.target.value;
});

generateBtn.addEventListener('click', () => {
    generatePassword();
});

copyBtn.addEventListener('click', () => {
    copyToClipboard(passwordOutput.value);
});

clearHistoryBtn.addEventListener('click', clearHistory);

// Password Generation Logic (Crypto API)
function generatePassword() {
    let chars = "";
    if (uppercaseEl.checked) chars += UPPERCASE_CHARS;
    if (lowercaseEl.checked) chars += LOWERCASE_CHARS;
    if (numbersEl.checked) chars += NUMBER_CHARS;
    if (symbolsEl.checked) chars += SYMBOL_CHARS;

    if (chars === "") {
        // Fallback or alert
        passwordOutput.value = "Select options";
        return;
    }

    const length = parseInt(lengthRange.value);
    let password = "";
    const randomValues = new Uint32Array(length);
    window.crypto.getRandomValues(randomValues);

    for (let i = 0; i < length; i++) {
        password += chars[randomValues[i] % chars.length];
    }

    passwordOutput.value = password;
    saveToHistory(password);

    // Haptic Feedback
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    // Visual Feedback (Shake)
    const card = document.querySelector('.display-card');
    card.classList.remove('shake-animation');
    void card.offsetWidth; // Trigger reflow
    card.classList.add('shake-animation');
}

// Clipboard API
async function copyToClipboard(text) {
    if (!text || text === "Select options") return;

    try {
        await navigator.clipboard.writeText(text);
        showCopyFeedback();
    } catch (err) {
        console.error('Failed to copy: ', err);
        // Fallback for some contexts
        passwordOutput.select();
        document.execCommand('copy');
        showCopyFeedback();
    }
}

function showCopyFeedback() {
    copyFeedback.classList.remove('hidden');
    setTimeout(() => {
        copyFeedback.classList.add('hidden');
    }, 2000);
}

// IndexedDB Logic
function initDB() {
    const request = indexedDB.open('PasswordGenDB', 1);

    request.onerror = (event) => {
        console.error("Database error: " + event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains('history')) {
            const objectStore = db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
            objectStore.createIndex('created', 'created', { unique: false });
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        loadHistory();
    };
}

function saveToHistory(password) {
    if (!db) return;

    const transaction = db.transaction(['history'], 'readwrite');
    const objectStore = transaction.objectStore('history');
    const request = objectStore.add({ password: password, created: Date.now() });

    request.onsuccess = () => {
        loadHistory();
    };
}

function loadHistory() {
    if (!db) return;

    const transaction = db.transaction(['history'], 'readonly');
    const objectStore = transaction.objectStore('history');
    const request = objectStore.getAll();

    request.onsuccess = (event) => {
        // Get last 10 entries, reversed
        const history = event.target.result;
        renderHistory(history.slice(-10).reverse());
    };
}

function clearHistory() {
    if (!db) return;

    const transaction = db.transaction(['history'], 'readwrite');
    const objectStore = transaction.objectStore('history');
    const request = objectStore.clear();

    request.onsuccess = () => {
        renderHistory([]);
    };
}

function renderHistory(items) {
    historyList.innerHTML = '';

    if (items.length === 0) {
        historyList.innerHTML = '<li class="empty-state">No history yet</li>';
        return;
    }

    items.forEach(item => {
        const li = document.createElement('li');
        li.className = 'history-item';

        const span = document.createElement('span');
        span.textContent = item.password;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-mini-btn';
        copyBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        copyBtn.addEventListener('click', () => {
            copyToClipboard(item.password);
        });

        li.appendChild(span);
        li.appendChild(copyBtn);
        historyList.appendChild(li);
    });
}

// Service Worker Registration
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful');
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
}

// PWA Install Prompt
let deferredPrompt;
const installBtn = document.getElementById('installBtn');

// Check if app is already installed (Standalone mode)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

// Show button if NOT installed
if (installBtn && !isStandalone) {
    installBtn.style.display = 'inline-block';
    installBtn.classList.remove('hidden');
}

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
});

if (installBtn) {
    installBtn.addEventListener('click', (e) => {
        if (deferredPrompt) {
            // Hide the button
            installBtn.style.display = 'none';
            // Show the prompt
            deferredPrompt.prompt();
            // Wait for the user to respond to the prompt
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('User accepted the A2HS prompt');
                } else {
                    console.log('User dismissed the A2HS prompt');
                    // Show button again if dismissed
                    installBtn.style.display = 'inline-block';
                }
                deferredPrompt = null;
            });
        } else {
            // Fallback for iOS or browsers blocking the prompt
            alert("To install this app:\n• iOS: Tap 'Share' button → 'Add to Home Screen'\n• Desktop: Click the ⊕ icon in the address bar");
        }
    });
}
