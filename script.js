/**
 * Ajanta Glass - Customer Requirement Portal (security-hardened build)
 *
 * What changed vs. the original:
 *  - No API keys or secrets in this file. AI chat goes through a server-side proxy (see supabase/functions/ajanta-ai).
 *  - No fake client-side "admin" and no public write access to catalog/reviews. Reviews are moderated server-side.
 *  - No inline event handlers (strict CSP). Events are dispatched through a fixed allow-list (ACTIONS).
 *  - All untrusted data is validated/length-limited and HTML-escaped before it reaches the DOM.
 *  - No personal data (leads, addresses) is kept in localStorage.
 */
'use strict';

const CFG = Object.freeze(Object.assign(
    { SUPABASE_URL: '', SUPABASE_KEY: '', AI_ENDPOINT: '', OWNER_ACCOUNT: '', KVDB_BASE: '', CATALOG_KEY: 'ajanta_products_catalog', REVIEWS_KEY: 'ajanta_client_reviews', WHATSAPP: '919215400355' },
    (typeof window !== 'undefined' && window.AJANTA_CONFIG) || {}
));

const LIMITS = Object.freeze({ name: 80, phone: 20, address: 300, note: 1000, label: 60, maxItems: 30, maxDim: 600, maxQty: 500 });
const FALLBACK_IMG = 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80';

// Array to store customer glass specification inputs
let clientSpecsList = [];
let fabricatorUser = CFG.OWNER_ACCOUNT;

