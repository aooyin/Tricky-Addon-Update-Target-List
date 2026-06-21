import { showPrompt } from './main.js';
import { setKeybox } from './menu_option.js';
import { getString, lang } from './language.js';

const KEYBOX_REPO_URL = 'https://keybox.kowx712.cc';

let overlay = null;
let loadingEl = null;
let iframe = null;
let isLoaded = false;
let handshakeInterval = undefined;

function createIframe() {
    const el = document.createElement('iframe');
    el.className = 'keybox-repo-iframe';
    el.setAttribute('width', '100%');
    el.setAttribute('height', '100%');
    el.setAttribute('frameborder', '0');
    el.setAttribute('allow', 'clipboard-read; clipboard-write');
    el.addEventListener('load', () => {
        startHandshake();
        hideLoading();
    });
    return el;
}

function startHandshake() {
    stopHandshake();
    iframe?.contentWindow?.postMessage({ type: 'handshake' }, KEYBOX_REPO_URL);
    handshakeInterval = window.setInterval(() => {
        iframe?.contentWindow?.postMessage({ type: 'handshake' }, KEYBOX_REPO_URL);
    }, 500);
}

function stopHandshake() {
    if (handshakeInterval !== undefined) {
        window.clearInterval(handshakeInterval);
        handshakeInterval = undefined;
    }
}

function showLoading() {
    if (loadingEl) loadingEl.style.display = '';
}

function hideLoading() {
    if (loadingEl) loadingEl.style.display = 'none';
}

function initOverlay() {
    const template = document.createElement('template');
    template.innerHTML = /* html */ `
        <div id="keybox-repo-overlay" class="keybox-repo-overlay hidden">
            <button id="keybox-repo-close" class="keybox-repo-close" aria-label="${getString('functional_button_close')}">
                <md-icon>close</md-icon>
            </button>
            <div id="keybox-repo-loading" class="keybox-repo-loading">
                <md-circular-progress indeterminate></md-circular-progress>
            </div>
        </div>
    `;

    const fragment = template.content;
    overlay = fragment.querySelector('#keybox-repo-overlay');
    loadingEl = fragment.querySelector('#keybox-repo-loading');
    iframe = createIframe();
    overlay.appendChild(iframe);

    fragment.querySelector('#keybox-repo-close')?.addEventListener('click', close);

    overlay.addEventListener('animationend', (e) => {
        if (e.animationName === 'keybox-repo-close') {
            overlay.classList.remove('closing');
            overlay.classList.add('hidden');
        }
    });

    window.addEventListener('message', onMessage);

    return fragment;
}

export function showKeyboxRepo() {
    if (!overlay || !iframe) return;
    overlay.classList.remove('closing');
    if (!overlay.classList.contains('hidden')) return;

    if (isLoaded) {
        stopHandshake();
        const newIframe = createIframe();
        overlay.replaceChild(newIframe, iframe);
        iframe = newIframe;
    } else {
        isLoaded = true;
    }

    showLoading();
    iframe.src = `${KEYBOX_REPO_URL}/${lang}`;
    overlay.classList.remove('hidden');

    history.pushState({ keyboxRepo: true }, '', '');
    window.addEventListener('popstate', handlePopState);
}

export function close() {
    if (overlay?.classList.contains('hidden') || overlay?.classList.contains('closing')) return;
    overlay?.classList.add('closing');
    stopHandshake();
}

function handlePopState() {
    close();
    window.removeEventListener('popstate', handlePopState);
}

function onMessage(event) {
    if (event.origin !== KEYBOX_REPO_URL) return;

    const msg = event.data;

    switch (msg.type) {
        case 'handshake_ack':
            stopHandshake();
            break;

        case 'download':
            close();
            fetchAndSetKeybox(msg.url).catch(() => {});
            break;

        case 'error':
            close();
            showPrompt(getString('prompt_keybox_repo_download_error', msg.identity), false);
            break;
    }
}

async function fetchAndSetKeybox(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            showPrompt(getString('prompt_keybox_repo_set_error'), false);
            return;
        }
        const content = await response.text();
        if (!content.trim()) {
            showPrompt(getString('prompt_keybox_repo_set_error'), false);
            return;
        }
        const result = await setKeybox(content.trim());
        showPrompt(getString(result ? 'prompt_keybox_repo_set' : 'prompt_keybox_repo_set_error'), result);
    } catch {
        showPrompt(getString('prompt_keybox_repo_set_error'), false);
    }
}

export function initKeyboxRepo() {
    document.body.appendChild(initOverlay());
    document.getElementById('keybox-repo').onclick = showKeyboxRepo;
}