/* ---------- small safe helpers ---------- */
function cleanText(v, max) {
    return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
function cleanMultiline(v, max) {
    return String(v == null ? '' : v).replace(/\r/g, '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
}
function clampNum(v, min, max) {
    const n = Number(v);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, Math.round(n * 100) / 100));
}
function clampInt(v, min, max) {
    const n = parseInt(v, 10);
    if (!Number.isFinite(n)) return min;
    return Math.min(max, Math.max(min, n));
}
function isValidPhone(p) {
    if (!/^\+?[0-9 ()\-]{8,18}$/.test(p)) return false;
    const digits = p.replace(/\D/g, '').length;
    return digits >= 8 && digits <= 15;
}
function safeImageUrl(u) {
    const v = String(u || '').trim();
    // images uploaded from the admin site are stored as base64 raster images (SVG is excluded on purpose: it can carry scripts)
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v) && v.length <= 3000000) return v;
    try {
        const x = new URL(v, window.location.href);
        if (x.protocol === 'https:' || x.origin === window.location.origin) return x.href;
    } catch (e) { /* fall through */ }
    return FALLBACK_IMG;
}
function escapeHtml(str) {
    if (str === null || str === undefined || str === '') return '';
    return String(str).replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#039;")
                      .replace(/`/g, "&#096;");
}
const _lastAction = {};
function tooSoon(key, ms) {
    const now = Date.now();
    if (_lastAction[key] && now - _lastAction[key] < ms) return true;
    _lastAction[key] = now;
    return false;
}
function honeypotTripped(form) {
    const hp = form && form.querySelector('[data-hp]');
    return !!(hp && hp.value);
}
async function postJson(url, body, headers, timeoutMs) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs || 15000);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: Object.assign({ 'Content-Type': 'application/json' }, headers || {}),
            body: JSON.stringify(body),
            signal: ctl.signal,
            credentials: 'omit',
            referrerPolicy: 'strict-origin-when-cross-origin'
        });
        let data = null;
        try { data = await res.json(); } catch (e) { /* non-JSON */ }
        return { ok: res.ok, status: res.status, data };
    } finally {
        clearTimeout(timer);
    }
}
function rpc(name, body) {
    if (!CFG.SUPABASE_URL || !CFG.SUPABASE_KEY) return Promise.resolve({ ok: false, status: 0, data: null });
    return postJson(CFG.SUPABASE_URL + '/rest/v1/rpc/' + name, body, { apikey: CFG.SUPABASE_KEY });
}

// Cross-platform email handler (Gmail compose on desktop, mailto on mobile) - opens safely with noopener
function openAjantaEmail(event) {
    if (event && event.preventDefault) event.preventDefault();
    const email = CFG.OWNER_ACCOUNT || 'ajnatafenestration@gmail.com';
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).catch(() => {});
    }
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
        window.location.href = 'mailto:' + encodeURIComponent(email).replace('%40', '@');
        return;
    }
    const a = document.createElement('a');
    a.href = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + encodeURIComponent(email);
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
}

// Optional "Locate Me": one reverse-geocode request to OpenStreetMap, only after the visitor confirms.
async function detectWebLocation() {
    const btn = document.getElementById('locateBtn');
    const icon = document.getElementById('locateIcon');
    const text = document.getElementById('locateText');
    const addressInput = document.getElementById('clientAddress');
    if (!navigator.geolocation) { alert("Geolocation is not supported by your browser."); return; }
    if (!window.confirm("Your device location will be sent once to OpenStreetMap (a third-party service) to fill in your address. Continue?")) return;

    const reset = () => {
        if (icon) icon.className = "fa-solid fa-location-arrow";
        if (text) text.textContent = "Locate Me";
        if (btn) btn.disabled = false;
    };
    if (btn) btn.disabled = true;
    if (icon) icon.className = "fa-solid fa-circle-notch animate-spin text-indigo-400";
    if (text) text.textContent = "Locating...";

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        let resolved = "";
        try {
            const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&lat=' +
                encodeURIComponent(lat.toFixed(5)) + '&lon=' + encodeURIComponent(lng.toFixed(5)),
                { headers: { 'Accept-Language': 'en' }, credentials: 'omit', referrerPolicy: 'no-referrer' });
            if (r.ok) {
                const data = await r.json();
                if (data && typeof data.display_name === 'string') {
                    resolved = cleanText(data.display_name.split(',').map(p => p.trim())
                        .filter(p => !/^(india|republic of india)$/i.test(p)).join(', '), LIMITS.address);
                }
            }
        } catch (err) { console.warn("Reverse geocoding unavailable"); }

        if (addressInput) {
            addressInput.value = resolved || ('Lat: ' + lat.toFixed(5) + ', Lng: ' + lng.toFixed(5));
        }
        if (icon) icon.className = "fa-solid fa-circle-check text-emerald-400";
        if (text) text.textContent = resolved ? "Detected!" : "Coordinates Set";
        setTimeout(reset, 3000);
    }, (error) => {
        let msg = "Could not retrieve your location. Please type your address instead.";
        if (error && error.code === error.PERMISSION_DENIED) msg = "Location permission was denied. Please type your address instead.";
        alert(msg);
        reset();
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 });
}

// Shop routing: ?user=<shop> is accepted only if it looks like a valid shop id. The server (RPC) must still verify it.
window.addEventListener('load', () => {
    const userParam = new URLSearchParams(window.location.search).get('user') || '';
    if (/^[A-Za-z0-9._@+\-]{3,80}$/.test(userParam.trim())) {
        fabricatorUser = userParam.trim();
    } else {
        fabricatorUser = CFG.OWNER_ACCOUNT;
    }
});

// Interactive Size Calculator Configurator Dropdown Handlers
function handleCategoryChange() {
    const select = document.getElementById('itemCategory');
    const customInput = document.getElementById('customCategoryContainer');
    if (!select) return;

    if (select.value === 'CUSTOM_ITEM') {
        if (customInput) customInput.classList.remove('hidden');
    } else {
        if (customInput) customInput.classList.add('hidden');
    }
}

function handleGlassProfileChange() {
    const select = document.getElementById('itemGlassProfile');
    const customInput = document.getElementById('customGlassContainer');
    const thicknessSelect = document.getElementById('itemThickness');
    if (!select) return;

    if (select.value === 'CUSTOM_GLASS') {
        if (customInput) customInput.classList.remove('hidden');
    } else {
        if (customInput) customInput.classList.add('hidden');
        
        // Auto-align thickness if glass profile indicates explicit thickness
        if (thicknessSelect) {
            const val = select.value;
            if (val.startsWith("5mm")) {
                thicknessSelect.value = "5mm Thickness";
            } else if (val.startsWith("8mm")) {
                thicknessSelect.value = "8mm Thickness";
            } else if (val.startsWith("10mm")) {
                thicknessSelect.value = "10mm Thickness";
            } else if (val.startsWith("12mm")) {
                thicknessSelect.value = "12mm Thickness";
            }
        }
    }
}

function handleThicknessChange() {
    const select = document.getElementById('itemThickness');
    const customInput = document.getElementById('customThicknessContainer');
    if (!select) return;

    if (select.value === 'CUSTOM_THICKNESS') {
        if (customInput) customInput.classList.remove('hidden');
    } else {
        if (customInput) customInput.classList.add('hidden');
    }
}

function addSpecLineItem() {
    if (clientSpecsList.length >= LIMITS.maxItems) {
        alert("You can add up to " + LIMITS.maxItems + " items per request. Please submit this one and send another for the rest.");
        return;
    }
    const catSelect = document.getElementById('itemCategory');
    let category = catSelect ? catSelect.value : 'Sliding Window';
    if (category === 'CUSTOM_ITEM') {
        category = document.getElementById('customCategoryInput')?.value || 'Custom Product';
    }
    const glassSelect = document.getElementById('itemGlassProfile');
    let glassProfile = glassSelect ? glassSelect.value : '5mm Clear Glass';
    if (glassProfile === 'CUSTOM_GLASS') {
        glassProfile = document.getElementById('customGlassInput')?.value || 'Custom Material';
    }
    const thicknessSelect = document.getElementById('itemThickness');
    let thickness = thicknessSelect ? thicknessSelect.value : 'Standard';
    if (thickness === 'CUSTOM_THICKNESS') {
        thickness = document.getElementById('customThicknessInput')?.value || 'Custom Thickness';
    }
    const edgeworkSelect = document.getElementById('itemEdgework');
    const edgework = edgeworkSelect ? edgeworkSelect.value : 'Standard bevel';

    const widthInput = document.getElementById('itemWidth');
    const heightInput = document.getElementById('itemHeight');
    const qtyInput = document.getElementById('itemQty');

    const rawW = parseFloat(widthInput?.value);
    const rawH = parseFloat(heightInput?.value);
    if (!(rawW > 0) || !(rawH > 0) || rawW > LIMITS.maxDim || rawH > LIMITS.maxDim) {
        alert("Please enter a width and height between 1 and " + LIMITS.maxDim + " inches.");
        return;
    }

    const itemSpec = {
        id: 'spec-' + Date.now() + '-' + Math.floor(Math.random() * 100000),
        name: cleanText(category, LIMITS.label) || 'Custom Product',
        glassProfile: cleanText(glassProfile, LIMITS.label),
        thickness: cleanText(thickness, LIMITS.label),
        edgework: cleanText(edgework, LIMITS.label),
        width: clampNum(rawW, 1, LIMITS.maxDim),
        height: clampNum(rawH, 1, LIMITS.maxDim),
        qty: clampInt(qtyInput?.value || 1, 1, LIMITS.maxQty),
        rate: 0.0
    };

    clientSpecsList.push(itemSpec);
    renderSpecLinesTable(itemSpec.id);

    if (widthInput) widthInput.value = '';
    if (heightInput) heightInput.value = '';
    if (qtyInput) qtyInput.value = '1';
}

function removeSpecLineItem(id) {
    const row = document.getElementById(`row-${id}`);
    if (row) {
        gsap.to(row, {
            opacity: 0,
            x: 35,
            scale: 0.95,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                clientSpecsList = clientSpecsList.filter(item => item.id !== id);
                renderSpecLinesTable();
            }
        });
    } else {
        clientSpecsList = clientSpecsList.filter(item => item.id !== id);
        renderSpecLinesTable();
    }
}

function renderSpecLinesTable(newItemId = null) {
    const container = document.getElementById('specItemsContainer');
    const tbody = document.getElementById('specItemsBody');
    const wasHidden = container.classList.contains('hidden');

    if (clientSpecsList.length === 0) {
        if (!wasHidden) {
            gsap.to(container, {
                opacity: 0,
                y: -15,
                duration: 0.35,
                onComplete: () => {
                    container.classList.add('hidden');
                }
            });
        } else {
            container.classList.add('hidden');
        }
        tbody.innerHTML = '';
    } else {
        if (wasHidden) {
            container.classList.remove('hidden');
            gsap.fromTo(container, {
                opacity: 0,
                y: -25
            }, {
                opacity: 1,
                y: 0,
                duration: 0.6,
                ease: "power3.out"
            });
        }

        tbody.innerHTML = '';
        clientSpecsList.forEach(item => {
            const rowId = `row-${item.id}`;
            const isNew = item.id === newItemId;

            const tr = document.createElement('tr');
            tr.id = rowId;
            tr.className = "border-b border-slate-800/60 hover:bg-slate-900/40 transition";

            if (isNew) {
                tr.style.opacity = "0";
                tr.style.transform = "translateX(-30px) scale(0.95)";
            }

            tr.innerHTML = `
                <td class="p-3 pl-4">
                    <div class="font-semibold text-white leading-tight">${escapeHtml(item.name)} <span class="text-indigo-300 font-normal text-xs">• ${escapeHtml(item.glassProfile || '')}</span></div>
                    <div class="text-[10px] text-slate-400 font-normal flex flex-wrap items-center gap-1.5 mt-1">
                        <span class="bg-slate-900/90 px-2 py-0.5 rounded-md text-cyan-300 border border-slate-800 font-mono inline-flex items-center gap-1">
                            <i class="fa-solid fa-layer-group text-[8px]"></i>${escapeHtml(item.thickness || 'Standard')}
                        </span>
                        <span class="bg-slate-900/90 px-2 py-0.5 rounded-md text-indigo-300 border border-slate-800 font-mono inline-flex items-center gap-1">
                            <i class="fa-solid fa-gem text-[8px]"></i>${escapeHtml(item.edgework || 'None')}
                        </span>
                    </div>
                </td>
                <td class="p-3 text-center font-mono text-cyan-300 font-semibold">${Number(item.width)}"</td>
                <td class="p-3 text-center font-mono text-cyan-300 font-semibold">${Number(item.height)}"</td>
                <td class="p-3 text-center font-bold text-white">${Number(item.qty)}</td>
                <td class="p-3 text-center">
                    <button type="button" data-click="removeSpecLineItem" data-args='["${escapeHtml(item.id)}"]' class="text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/20 p-1.5 rounded-lg transition interactive-hover-btn cursor-pointer" title="Remove item">
                        <i class="fa fa-trash-can text-xs"></i>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);

            if (isNew) {
                gsap.to(tr, {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    duration: 0.6,
                    ease: "power4.out",
                    clearProps: "transform"
                });

                gsap.fromTo(tr, {
                    backgroundColor: "rgba(99, 102, 241, 0.25)"
                }, {
                    backgroundColor: "rgba(0, 0, 0, 0)",
                    duration: 1.2,
                    ease: "power2.out"
                });
            }
        });
    }
}

function openOrderModal() {
    const modal = document.getElementById('orderPlacementModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const nameInput = document.getElementById('clientName');
    if (nameInput) nameInput.focus();
}

function closeOrderModal() {
    const modal = document.getElementById('orderPlacementModal');
    if (modal) modal.classList.add('hidden');
}


const ORDER_ERRORS = {
    bad_input: 'Please enter your name and a valid mobile number.',
    too_long: 'Some details are too long. Please shorten them and try again.',
    bad_items: 'Please add at least one item to your order and try again.',
    unknown_shop: 'This order link is not active. Please contact the shop on WhatsApp or phone.',
    busy: 'Too many orders were received just now. Please try again in a little while.'
};

function sanitizedSpecs() {
    return clientSpecsList.slice(0, LIMITS.maxItems).map(i => ({
        id: cleanText(i.id, 40),
        name: cleanText(i.name, LIMITS.label),
        glassProfile: cleanText(i.glassProfile, LIMITS.label),
        thickness: cleanText(i.thickness, LIMITS.label),
        edgework: cleanText(i.edgework, LIMITS.label),
        width: clampNum(i.width, 1, LIMITS.maxDim),
        height: clampNum(i.height, 1, LIMITS.maxDim),
        qty: clampInt(i.qty, 1, LIMITS.maxQty),
        rate: 0
    }));
}

function showSuccess(title, message) {
    const modal = document.getElementById('successModal');
    if (!modal) return;
    const h = modal.querySelector('h3'); if (h) h.textContent = title;
    const p = modal.querySelector('p'); if (p) p.textContent = message;
    modal.classList.remove('hidden');
}

async function submitForm(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = document.getElementById('requirementsForm');
    const btn = document.getElementById('submitBtn');

    // Bots fill the hidden field: pretend success, send nothing.
    if (honeypotTripped(form)) { closeOrderModal(); showSuccess("Order Inquiry Submitted!", "Thank you!"); return; }

    const name = cleanText(document.getElementById('clientName').value, LIMITS.name);
    const phone = cleanText(document.getElementById('clientPhone').value, LIMITS.phone);
    const address = cleanText(document.getElementById('clientAddress').value, LIMITS.address);
    const note = cleanMultiline(document.getElementById('clientRequirements').value, LIMITS.note) || "Custom glass architecture specifications";
    const items = sanitizedSpecs();

    if (name.length < 2 || !isValidPhone(phone)) { alert(ORDER_ERRORS.bad_input); return; }
    if (items.length === 0) { alert(ORDER_ERRORS.bad_items); return; }
    if (tooSoon('lead', 30000)) { alert("Please wait a few seconds before sending another request."); return; }

    if (btn) { btn.disabled = true; btn.textContent = 'Submitting Order...'; }
    try {
        const res = await rpc('site_submit_lead', {
            p_user: fabricatorUser || CFG.OWNER_ACCOUNT,
            p_name: name,
            p_phone: phone,
            p_address: address,
            p_requirements: note,
            p_items: items
        });
        const result = res.data;
        if (res.ok && result && result.status === 'ok') {
            closeOrderModal();
            form.reset();
            clientSpecsList = [];
            renderSpecLinesTable();
            showSuccess("Order Inquiry Submitted!", "Thank you! Your specifications have been forwarded to our team. We will review the dimensions and connect via WhatsApp/Phone shortly.");
        } else if (result && Object.prototype.hasOwnProperty.call(ORDER_ERRORS, result.status)) {
            alert(ORDER_ERRORS[result.status]);
        } else {
            alert("Unable to send your request right now. Please check your internet connection, or contact us on WhatsApp.");
        }
    } catch (err) {
        console.warn("Order submit failed");
        alert("Unable to send your request right now. Please check your internet connection, or contact us on WhatsApp.");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa fa-paper-plane"></i> <span>Confirm &amp; Place Order</span>'; }
    }
}

async function submitSupportForm(event) {
    if (event && event.preventDefault) event.preventDefault();
    const form = document.getElementById('supportForm');
    if (honeypotTripped(form)) { showSuccess("Ticket Registered", "Thank you!"); return; }

    const name = cleanText(document.getElementById('supportName')?.value, LIMITS.name);
    const phone = cleanText(document.getElementById('supportPhone')?.value, LIMITS.phone);
    const category = cleanText(document.getElementById('supportCategory')?.value, LIMITS.label);
    const message = cleanMultiline(document.getElementById('supportMessage')?.value, 1500);

    if (name.length < 2 || !isValidPhone(phone) || message.length < 5) { alert("Please enter your name, a valid mobile number and a short message."); return; }
    if (tooSoon('support', 30000)) { alert("Please wait a few seconds before sending another message."); return; }

    try {
        const res = await rpc('site_submit_support', {
            p_user: fabricatorUser || CFG.OWNER_ACCOUNT,
            p_name: name, p_phone: phone, p_category: category, p_message: message
        });
        if (res.ok && res.data && res.data.status === 'ok') {
            form.reset();
            showSuccess("Ticket Registered", "Thank you! Your message has reached our team and we will contact you shortly.");
        } else if (res.data && res.data.status === 'busy') {
            alert(ORDER_ERRORS.busy);
        } else {
            supportViaWhatsApp(name, phone, category, message);
        }
    } catch (err) {
        supportViaWhatsApp(name, phone, category, message);
    }
}

function supportViaWhatsApp(name, phone, category, message) {
    const text = 'Support request (' + category + ')\nName: ' + name + '\nPhone: ' + phone + '\n' + message;
    const a = document.createElement('a');
    a.href = 'https://wa.me/' + CFG.WHATSAPP + '?text=' + encodeURIComponent(text.slice(0, 1500));
    a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.add('hidden');
}

/* ==========================================================================
   AJANTA AI GLASS & WINDOW CONSULTANT (server-side proxy; no keys in the browser)
   ========================================================================== */
let aiSpeechRecognizer = null;
let isAiVoiceListening = false;
let aiMessageCount = 0;

function toggleAiChatDrawer() {
    const drawer = document.getElementById('aiChatDrawer');
    if (!drawer) return;
    if (drawer.classList.contains('hidden')) {
        drawer.classList.remove('hidden');
        setTimeout(() => drawer.classList.remove('translate-x-full'), 10);
        const chatInput = document.getElementById('aiChatInput');
        if (chatInput) chatInput.focus();
    } else {
        drawer.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

function sendQuickAiQuery(queryText) {
    const input = document.getElementById('aiChatInput');
    if (input) input.value = queryText;
    sendAiMessage(queryText);
}

function handleAiFormSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('aiChatInput');
    if (!input) return;
    const promptText = input.value.trim();
    if (!promptText) return;
    sendAiMessage(promptText);
}

async function sendAiMessage(promptText) {
    const chatContainer = document.getElementById('aiChatMessages');
    const input = document.getElementById('aiChatInput');
    if (!chatContainer) return;
    promptText = cleanText(promptText, 500);
    if (!promptText) return;
    if (aiMessageCount >= 30) { alert("Chat limit reached for this visit. Please contact us on WhatsApp for more help."); return; }
    if (tooSoon('ai', 2500)) return;
    aiMessageCount++;

    if (input) input.value = '';

    // Append User Message
    const userMsgHtml = `
        <div class="flex gap-2.5 justify-end">
            <div class="max-w-[85%] bg-gradient-to-r from-indigo-600 to-cyan-700 text-white p-3 rounded-2xl rounded-tr-none text-xs leading-relaxed shadow-md">
                ${escapeHtml(promptText)}
            </div>
            <div class="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center shrink-0 text-indigo-300 text-xs">
                <i class="fa-solid fa-user"></i>
            </div>
        </div>
    `;
    chatContainer.insertAdjacentHTML('beforeend', userMsgHtml);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Show typing indicator
    const typingIndicator = document.getElementById('aiTypingIndicator');
    if (typingIndicator) typingIndicator.classList.remove('hidden');

    try {
        const responseText = await fetchGeminiResponse(promptText);
        
        // Hide typing
        if (typingIndicator) typingIndicator.classList.add('hidden');

        // Append AI Message
        const aiMsgHtml = `
            <div class="flex gap-3">
                <div class="w-8 h-8 rounded-xl bg-[#00B8D9]/10 border border-[#00B8D9]/30 flex items-center justify-center shrink-0 text-[#00B8D9] mt-0.5">
                    <i class="fa-solid fa-wand-magic-sparkles text-xs"></i>
                </div>
                <div class="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-slate-200 leading-relaxed space-y-2">
                    ${formatAiMarkdown(responseText)}
                    <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                        <span class="text-cyan-400 font-medium">Ajanta AI Assistant</span>
                        <button data-click="scrollToConfiguratorFromAi" class="text-xs text-[#00B8D9] hover:underline font-bold flex items-center gap-1 cursor-pointer">
                            <span>Use Configurator</span> <i class="fa-solid fa-calculator text-[10px]"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
        chatContainer.insertAdjacentHTML('beforeend', aiMsgHtml);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (err) {
        if (typingIndicator) typingIndicator.classList.add('hidden');
        console.error("AI Error:", err);
        const errorHtml = `
            <div class="flex gap-3">
                <div class="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5">
                    <i class="fa-solid fa-triangle-exclamation text-xs"></i>
                </div>
                <div class="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-slate-300 leading-relaxed">
                    <p>Sorry, I encountered a temporary network issue. Please try asking again or check your internet connection.</p>
                </div>
            </div>
        `;
        chatContainer.insertAdjacentHTML('beforeend', errorHtml);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

async function fetchGeminiResponse(promptText) {
    const prompt = cleanText(promptText, 500);
    if (CFG.AI_ENDPOINT) {
        try {
            const res = await postJson(CFG.AI_ENDPOINT, { prompt }, CFG.SUPABASE_KEY ? { apikey: CFG.SUPABASE_KEY } : {}, 20000);
            const text = res.ok && res.data && typeof res.data.text === 'string' ? res.data.text.slice(0, 4000) : '';
            if (text) return text;
        } catch (e) { console.warn("AI service unavailable, using built-in answers"); }
    }
    return getGlazingIntelligenceFallback(prompt);
}

function formatAiMarkdown(text) {
    if (!text) return '';
    let formatted = escapeHtml(text);
    // Bold: **text**
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
    // Bullet points: * item or - item
    formatted = formatted.replace(/^\s*[\*\-]\s+(.*)$/gm, '<li class="ml-4 list-disc text-slate-300">$1</li>');
    // Wrap consecutive <li> into <ul>
    formatted = formatted.replace(/(<li.*<\/li>\n?)+/g, '<ul class="space-y-1 my-1.5">$&</ul>');
    // Newlines to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function getGlazingIntelligenceFallback(prompt) {
    const query = prompt.toLowerCase().trim();

    if (query.includes('who are you') || query.includes('who is this') || query.includes('what is your name') || query.includes('who created you') || query === 'who are u' || query === 'who u' || query.includes('tum kaun ho') || query.includes('aap kaun ho') || query.includes('kaun ho')) {
        return "I am **Ajanta AI** — your friendly Architectural Glass & Window Systems consultant from Ajanta Door & Window Systems (Est. 1976, Sirsa, Haryana). How can I assist you with your project today?";
    }

    if (query === 'hi' || query === 'hello' || query === 'hey' || query.includes('namaste') || query.includes('kaise ho') || query.includes('kaisa hai')) {
        return "Hello! I am **Ajanta AI**. Welcome to Ajanta Door & Window Systems! 👋\n\nHow can I help you today? You can ask me about glass thickness recommendations, soundproofing (DGU glass), UPVC/aluminum window profiles, shower partitions, or pricing!";
    }

    if (query.includes('toughened') && query.includes('laminated')) {
        return "**Toughened Glass vs Laminated Glass Comparison:**\n\n" +
               "• **Toughened (Tempered) Glass:** 4x-5x stronger than regular annealed glass. If shattered, breaks into small harmless blunt fragments. Ideal for shower cubicles, glass doors, interior partition walls, and standard windows.\n\n" +
               "• **Laminated Glass:** Consists of 2 glass sheets bonded with a tough PVB/SGP interlayer. If shattered, glass adheres to the interlayer without falling. Mandatory for high-rise balcony railings, glass staircases, skylights, and high-security facades.\n\n" +
               "💡 **Recommendation:** For shower enclosures & standard windows, use 8mm–12mm Toughened Glass. For glass railings & overhead skylights, use 12mm (6mm+6mm) Laminated Glass!";
    }

    if (query.includes('sound') || query.includes('noise') || query.includes('acoustic')) {
        return "**Acoustic Soundproofing Glass Guidance:**\n\n" +
               "To block heavy city traffic and ambient noise (up to 38-42 dB sound reduction):\n\n" +
               "1. **DGU (Double Glazed Unit / Insulated Glass):** 6mm Toughened + 12mm Air/Argon Gap + 6mm Toughened glass unit. Provides exceptional sound isolation and thermal insulation.\n" +
               "2. **Acoustic Laminated Glass:** Uses specialized acoustic PVB interlayers.\n" +
               "3. **Acoustic UPVC/Aluminum Profiles:** Ensure multi-point locking mechanisms and EPDM rubber seals for maximum airtight closure.\n\n" +
               "💡 **Pro Tip:** Use DGU glass in Ajanta UPVC or Slimline Aluminum Casement Windows for maximum tranquility!";
    }

    if (query.includes('shower') || query.includes('cubicle') || query.includes('bathroom')) {
        return "**Shower Cubicle & Partition Glass Specifications:**\n\n" +
               "• **Recommended Thickness:** 8mm or 10mm Toughened Safety Glass.\n" +
               "• **Glass Options:** Ultra-Clear Low-Iron Glass, Frosted / Acid Etched for privacy, or Tinted (Grey/Bronze).\n" +
               "• **Edge Finish:** Flat polish with safety chamfered corners.\n" +
               "• **Hardware:** SS304 Stainless Steel rust-proof hinges, glass-to-wall brackets, and magnetic PVC seal gaskets.\n\n" +
               "💡 **Ajanta Guarantee:** All shower panels feature 100% heat-soak tested toughened safety glass with hydrophobic easy-clean coating!";
    }

    if (query.includes('window') || query.includes('upvc') || query.includes('aluminum') || query.includes('sliding')) {
        return "**Window System & Frame Selection Guide:**\n\n" +
               "• **Slimline Aluminum Windows:** Modern ultra-thin sightlines, high structural strength for large floor-to-ceiling sliding glass panels (up to 12ft height).\n" +
               "• **UPVC Windows:** Superior thermal insulation, zero rust/corrosion, multi-chamber design for extreme noise block.\n" +
               "• **Glass Pairing:** 6mm Toughened for small/medium windows; 10mm–12mm Toughened or DGU for large span balcony windows.";
    }

    if (query.includes('railing') || query.includes('balcony') || query.includes('stair')) {
        return "**Balcony & Staircase Glass Railing Recommendations:**\n\n" +
               "• **Standard Balconies:** 12mm Toughened Glass with SS304 spigots or continuous bottom aluminum profile channel.\n" +
               "• **High-Rise & Commercial Railings:** 13.52mm Laminated Glass (6mm Toughened + 1.52mm PVB + 6mm Toughened).\n" +
               "• **Safety Standard:** Handrail or top profile channel recommended for structural wind loads above 10th floor.\n\n" +
               "💡 Contact Ajanta for custom structural glass railing engineering & load tests!";
    }

    if (query.includes('price') || query.includes('cost') || query.includes('rate') || query.includes('estimate') || query.includes('sqft')) {
        return "**Ajanta Glass & Glazing Custom Specification Guidelines:**\n\n" +
               "Glass rates depend on thickness, glass type, and customized edgework/processing:\n" +
               "• **5mm - 6mm Clear Glass:** Base architectural glazing\n" +
               "• **8mm - 12mm Toughened Glass:** Premium heavy-duty safety glass\n" +
               "• **DGU / Insulated Units:** Double pane thermal/acoustic glass\n" +
               "• **Custom Finishes:** Beveling, frost etching, UV printing, CNC cutouts & hole drilling.\n\n" +
               "💡 **Get an Instant Quote:** Use the **Ajanta Live Quote Configurator** on this page to enter your dimensions and get instant exact itemized calculations!";
    }

    return `**Ajanta Architectural Glass & Window Systems Advice:**\n\n` +
           `Regarding **"${escapeHtml(prompt)}"**:\n\n` +
           `• **Glass Selection:** We supply 5mm to 19mm Toughened Safety Glass, DGU Double Glazed Units, Laminated Safety Glass, and Frosted/Tinted decorative options.\n` +
           `• **Window Profiles:** High-grade UPVC and Slimline Italian Aluminum profiles with multi-point locking hardware.\n` +
           `• **Custom Processing:** CNC shape cutting, hole drilling, cutout processing, UV glass printing, and sandblasting.\n\n` +
           `Please let me know if you need specific details on glass thickness, soundproofing, or window profiles!`;
}

function toggleAiVoiceInput() {
    const micBtn = document.getElementById('aiMicBtn');
    const input = document.getElementById('aiChatInput');
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        alert("Voice recognition is not supported in this browser. Please type your query.");
        return;
    }

    if (isAiVoiceListening && aiSpeechRecognizer) {
        aiSpeechRecognizer.stop();
        isAiVoiceListening = false;
        if (micBtn) micBtn.innerHTML = `<i class="fa-solid fa-microphone text-sm"></i>`;
        return;
    }

    aiSpeechRecognizer = new SpeechRecognition();
    aiSpeechRecognizer.continuous = false;
    aiSpeechRecognizer.interimResults = false;
    aiSpeechRecognizer.lang = 'en-US';

    aiSpeechRecognizer.onstart = function() {
        isAiVoiceListening = true;
        if (micBtn) micBtn.innerHTML = `<i class="fa-solid fa-microphone text-sm text-red-500 animate-ping"></i>`;
        if (input) input.placeholder = "Listening... Speak now...";
    };

    aiSpeechRecognizer.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        if (input) {
            input.value = transcript;
            sendAiMessage(transcript);
        }
    };

    aiSpeechRecognizer.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
        isAiVoiceListening = false;
        if (micBtn) micBtn.innerHTML = `<i class="fa-solid fa-microphone text-sm"></i>`;
        if (input) input.placeholder = "Ask Ajanta AI about glass & windows...";
    };

    aiSpeechRecognizer.onend = function() {
        isAiVoiceListening = false;
        if (micBtn) micBtn.innerHTML = `<i class="fa-solid fa-microphone text-sm"></i>`;
        if (input) input.placeholder = "Ask Ajanta AI about glass & windows...";
    };

    aiSpeechRecognizer.start();
}

function clearAiChatHistory() {
    const chatContainer = document.getElementById('aiChatMessages');
    if (!chatContainer) return;
    chatContainer.innerHTML = `
        <div class="flex gap-3">
            <div class="w-8 h-8 rounded-xl bg-[#00B8D9]/10 border border-[#00B8D9]/30 flex items-center justify-center shrink-0 text-[#00B8D9] mt-0.5">
                <i class="fa-solid fa-wand-magic-sparkles text-xs"></i>
            </div>
            <div class="flex-1 bg-slate-900/80 border border-slate-800 rounded-2xl rounded-tl-none p-3.5 text-slate-200 leading-relaxed space-y-2">
                <p class="font-bold text-white text-xs">Chat History Cleared ✨</p>
                <p>How else can Ajanta AI assist you with your architectural glass and window project today?</p>
            </div>
        </div>
    `;
}

function scrollToConfiguratorFromAi() {
    const drawer = document.getElementById('aiChatDrawer');
    if (drawer && window.innerWidth < 640) {
        toggleAiChatDrawer();
    }
    const configurator = document.getElementById('configurator');
    if (configurator) {
        configurator.scrollIntoView({ behavior: 'smooth' });
    }
}


/* ==========================================================================
   CLIENT REVIEWS (moderated server-side: visitors can only SUBMIT; only approved reviews are shown)
   ========================================================================== */
let approvedReviews = [];
let cloudReviews = [];

function sanitizeReview(r) {
    if (!r || typeof r !== 'object') return null;
    const name = cleanText(r.name, 60), text = cleanText(r.text, 600);
    if (!name || !text) return null;
    return { name, role: cleanText(r.role, 60), city: cleanText(r.city || 'India', 40), rating: clampInt(r.rating, 1, 5), text };
}

async function loadApprovedReviews() {
    let fromDb = [];
    try {
        const res = await rpc('site_list_reviews', {});
        if (res.ok && Array.isArray(res.data)) fromDb = res.data.slice(0, 50).map(sanitizeReview).filter(Boolean);
    } catch (e) { console.warn("Reviews (database) unavailable"); }
    try {
        if (CFG.KVDB_BASE) {
            const r = await fetch(CFG.KVDB_BASE + '/' + encodeURIComponent(CFG.REVIEWS_KEY), { credentials: 'omit', referrerPolicy: 'no-referrer' });
            const raw = r.ok ? await r.json().catch(() => null) : null;
            if (Array.isArray(raw)) cloudReviews = raw.slice(0, 100).map(sanitizeReview).filter(Boolean);
        }
    } catch (e) { console.warn("Reviews (cloud list) unavailable"); }
    approvedReviews = fromDb.concat(cloudReviews).slice(0, 100);
    renderReviews();
}

function renderReviews() {
    const marqueeContainer = document.getElementById("marqueeList");
    const reviewsGrid = document.getElementById("reviewsGrid");
    const reviews = approvedReviews;

    if (marqueeContainer) {
        if (reviews.length === 0) {
            const inviteCard = `
                <div class="glass-panel p-5 rounded-2xl border border-cyan-500/30 w-80 sm:w-96 shrink-0 flex flex-col justify-between space-y-3 bg-slate-900/80 shadow-xl cursor-pointer hover:scale-[1.02] transition" onclick="openReviewModal()">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1 text-amber-400 text-xs">
                            <i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i><i class="fa-solid fa-star"></i>
                        </div>
                        <span class="text-[9px] font-extrabold uppercase tracking-widest text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <i class="fa-solid fa-pen-nib text-[8px]"></i> Write Review
                        </span>
                    </div>
                    <p class="text-xs text-slate-200 italic leading-relaxed">"Be the first verified client to leave a live review for Ajanta Door & Window System!"</p>
                    <div class="flex items-center gap-3 pt-2 border-t border-slate-800/80">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            +
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold text-white">Share Your Feedback</div>
                            <div class="text-[10px] text-cyan-400">Click here to write a live review</div>
                        </div>
                    </div>
                </div>
            `;
            marqueeContainer.innerHTML = Array(6).fill(inviteCard).join("");
        } else {
            let displayList = [...reviews];
            while (displayList.length < 8) {
                displayList = displayList.concat(reviews);
            }
            displayList = displayList.concat(displayList);

            marqueeContainer.innerHTML = displayList.map((r, i) => `
                <div class="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-cyan-500/40 transition duration-300 w-80 sm:w-96 shrink-0 flex flex-col justify-between space-y-3 bg-slate-900/80 shadow-xl">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1 text-amber-400 text-xs">
                            ${'<i class="fa-solid fa-star"></i>'.repeat(clampInt(r.rating, 1, 5))}
                        </div>
                        <span class="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <i class="fa-solid fa-circle-check text-[8px]"></i> Verified Client
                        </span>
                    </div>
                    <p class="text-xs text-slate-300 italic leading-relaxed line-clamp-3">"${escapeHtml(r.text)}"</p>
                    <div class="flex items-center gap-3 pt-2 border-t border-slate-800/80">
                        <div class="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                            ${escapeHtml(r.name ? r.name.charAt(0).toUpperCase() : "A")}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="text-xs font-bold text-white truncate">${escapeHtml(r.name)}</div>
                            <div class="text-[10px] text-slate-400 truncate">${escapeHtml(r.role)} • ${escapeHtml(r.city || "India")}</div>
                        </div>
                    </div>
                </div>
            `).join("");
        }
    }

    const statReviews = document.getElementById("statTotalReviews");
    if (statReviews) statReviews.textContent = reviews.length;
}

function openReviewModal() {
    const modal = document.getElementById("reviewModal");
    if (modal) modal.classList.remove("hidden");
}

function closeReviewModal() {
    const modal = document.getElementById("reviewModal");
    if (modal) modal.classList.add("hidden");
}

async function submitReview(e) {
    if (e && e.preventDefault) e.preventDefault();
    const form = document.getElementById('reviewForm');
    if (honeypotTripped(form)) { closeReviewModal(); return; }

    const name = cleanText(document.getElementById("reviewAuthor")?.value, 60);
    const role = cleanText(document.getElementById("reviewRole")?.value, 60);
    const rating = clampInt(document.getElementById("reviewRating")?.value || 5, 1, 5);
    const text = cleanMultiline(document.getElementById("reviewText")?.value, 600);

    if (name.length < 2 || text.length < 10) { alert("Please enter your name and a short review (at least 10 characters)."); return; }
    if (tooSoon('review', 60000)) { alert("Please wait a minute before sending another review."); return; }

    try {
        const res = await rpc('site_submit_review', { p_name: name, p_role: role, p_rating: rating, p_text: text });
        if (res.ok && res.data && res.data.status === 'ok') {
            form.reset();
            closeReviewModal();
            alert("Thank you! Your review has been submitted.");
            loadApprovedReviews();
        } else {
            alert("Sorry, we could not save your review right now. Please try again later.");
        }
    } catch (err) {
        alert("Sorry, we could not save your review right now. Please try again later.");
    }
}

/* ==========================================================================
   CONFIGURATOR WIZARD & PORTAL TAB SYSTEM
   ========================================================================== */
function setWizardStep(stepNum) {
    const steps = [1, 2, 3];
    steps.forEach(s => {
        const stepEl = document.getElementById("wizard-step-" + s);
        const indEl = document.getElementById("wizard-indicator-" + s);
        const indTxt = document.getElementById("wizard-indicator-text-" + s);

        if (stepEl) {
            if (s === stepNum) {
                stepEl.classList.remove("hidden");
            } else {
                stepEl.classList.add("hidden");
            }
        }

        if (indEl) {
            if (s === stepNum) {
                indEl.className = "w-8 h-8 rounded-full bg-[#00B8D9] text-slate-950 flex items-center justify-center font-bold text-xs ring-4 ring-cyan-500/20";
            } else if (s < stepNum) {
                indEl.className = "w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xs";
            } else {
                indEl.className = "w-8 h-8 rounded-full bg-slate-900 border border-slate-850 text-slate-500 flex items-center justify-center font-bold text-xs";
            }
        }

        if (indTxt) {
            if (s <= stepNum) {
                indTxt.className = "text-[10px] font-bold text-white uppercase tracking-wider";
            } else {
                indTxt.className = "text-[10px] font-semibold text-slate-600 uppercase tracking-wider";
            }
        }
    });

    // If entering step 3, render spec line items summary if table exists
    if (stepNum === 3 && typeof renderSpecLinesTable === "function") {
        renderSpecLinesTable();
    }
}

function switchPortalTab(tab) {
    const btnQuoting = document.getElementById("tabBtnQuoting");
    const btnSupport = document.getElementById("tabBtnSupport");
    const quotingSection = document.getElementById("quotingFormSection");
    const supportSection = document.getElementById("supportFormSection") || document.getElementById("customerSupportSection");

    const activeClass = "px-5 py-2.5 font-bold text-xs rounded-xl transition duration-200 bg-[#5846f6] text-white shadow-md shadow-indigo-600/30 cursor-pointer";
    const inactiveClass = "px-5 py-2.5 font-bold text-xs rounded-xl transition duration-200 text-slate-400 hover:text-white cursor-pointer";

    if (tab === "quoting") {
        if (btnQuoting) btnQuoting.className = activeClass;
        if (btnSupport) btnSupport.className = inactiveClass;
        if (quotingSection) quotingSection.classList.remove("hidden");
        if (supportSection) supportSection.classList.add("hidden");
    } else {
        if (btnQuoting) btnQuoting.className = inactiveClass;
        if (btnSupport) btnSupport.className = activeClass;
        if (quotingSection) quotingSection.classList.add("hidden");
        if (supportSection) supportSection.classList.remove("hidden");
    }
}

function selectProductInConfigurator(productName) {
    const configEl = document.getElementById("configurator");
    if (configEl) {
        configEl.scrollIntoView({ behavior: "smooth" });
    }
    const catSelect = document.getElementById("itemCategory");
    if (catSelect) {
        let found = false;
        for (let i = 0; i < catSelect.options.length; i++) {
            if (catSelect.options[i].value.toLowerCase().includes(productName.toLowerCase()) ||
                catSelect.options[i].text.toLowerCase().includes(productName.toLowerCase())) {
                catSelect.selectedIndex = i;
                found = true;
                break;
            }
        }
        if (!found) {
            catSelect.value = "CUSTOM_ITEM";
            const customInput = document.getElementById("customCategoryInput");
            if (customInput) customInput.value = productName;
        }
        if (typeof handleCategoryChange === "function") {
            handleCategoryChange();
        }
    }
    setWizardStep(2);
}

function closeLightbox() {
    const modal = document.getElementById("lightbox");
    if (modal) modal.classList.add("hidden");
}

function handleLogoClick(e) {
    if (e && e.preventDefault) e.preventDefault();
    
    // Animate logo spring effect on click
    let target = null;
    if (e && e.currentTarget) {
        target = e.currentTarget.querySelector("img") || e.currentTarget;
    } else {
        target = document.querySelector("header img");
    }

    if (target) {
        if (typeof gsap !== "undefined") {
            gsap.killTweensOf(target);
            gsap.fromTo(target, 
                { scale: 0.85, rotate: -8 }, 
                { scale: 1.15, rotate: 0, duration: 0.2, ease: "back.out(2.5)", onComplete: () => {
                    gsap.to(target, { scale: 1, duration: 0.25, ease: "power2.out" });
                }}
            );
        }
    }
}

/* ==========================================================================
   POP-OUT & SCROLL ENTRANCE ANIMATIONS (GSAP ScrollTrigger + IntersectionObserver)
   ========================================================================== */
function initPopOutAnimations() {
    // 1. Add reveal-pop class to all major elements if not present
    const selectors = [
        "section > div",
        ".glass-panel",
        ".grid > div",
        "header",
        "#hero h1",
        "#hero p",
        "#hero .inline-flex",
        "#legacy .border-l-2 > div",
        "#products .grid > div",
        "#why-choose .grid > div",
        "#configurator .grid > div",
        "#showroom .grid > div",
        ".animate-marquee"
    ];

    selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach((el, idx) => {
            if (!el.classList.contains("reveal-pop") && !el.classList.contains("no-pop")) {
                el.classList.add("reveal-pop");
            }
        });
    });

    // 2. GSAP ScrollTrigger Integration
    if (typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined") {
        gsap.registerPlugin(ScrollTrigger);

        document.querySelectorAll(".reveal-pop").forEach((el) => {
            gsap.fromTo(el, 
                { opacity: 0, scale: 0.86, y: 45 },
                {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    duration: 0.7,
                    ease: "back.out(1.5)",
                    scrollTrigger: {
                        trigger: el,
                        start: "top 88%",
                        toggleActions: "play none none none"
                    }
                }
            );
        });

        // 3D Parallax Tilt Effect on Pop Cards
        document.querySelectorAll(".pop-card, .glass-panel, .product-card").forEach((card) => {
            card.addEventListener("mousemove", (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left - rect.width / 2;
                const y = e.clientY - rect.top - rect.height / 2;
                const rotateX = (-y / rect.height) * 12;
                const rotateY = (x / rect.width) * 12;

                gsap.to(card, {
                    rotateX: rotateX,
                    rotateY: rotateY,
                    scale: 1.03,
                    transformPerspective: 1000,
                    duration: 0.25,
                    ease: "power1.out"
                });
            });

            card.addEventListener("mouseleave", () => {
                gsap.to(card, {
                    rotateX: 0,
                    rotateY: 0,
                    scale: 1,
                    duration: 0.4,
                    ease: "power2.out"
                });
            });
        });
    } else {
        // Fallback: IntersectionObserver for smooth reveal
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll(".reveal-pop").forEach(el => observer.observe(el));
    }
}

// Auto Initialize on DOM Ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPopOutAnimations);
} else {
    initPopOutAnimations();
}


/* ==========================================================================
   PRODUCT CATALOG (static and read-only: edit DEFAULT_PRODUCTS in code to change it)
   ========================================================================== */
const DEFAULT_PRODUCTS = [
    {
        id: "prod-sliding-windows",
        title: "Sliding Window Systems",
        subtitle: "Acoustic DGU Double Glazing & Precision Rollers",
        categoryBadge: "Acoustic Glazing",
        image: "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80",
        description: "Heavy-duty engineered sliding window systems with multi-point perimeter compression seals. Eliminates exterior urban noise up to 38dB while delivering thermal insulation.",
        features: ["38dB Noise Attenuation", "Heavy-Duty Extrusions", "Double Glazed DGU", "Smooth Glide Rollers"]
    },
    {
        id: "prod-panoramic-doors",
        title: "Panoramic Sliding Doors",
        subtitle: "Ultra-Slim Sightlines with 12mm Toughened Glass",
        categoryBadge: "Architectural Glazing",
        image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
        description: "Floor-to-ceiling glass expanses designed for modern residences, penthouses, and luxury villas. Features seamless flush bottom track options for barrier-free transitions.",
        features: ["Flush Floor Transition", "Multi-Point Locking", "12mm Toughened Glass", "High Wind Load Rated"]
    },
    {
        id: "prod-frameless-partitions",
        title: "Frameless Glass Partitions",
        subtitle: "10mm–12mm Clear & Frosted Office Partitions",
        categoryBadge: "Interior Glazing",
        image: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80",
        description: "Minimalist floor-to-ceiling interior glass dividing solutions for executive boardrooms, luxury corporate offices, and private residential cabins.",
        features: ["Architectural Hardware", "Custom CNC Cutouts", "Acoustic Sound Control", "Frosted Privacy Banding"]
    },
    {
        id: "prod-shower-cubicles",
        title: "Toughened Shower Cubicles",
        subtitle: "10mm Hydrophobic Coated Water-Repellent Glass",
        categoryBadge: "Hydrophobic Glass",
        image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80",
        description: "Custom-manufactured frameless shower enclosures with anti-limescale Nano-coating and marine-grade SS304 stainless steel hinges.",
        features: ["Nano Anti-Limescale", "SS304 Marine Hardware", "Magnetic Door Seals", "Bespoke Enclosure Shapes"]
    },
    {
        id: "prod-safety-railings",
        title: "Safety Glass Railings",
        subtitle: "13.52mm SentryGlas Toughened Laminated Balustrades",
        categoryBadge: "Safety Architecture",
        image: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=800&q=80",
        description: "Engineered spigot and continuous floor base-shoe railing systems for balconies, terrace gardens, and internal cantilever staircases.",
        features: ["High Impact Structural Glass", "Unobstructed Views", "Balcony & Staircase Spigots", "Zero Maintenance Aluminum"]
    },
    {
        id: "prod-facade-glazing",
        title: "Curtain Wall Facade Glazing",
        categoryBadge: "Commercial Exterior",
        subtitle: "High-performance structural spider & stick curtain glazing",
        description: "Complete exterior building elevation envelope with low-E energy efficient solar control double glazed units (DGU) and structural silicone sealants.",
        image: "https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80",
        features: ["DGU Solar Control Glass", "Structural Silicone Glazing", "Thermal Break Efficiency", "Weather & UV Resistant"]
    },
    {
        id: "prod-skylight",
        title: "Skylight & Glass Dome",
        categoryBadge: "Roof Glazing",
        subtitle: "Architectural natural daylighting roof canopies",
        description: "Engineered overhead glass canopies with high-strength laminated safety glass, slope water drainage channels, and UV-filtering heat reduction tints.",
        image: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=800&q=80",
        features: ["Laminated Overhead Safety", "UV & Heat Rejection Tint", "Integrated Water Gutter", "Heavy Steel/Alu Substructure"]
    }
];

const STANDARD_PRODUCT_CATEGORIES = [
    "Sliding Window",
    "Sliding Door",
    "Casement Door",
    "Fixed Glass Partition",
    "Balcony Glass Railing",
    "Shower Cubicle",
    "Mirror / Toughened Glass"
];

let currentSelectedProductIndex = 0;

let cloudProducts = null;   // set only after a valid response from the catalog store

function sanitizeProduct(p, i) {
    if (!p || typeof p !== 'object') return null;
    const title = cleanText(p.title, 80);
    if (!title) return null;
    const rawId = String(p.id == null ? '' : p.id);
    const feats = (Array.isArray(p.features) ? p.features : String(p.features || '').split(','))
        .map(f => cleanText(f, 60)).filter(Boolean).slice(0, 12);
    return {
        id: /^[A-Za-z0-9_\-]{1,64}$/.test(rawId) ? rawId : 'prod-' + i,
        title,
        subtitle: cleanText(p.subtitle, 140),
        categoryBadge: cleanText(p.categoryBadge, 40),
        image: safeImageUrl(p.image),
        description: cleanMultiline(p.description, 500),
        features: feats.length ? feats : ["Custom Specifications", "Quality Inspected"]
    };
}

function getStoredProducts() {
    return cloudProducts || DEFAULT_PRODUCTS;
}

async function syncCatalogFromCloud() {
    try {
        let raw = null;
        if (CFG.KVDB_BASE) {
            const r = await fetch(CFG.KVDB_BASE + '/' + encodeURIComponent(CFG.CATALOG_KEY), { credentials: 'omit', referrerPolicy: 'no-referrer' });
            if (r.ok) raw = await r.json().catch(() => null);
        }
        if (Array.isArray(raw)) {
            cloudProducts = raw.slice(0, 30).map(sanitizeProduct).filter(Boolean);
            renderProductsCatalog();
        }
    } catch (e) { console.warn("Catalog sync unavailable, showing built-in catalog"); }
}

function selectProductSpotlight(indexOrId) {
    const products = getStoredProducts();
    const spotlightContent = document.getElementById("spotlightContent");
    const spotlightImg = document.getElementById("spotlightImage");
    const spotlightBadge = document.getElementById("spotlightBadge");
    const spotlightTitle = document.getElementById("spotlightTitle");
    const spotlightDesc = document.getElementById("spotlightDescription");
    const spotlightFeatures = document.getElementById("spotlightFeatures");

    if (!products || products.length === 0) {
        if (spotlightBadge) spotlightBadge.textContent = "Custom Glass Studio";
        if (spotlightTitle) spotlightTitle.textContent = "Ajanta Premium Glass Works";
        if (spotlightDesc) spotlightDesc.textContent = "Browse our custom glass sizing options or contact Sunny Mehta directly for custom architectural glazing solutions.";
        if (spotlightFeatures) {
            spotlightFeatures.innerHTML = `
                <div class="flex items-center space-x-2"><span class="text-[#00B8D9] font-bold"><i class="fa-regular fa-square-check"></i></span><span>Custom Dimensions</span></div>
                <div class="flex items-center space-x-2"><span class="text-[#00B8D9] font-bold"><i class="fa-regular fa-square-check"></i></span><span>Factory Toughened</span></div>
                <div class="flex items-center space-x-2"><span class="text-[#00B8D9] font-bold"><i class="fa-regular fa-square-check"></i></span><span>Quality Certified</span></div>
            `;
        }
        return;
    }

    let index = 0;
    if (typeof indexOrId === "number") {
        index = indexOrId;
    } else if (typeof indexOrId === "string") {
        const foundIdx = products.findIndex(p => p.id === indexOrId || p.title.toLowerCase().includes(indexOrId.toLowerCase()));
        if (foundIdx !== -1) index = foundIdx;
    }

    if (index < 0 || index >= products.length) index = 0;
    currentSelectedProductIndex = index;

    const p = products[index];
    if (!p) return;

    // Update Spotlight elements
    if (spotlightImg) {
        spotlightImg.style.opacity = "0";
        setTimeout(() => {
            spotlightImg.src = safeImageUrl(p.image);
            spotlightImg.style.opacity = "0.25";
        }, 150);
    }

    if (spotlightBadge) spotlightBadge.textContent = p.categoryBadge || "Architectural Glazing";
    if (spotlightTitle) spotlightTitle.textContent = p.title || "Custom Glass Product";
    if (spotlightDesc) spotlightDesc.textContent = p.description || "";

    if (spotlightFeatures) {
        const feats = Array.isArray(p.features) ? p.features : (p.features || "").split(",");
        spotlightFeatures.innerHTML = feats.map(f =>
            '<div class="flex items-center space-x-2">' +
                '<span class="text-[#00B8D9] font-bold"><i class="fa-regular fa-square-check"></i></span>' +
                '<span class="truncate">' + escapeHtml(f.trim()) + '</span>' +
            '</div>'
        ).join("");
    }

    // Update sidebar active highlight styles
    products.forEach((prod, i) => {
        const tabEl = document.getElementById("prodTab-" + prod.id) || document.getElementById("prodTab-" + i);
        if (tabEl) {
            if (i === index) {
                tabEl.className = "glass-panel pop-card p-4 rounded-2xl cursor-pointer transition-all duration-300 border-l-4 border-l-[#00B8D9] bg-slate-900/80 flex items-center justify-between";
                const icon = tabEl.querySelector(".fa-angle-right");
                if (icon) icon.className = "fa-solid fa-angle-right text-[#00B8D9]";
            } else {
                tabEl.className = "glass-panel pop-card p-4 rounded-2xl cursor-pointer transition-all duration-300 border-l-4 border-l-transparent flex items-center justify-between hover:bg-slate-900/40";
                const icon = tabEl.querySelector(".fa-angle-right");
                if (icon) icon.className = "fa-solid fa-angle-right text-slate-500";
            }
        }
    });
}

function renderProductsCatalog() {
    const products = getStoredProducts();
    const sidebar = document.getElementById("products-sidebar");
    
    // Update tab count badge in admin
    const countBadge = document.getElementById("tabCountProducts");
    if (countBadge) countBadge.textContent = products.length;

    if (sidebar) {
        if (products.length === 0) {
            sidebar.innerHTML = `
                <div class="glass-panel p-6 rounded-2xl text-center text-slate-500 space-y-2">
                    <i class="fa-solid fa-box-open text-2xl text-slate-600"></i>
                    <p class="text-xs">Catalog is being customized. Use the Configurator below for custom sizing.</p>
                </div>
            `;
        } else {
            sidebar.innerHTML = products.map((p, i) => {
                const isSel = (i === currentSelectedProductIndex);
                return '<div data-click="selectProductSpotlight" data-args="[' + i + ']" id="prodTab-' + escapeHtml(p.id) + '" class="glass-panel pop-card p-4 rounded-2xl cursor-pointer transition-all duration-300 border-l-4 ' + (isSel ? 'border-l-[#00B8D9] bg-slate-900/80' : 'border-l-transparent hover:bg-slate-900/40') + ' flex items-center justify-between">' +
                    '<div class="min-w-0 pr-2">' +
                        '<h4 class="font-bold text-sm tracking-wide text-white truncate">' + escapeHtml(p.title) + '</h4>' +
                        '<span class="text-[10px] text-slate-400 truncate block">' + escapeHtml(p.subtitle || p.categoryBadge || "Architectural Glass") + '</span>' +
                    '</div>' +
                    '<span class="' + (isSel ? 'text-[#00B8D9]' : 'text-slate-500') + ' text-xs font-bold shrink-0"><i class="fa-solid fa-angle-right"></i></span>' +
                '</div>';
            }).join("");
        }
    }

    // Also update Configurator dropdown options so new products appear in the estimator!
    const catSelect = document.getElementById("itemCategory");
    if (catSelect) {
        const currentVal = catSelect.value;
        let optionsHtml = STANDARD_PRODUCT_CATEGORIES.map(opt => '<option value="' + escapeHtml(opt) + '">' + escapeHtml(opt) + '</option>').join("");
        
        // Add additional showcase products if not already present
        products.forEach(p => {
            const exists = STANDARD_PRODUCT_CATEGORIES.some(opt => opt.toLowerCase() === p.title.toLowerCase());
            if (!exists) {
                optionsHtml += '<option value="' + escapeHtml(p.title) + '">' + escapeHtml(p.title) + '</option>';
            }
        });
        optionsHtml += '<option value="CUSTOM_ITEM">+ Custom product select...</option>';
        catSelect.innerHTML = optionsHtml;
        if (currentVal && Array.from(catSelect.options).some(o => o.value === currentVal)) {
            catSelect.value = currentVal;
        }
    }

    // Select active spotlight
    selectProductSpotlight(currentSelectedProductIndex);
}

function configureSelectedSpotlightProduct() {
    const products = getStoredProducts();
    const p = products[currentSelectedProductIndex];
    if (p) {
        selectProductInConfigurator(p.title);
    } else {
        const configEl = document.getElementById("configurator");
        if (configEl) configEl.scrollIntoView({ behavior: "smooth" });
        setWizardStep(2);
    }
}


/* ==========================================================================
   EVENT WIRING (replaces inline onclick/onchange/onsubmit so a strict CSP can be used)
   Only functions listed here can be triggered from markup.
   ========================================================================== */
const ACTIONS = Object.freeze({
    handleLogoClick, switchPortalTab, toggleAiChatDrawer, openReviewModal, closeReviewModal,
    detectWebLocation, closeOrderModal, openOrderModal, closeLightbox, toggleAiVoiceInput,
    submitSupportForm, submitReview, submitForm, sendQuickAiQuery, selectProductSpotlight,
    scrollToConfiguratorFromAi, handleAiFormSubmit, openAjantaEmail, handleThicknessChange,
    handleGlassProfileChange, handleCategoryChange, configureSelectedSpotlightProduct,
    closeSuccessModal, clearAiChatHistory, addSpecLineItem, removeSpecLineItem
});

function runAction(e, el, name) {
    const fn = Object.prototype.hasOwnProperty.call(ACTIONS, name) ? ACTIONS[name] : null;
    if (typeof fn !== 'function') return;
    let args = [];
    try { args = JSON.parse(el.getAttribute('data-args') || '[]'); } catch (err) { args = []; }
    if (!Array.isArray(args)) args = [];
    args = args.map(a => a === '$event' ? {
        type: e.type, target: e.target, currentTarget: el,
        preventDefault: () => e.preventDefault(), stopPropagation: () => e.stopPropagation()
    } : a);
    fn.apply(null, args);
}

document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const el = e.target.closest('[data-click],[data-stop]');
    if (!el || !el.hasAttribute('data-click')) return;   // data-stop: swallow clicks (lightbox content)
    runAction(e, el, el.getAttribute('data-click'));
});
document.addEventListener('change', (e) => {
    if (!(e.target instanceof Element)) return;
    const el = e.target.closest('[data-change]');
    if (el) runAction(e, el, el.getAttribute('data-change'));
});
document.addEventListener('submit', (e) => {
    if (!(e.target instanceof Element)) return;
    const el = e.target.closest('[data-submit]');
    if (el) { e.preventDefault(); runAction(e, el, el.getAttribute('data-submit')); }
});

function initSite() {
    renderProductsCatalog();
    renderReviews();
    syncCatalogFromCloud();
    loadApprovedReviews();
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSite);
} else {
    initSite();
}
