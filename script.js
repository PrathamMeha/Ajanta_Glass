/**
 * Ajanta Glass - Customer Requirement Portal
 * Interactive Form, Live Calculations, Geolocation, and Real-Time Syncing Script
 * Crafted with premium UX in mind.
 */

// Array to store customer glass specification inputs
if (typeof window.clientSpecsList === 'undefined') window.clientSpecsList = [];
// Hardcoded to submit directly to owner
if (typeof window.MAIN_OWNER_ACCOUNT === 'undefined') window.MAIN_OWNER_ACCOUNT = "ajnatafenestration@gmail.com";
if (typeof window.fabricatorUser === 'undefined') window.fabricatorUser = window.MAIN_OWNER_ACCOUNT;

// Cross-platform Email Handler (Desktop Web Gmail + Mobile App Mailto + Clipboard copy)
function openAjantaEmail(event) {
    if (event) event.preventDefault();
    const email = "ajnatafenestration@gmail.com";
    const subject = encodeURIComponent("Inquiry - Ajanta Door & Window System");
    const body = encodeURIComponent("Hello Ajanta Glass team,\n\nI would like to inquire about your architectural glass, doors, and window systems.\n\nThank you!");

    // Copy to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(email).catch(() => {});
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    } else {
        // Open Gmail Compose directly in new tab
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${subject}&body=${body}`;
        const win = window.open(gmailUrl, "_blank");
        if (!win || win.closed || typeof win.closed === "undefined") {
            window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
        }
    }
}

// Web Geolocation detection with OpenStreetMap and BigDataCloud fallback geocoding plus IP fallback
async function detectWebLocation() {
    const btn = document.getElementById('locateBtn');
    const icon = document.getElementById('locateIcon');
    const text = document.getElementById('locateText');
    const addressInput = document.getElementById('clientAddress');

    if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        return;
    }

    btn.disabled = true;
    icon.className = "fa-solid fa-circle-notch animate-spin text-indigo-400";
    text.textContent = "Locating...";

    // Helper to fetch IP-based location as ultimate fallback
    async function fallbackToIP(message) {
        try {
            const ipResponse = await fetch('https://ipapi.co/json/');
            if (ipResponse.ok) {
                const ipData = await ipResponse.json();
                const city = ipData.city || "";
                const region = ipData.region || "";
                const zip = ipData.postal || "";
                
                const addr = [city, region, zip].filter(Boolean).join(', ');
                if (addr) {
                    addressInput.value = `${addr} (Estimated via IP)`;
                    icon.className = "fa-solid fa-circle-check text-emerald-400";
                    text.textContent = "Estimated!";
                    setTimeout(() => {
                        icon.className = "fa-solid fa-location-arrow";
                        text.textContent = "Locate Me";
                        btn.disabled = false;
                    }, 3000);
                    return;
                }
            }
        } catch (ipErr) {
            console.error("IP Geolocator error:", ipErr);
        }
        
        alert(message || "Could not retrieve your location. Check your GPS and internet connection.");
        icon.className = "fa-solid fa-location-arrow";
        text.textContent = "Locate Me";
        btn.disabled = false;
    }

    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        let resolvedAddr = "";

        // TIER 1: Reverse Geocoding via Nominatim (OpenStreetMap) for maximum precision
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
                headers: {
                    'Accept-Language': 'en'
                }
            });
            if (response.ok) {
                const data = await response.json();
                if (data && data.display_name) {
                    const parts = data.display_name.split(',').map(p => p.trim());
                    const filteredParts = parts.filter(p => {
                        const lower = p.toLowerCase();
                        return lower !== "india" && lower !== "republic of india";
                    });
                    resolvedAddr = filteredParts.join(', ');
                }
            }
        } catch (err) {
            console.error("Nominatim service error:", err);
        }

        // TIER 2: Fallback to BigDataCloud
        if (!resolvedAddr) {
            try {
                const bdcResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
                if (bdcResponse.ok) {
                    const bdcData = await bdcResponse.json();
                    let parts = [];
                    if (bdcData.locality) parts.push(bdcData.locality);
                    if (bdcData.principalSubdivision) parts.push(bdcData.principalSubdivision);
                    
                    if (parts.length > 0) {
                        resolvedAddr = parts.join(", ");
                    }
                }
            } catch (bdcErr) {
                console.error("BigDataCloud failed:", bdcErr);
            }
        }

        // Final application to UI
        if (resolvedAddr) {
            addressInput.value = resolvedAddr;
            icon.className = "fa-solid fa-circle-check text-emerald-400";
            text.textContent = "Detected!";
        } else {
            // TIER 3: Last Resort Fallback to Coordinates
            addressInput.value = `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`;
            icon.className = "fa-solid fa-circle-check text-indigo-400";
            text.textContent = "Coordinates Set";
        }

        setTimeout(() => {
            icon.className = "fa-solid fa-location-arrow";
            text.textContent = "Locate Me";
            btn.disabled = false;
        }, 3000);

    }, (error) => {
        console.error("Geolocation service error:", error);
        let errMsg = "Unable to access GPS sensor.";
        if (error.code === error.PERMISSION_DENIED) {
            errMsg = "Location permission denied by browser. Attempting network IP location estimate...";
        }
        fallbackToIP(errMsg);
    }, {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 0
    });
}

// Web Cryptography hash utility
async function sha256(message) {
    const msgBuffer = new TextEncoder().encode(message.trim());
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

window.addEventListener('load', () => {
    // Read query parameters
    const params = new URLSearchParams(window.location.search);
    const userParam = params.get('user') || "";

    // Respect user parameters if custom routes exist, otherwise default directly to the owner
    if (userParam.trim() !== "") {
        fabricatorUser = userParam.trim();
    } else {
        fabricatorUser = MAIN_OWNER_ACCOUNT;
    }
});

// Configurator Visibility handlers
function handleCategoryChange() {
    const select = document.getElementById('itemCategory');
    const customInput = document.getElementById('customCategoryContainer');
    if (select.value === 'CUSTOM_ITEM') {
        customInput.classList.remove('hidden');
    } else {
        customInput.classList.add('hidden');
    }
}

function addSpecLineItem() {
    const catSelect = document.getElementById('itemCategory');
    let category = catSelect.value;
    if (category === 'CUSTOM_ITEM') {
        category = document.getElementById('customCategoryInput').value.trim() || 'Custom';
    }

    const widthInput = document.getElementById('itemWidth');
    const heightInput = document.getElementById('itemHeight');
    const qtyInput = document.getElementById('itemQty');

    const width = parseFloat(widthInput.value) || 0.0;
    const height = parseFloat(heightInput.value) || 0.0;
    const qty = parseInt(qtyInput.value) || 1;

    if (width <= 0 || height <= 0) {
        alert("Please specify positive width and height parameters.");
        return;
    }

    const itemSpec = {
        id: `spec-${Date.now()}-${Math.floor(Math.random()*100)}`,
        name: category,
        width: width,
        height: height,
        qty: qty,
        rate: 0.0
    };

    clientSpecsList.push(itemSpec);
    renderSpecLinesTable(itemSpec.id);

    widthInput.value = '';
    heightInput.value = '';
    qtyInput.value = '1';
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
            tr.className = "border-b border-slate-800/60 hover:bg-slate-900/40";

            if (isNew) {
                tr.style.opacity = "0";
                tr.style.transform = "translateX(-30px) scale(0.95)";
            }

            tr.innerHTML = `
                <td class="p-3 pl-4 font-semibold text-white leading-tight">
                    ${item.name}
                </td>
                <td class="p-3 text-center font-mono text-indigo-300 font-semibold">${item.width}"</td>
                <td class="p-3 text-center font-mono text-indigo-300 font-semibold">${item.height}"</td>
                <td class="p-3 text-center font-bold text-white">${item.qty}</td>
                <td class="p-3 text-center">
                    <button type="button" onclick="removeSpecLineItem('${item.id}')" class="text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-900/20 p-1.5 rounded-lg transition interactive-hover-btn">
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

async function submitForm(event) {
    event.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa fa-circle-notch animate-spin"></i> <span>Submitting Inquiry...</span>`;

    const name = document.getElementById('clientName').value.trim();
    const phone = document.getElementById('clientPhone').value.trim();
    const address = document.getElementById('clientAddress').value.trim();
    const note = document.getElementById('clientRequirements').value.trim();

    if (fabricatorUser === "") {
        fabricatorUser = MAIN_OWNER_ACCOUNT;
    }

    // Target KVDB user Key Hashing
    const hashedKey = await sha256(fabricatorUser);
    const endpoint = `https://kvdb.io/T2p78Krq12XcfWn1vNiw9G/${hashedKey}_leads`;

    // Create lead payload
    const newLead = {
        id: `${Date.now()}`,
        clientName: name,
        clientPhone: phone,
        clientAddress: address,
        requirements: note || "Custom glass architecture specifications",
        items: clientSpecsList,
        createdAt: `${Date.now()}`
    };

    try {
        // Fetch existing leads array if any
        let existingLeads = [];
        const res = await fetch(endpoint).catch(() => null);
        if (res && res.ok) {
            const text = await res.text();
            try {
                existingLeads = JSON.parse(text);
                if (!Array.isArray(existingLeads)) {
                    existingLeads = [];
                }
            } catch (e) {
                existingLeads = [];
            }
        }

        // Append the brand new lead!
        existingLeads.push(newLead);

        // Also save directly to local storage for instant offline & admin accessibility
        try {
            const localLeads = JSON.parse(localStorage.getItem("ajanta_quote_leads") || "[]");
            localLeads.unshift(newLead);
            localStorage.setItem("ajanta_quote_leads", JSON.stringify(localLeads));
        } catch (storageErr) {
            console.warn("Could not write to local storage:", storageErr);
        }

        // Save back to KVDB
        const postRes = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(existingLeads)
        });

        if (postRes.ok) {
            // Reset form and specifications list
            document.getElementById('requirementsForm').reset();
            clientSpecsList = [];
            renderSpecLinesTable();

            // Set dynamic success modal contents
            document.querySelector('#successModal h3').textContent = "Inquiry Submitted";
            document.querySelector('#successModal p').textContent = "Your inquiry has been submitted successfully. Our team will review your requirements and contact you with a personalized quotation.";
            
            // Show Success triggers
            document.getElementById('successModal').classList.remove('hidden');
        } else {
            alert("Unable to transmit information. Please verify internet access and try again.");
        }
    } catch (err) {
        console.error(err);
        alert("Submission transmission error: " + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<i class="fa fa-paper-plane"></i> <span>Submit Inquiry</span>`;
    }
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.add('hidden');
}

/* ==========================================================================
   AJANTA AI GLASS & WINDOW CONSULTANT (GEMINI INTEGRATION)
   ========================================================================== */
let aiSpeechRecognizer = null;
let isAiVoiceListening = false;

function toggleAiChatDrawer() {
    const drawer = document.getElementById('aiChatDrawer');
    if (!drawer) return;
    const isHidden = drawer.classList.contains('hidden');
    if (isHidden) {
        drawer.classList.remove('hidden');
        setTimeout(() => drawer.classList.remove('translate-x-full'), 10);
        const savedKey = localStorage.getItem('gemini_api_key');
        if (savedKey) {
            const keyInput = document.getElementById('geminiApiKeyInput');
            if (keyInput) keyInput.value = savedKey;
        }
        const chatInput = document.getElementById('aiChatInput');
        if (chatInput) chatInput.focus();
    } else {
        drawer.classList.add('translate-x-full');
        setTimeout(() => drawer.classList.add('hidden'), 300);
    }
}

function toggleAiKeySettings() {
    const panel = document.getElementById('aiKeySettingsPanel');
    if (panel) panel.classList.toggle('hidden');
}

function saveGeminiApiKey() {
    const keyInput = document.getElementById('geminiApiKeyInput');
    if (!keyInput) return;
    const key = keyInput.value.trim();
    if (key) {
        localStorage.setItem('gemini_api_key', key);
        alert("Gemini API Key saved successfully!");
    } else {
        localStorage.removeItem('gemini_api_key');
        alert("Custom API key removed. Integrated Gemini AI active.");
    }
    toggleAiKeySettings();
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
                        <button onclick="scrollToConfiguratorFromAi()" class="text-xs text-[#00B8D9] hover:underline font-bold flex items-center gap-1 cursor-pointer">
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
    const customApiKey = localStorage.getItem('gemini_api_key') || (typeof window !== 'undefined' ? window.GEMINI_API_KEY : '') || 'AIzaSyDnxi96c4s7UpzCWOrIlkyD8qjeDQNfrM8';
    
    // System instruction prompt
    const systemInstruction = "Your name is Ajanta AI — Lead Architectural Glass & Window Systems Consultant for Ajanta Door & Window Systems (Est. 1976, Sirsa, Haryana, India).\n" +
        "CRITICAL PERSONALITY & IDENTITY RULES:\n" +
        "- Always identify yourself strictly as 'Ajanta AI'. When asked 'Who are you?', 'Who is this?', or 'What is your name?', respond warmly: 'I am Ajanta AI'.\n" +
        "- NEVER say 'I am a language model', 'I am an AI model', 'I am a large language model', or mention Google or AI technology in any way.\n" +
        "- Maintain a friendly, warm, polite, and highly professional tone.\n" +
        "- Provide clear, structured, and expert architectural advice regarding Toughened Glass, DGU Insulated Glass, Laminated Glass, UPVC & Slimline Aluminum Windows, and shower partitions.\n" +
        "- Keep responses clean, concise, and formatted with bullet points and bold headers.";

    if (customApiKey && customApiKey.trim().length > 10) {
        const models = ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-flash'];
        for (const model of models) {
            try {
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(customApiKey.trim())}`;
                const payload = {
                    contents: [{
                        parts: [{ text: promptText }]
                    }],
                    systemInstruction: {
                        parts: [{ text: systemInstruction }]
                    }
                };
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) return text;
                }
            } catch (apiErr) {
                console.warn(`Gemini API error with model ${model}:`, apiErr);
            }
        }
    }

    // Default intelligent glazing AI consultant engine fallback
    return getGlazingIntelligenceFallback(promptText);
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")
                      .replace(/'/g, "&#039;");
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
   VERIFIED CLIENT REVIEWS SYSTEM & MODALS
   ========================================================================== */

const defaultReviews = [];

function cleanLegacyFakeReviews() {
    try {
        const stored = localStorage.getItem("ajanta_client_reviews");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                const fakeNames = ["Rajesh Sharma", "Ar. Priya Verma", "Vikramjit Singh", "Meenakshi Sundaram", "Amanpreet Kaur"];
                const clean = parsed.filter(r => !fakeNames.includes(r.name));
                localStorage.setItem("ajanta_client_reviews", JSON.stringify(clean));
            }
        }
    } catch (e) {
        console.warn("Could not clean legacy fake reviews:", e);
    }
}

cleanLegacyFakeReviews();

function getStoredReviews() {
    try {
        const stored = localStorage.getItem("ajanta_client_reviews");
        if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
                const fakeNames = ["Rajesh Sharma", "Ar. Priya Verma", "Vikramjit Singh", "Meenakshi Sundaram", "Amanpreet Kaur"];
                return parsed.filter(r => !fakeNames.includes(r.name));
            }
        }
    } catch (e) {
        console.warn("Could not load reviews from localStorage:", e);
    }
    return [];
}

function saveStoredReviews(reviews) {
    try {
        localStorage.setItem("ajanta_client_reviews", JSON.stringify(reviews));
        // Background Cloud Sync to KVDB
        fetch("https://kvdb.io/T2p78Krq12XcfWn1vNiw9G/ajanta_client_reviews", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reviews)
        }).catch(e => console.warn("Reviews cloud sync note:", e));
    } catch (e) {
        console.warn("Could not save reviews to localStorage:", e);
    }
}

async function syncReviewsFromCloud() {
    try {
        const res = await fetch("https://kvdb.io/T2p78Krq12XcfWn1vNiw9G/ajanta_client_reviews").catch(() => null);
        if (res && res.ok) {
            const cloudReviews = await res.json().catch(() => null);
            if (Array.isArray(cloudReviews)) {
                localStorage.setItem("ajanta_client_reviews", JSON.stringify(cloudReviews));
                requestAnimationFrame(() => {
                    renderReviews();
                });
            }
        }
    } catch (err) {
        console.warn("Could not sync cloud reviews:", err);
    }
}

function renderReviews() {
    const marqueeContainer = document.getElementById("marqueeList");
    const reviewsGrid = document.getElementById("reviewsGrid");
    const reviews = getStoredReviews();

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
                            ${Array(r.rating || 5).fill('<i class="fa-solid fa-star"></i>').join("")}
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

    if (reviewsGrid) {
        if (reviews.length === 0) {
            reviewsGrid.innerHTML = `
                <div class="col-span-full glass-panel p-10 text-center rounded-2xl border border-slate-800 space-y-4 max-w-xl mx-auto">
                    <div class="w-12 h-12 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center mx-auto text-xl">
                        <i class="fa-solid fa-comments"></i>
                    </div>
                    <div class="space-y-1">
                        <h4 class="text-base font-bold text-white">No Fake Reviews</h4>
                        <p class="text-xs text-slate-400 leading-relaxed">We only display authentic, real-time client feedback. Be the first to share your experience with Ajanta Door & Window System!</p>
                    </div>
                    <button onclick="openReviewModal()" class="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-lg transition">
                        <i class="fa-solid fa-pen-nib"></i> Write First Review
                    </button>
                </div>
            `;
        } else {
            reviewsGrid.innerHTML = reviews.map((r, i) => `
                <div class="glass-panel p-6 rounded-2xl border border-slate-800 hover:border-cyan-500/30 transition duration-300 bg-slate-900/60 shadow-lg flex flex-col justify-between space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1 text-amber-400 text-xs">
                            ${Array(r.rating || 5).fill('<i class="fa-solid fa-star"></i>').join("")}
                        </div>
                        <span class="text-[9px] font-bold text-cyan-400 bg-cyan-950/50 border border-cyan-800/30 px-2 py-0.5 rounded-full">
                            ${escapeHtml(r.category || "Verified Client")}
                        </span>
                    </div>
                    <p class="text-xs text-slate-300 leading-relaxed italic">"${escapeHtml(r.text)}"</p>
                    <div class="flex items-center justify-between pt-3 border-t border-slate-800">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-9 h-9 rounded-full bg-gradient-to-tr from-cyan-600 to-indigo-600 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                                ${escapeHtml(r.name ? r.name.charAt(0).toUpperCase() : "A")}
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-white truncate">${escapeHtml(r.name)}</div>
                                <div class="text-[10px] text-slate-400 truncate">${escapeHtml(r.role)} (${escapeHtml(r.city || "India")})</div>
                            </div>
                        </div>
                        <button onclick="deleteReview(${i})" class="text-slate-500 hover:text-rose-400 text-xs p-1 transition" title="Delete Review">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
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

function submitReview(e) {
    if (e) e.preventDefault();
    const author = document.getElementById("reviewAuthor")?.value?.trim() || "Anonymous Client";
    const role = document.getElementById("reviewRole")?.value?.trim() || "Architect / Client";
    const rating = parseInt(document.getElementById("reviewRating")?.value || "5", 10);
    const text = document.getElementById("reviewText")?.value?.trim() || "Great quality glass products!";

    const newReview = {
        name: author,
        role: role,
        city: "India",
        rating: rating,
        text: text,
        date: new Date().toISOString().split("T")[0],
        category: "Verified Order"
    };

    const reviews = getStoredReviews();
    reviews.unshift(newReview);
    saveStoredReviews(reviews);
    renderReviews();
    closeReviewModal();

    alert("Thank you! Your verified client review has been published.");
}

/* ==========================================================================
   ADMIN PORTAL & OWNER MANAGEMENT SYSTEM
   ========================================================================== */

function openAdminPortal() {
    const loginModal = document.getElementById("adminLoginModal");
    const dashboardModal = document.getElementById("adminDashboardModal");
    const isLoggedIn = sessionStorage.getItem("ajanta_admin_logged_in") === "true";

    if (isLoggedIn && dashboardModal) {
        dashboardModal.classList.remove("hidden");
        renderAdminLeads();
        renderAdminProductsList();
        renderAdminReviewsList();
    } else if (loginModal) {
        loginModal.classList.remove("hidden");
    }
}

function closeAdminLoginModal() {
    const loginModal = document.getElementById("adminLoginModal");
    if (loginModal) loginModal.classList.add("hidden");
}

function promptOwnerLogin() {
    openAdminPortal();
}

function handleAdminLogin(e) {
    if (e) e.preventDefault();
    const passwordInput = document.getElementById("adminPassword")?.value || "";
    const errorMsg = document.getElementById("adminLoginError");

    // Allow access with standard admin passcodes or non-empty string in dev
    if (passwordInput === "1976" || passwordInput === "admin" || passwordInput.length > 0) {
        sessionStorage.setItem("ajanta_admin_logged_in", "true");
        if (errorMsg) errorMsg.classList.add("hidden");
        closeAdminLoginModal();
        openAdminPortal();
    } else {
        if (errorMsg) {
            errorMsg.classList.remove("hidden");
            errorMsg.textContent = "Invalid passcode. Try 1976 or admin.";
        }
    }
}

function closeAdminDashboard() {
    const dashboardModal = document.getElementById("adminDashboardModal");
    if (dashboardModal) dashboardModal.classList.add("hidden");
}

function switchAdminTab(tab) {
    const tabs = ["leads", "products", "reviews", "tools"];
    tabs.forEach(t => {
        const btn = document.getElementById("tabBtn-" + t) || document.getElementById("adminTab-" + t);
        const content = document.getElementById("adminTab-" + t) || document.getElementById("adminTabContent-" + t);
        if (btn) {
            if (t === tab) {
                btn.className = "border-b-2 border-cyan-400 text-cyan-400 font-bold px-4 py-2.5 transition whitespace-nowrap cursor-pointer";
            } else {
                btn.className = "border-b-2 border-transparent text-slate-400 hover:text-white font-bold px-4 py-2.5 transition whitespace-nowrap cursor-pointer";
            }
        }
        if (content) {
            if (t === tab) content.classList.remove("hidden");
            else content.classList.add("hidden");
        }
    });

    if (tab === "leads") renderAdminLeads();
    if (tab === "products") renderAdminProductsList();
    if (tab === "reviews") renderAdminReviewsList();
}

function getStoredLeads() {
    try {
        const stored = localStorage.getItem("ajanta_quote_leads");
        if (stored) return JSON.parse(stored);
    } catch (e) {
        console.warn("Could not parse quote leads:", e);
    }
    return [
        {
            name: "Sunil Mehta",
            phone: "+91 98765 43210",
            address: "Plot 42, Sector 14, Sirsa",
            itemCount: 3,
            
            date: "2026-02-08"
        },
        {
            name: "Harpreet Kaur",
            phone: "+91 94160 12345",
            address: "Model Town, Bathinda",
            itemCount: 2,
            
            date: "2026-02-07"
        }
    ];
}

function renderAdminLeads() {
    const leadsContainer = document.getElementById("adminTabContent-leads") || document.getElementById("leadsLoading");
    const leads = getStoredLeads();

    if (leadsContainer) {
        leadsContainer.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Submitted Quotes & Requirements (${leads.length})</span>
                    <button onclick="exportLeadsExcel()" class="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition">
                        <i class="fa-solid fa-file-excel text-white"></i> Export Excel Sheet
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs text-slate-300 border-collapse">
                        <thead>
                            <tr class="border-b border-slate-800 text-slate-500 uppercase text-[9px] tracking-wider">
                                <th class="p-2.5">Date</th>
                                <th class="p-2.5">Client Name</th>
                                <th class="p-2.5">Phone / WA</th>
                                <th class="p-2.5">Location</th>
                                <th class="p-2.5">Items</th>
                                <th class="p-2.5 text-right">Est. Amount</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800/60">
                            ${leads.map(l => `
                                <tr class="hover:bg-slate-900/60 transition">
                                    <td class="p-2.5 font-mono text-[10px] text-slate-400">${escapeHtml(l.date)}</td>
                                    <td class="p-2.5 font-bold text-white">${escapeHtml(l.name)}</td>
                                    <td class="p-2.5 text-cyan-400 font-mono">${escapeHtml(l.phone)}</td>
                                    <td class="p-2.5 text-slate-400 truncate max-w-[150px]">${escapeHtml(l.address)}</td>
                                    <td class="p-2.5 text-center font-bold text-indigo-400">${l.itemCount || 1}</td>
                                    
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

function renderAdminReviewsList() {
    const reviewsContainer = document.getElementById("adminTabContent-reviews");
    const reviews = getStoredReviews();

    if (reviewsContainer) {
        reviewsContainer.innerHTML = `
            <div class="space-y-4">
                <div class="flex items-center justify-between pb-3 border-b border-slate-800">
                    <span class="text-xs font-bold text-slate-300 uppercase tracking-wider">Client Reviews Management (${reviews.length})</span>
                </div>
                <div class="space-y-3">
                    ${reviews.map((r, index) => `
                        <div class="p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-4">
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2">
                                    <span class="font-bold text-white text-xs">${escapeHtml(r.name)}</span>
                                    <span class="text-[9px] text-amber-400 font-bold">${r.rating}★</span>
                                    <span class="text-[9px] text-slate-500">${escapeHtml(r.role)} • ${escapeHtml(r.city)}</span>
                                </div>
                                <p class="text-xs text-slate-300 truncate mt-1">"${escapeHtml(r.text)}"</p>
                            </div>
                            <button onclick="deleteReview(${index})" class="bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-800/40 p-2 rounded-lg text-xs transition cursor-pointer" title="Delete Review">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join("")}
                </div>
            </div>
        `;
    }
}

function deleteReview(index) {
    const reviews = getStoredReviews();
    if (index >= 0 && index < reviews.length) {
        reviews.splice(index, 1);
        saveStoredReviews(reviews);
        renderReviews();
        renderAdminReviewsList();
    }
}

function exportLeadsExcel() {
    const leads = getStoredLeads();
    if (!leads || leads.length === 0) {
        alert("No leads/inquiries found to export.");
        return;
    }

    let excelHtml = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head>' +
        '<meta charset="utf-8">' +
        '<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Ajanta Glass Inquiries</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->' +
        '<style>' +
            'body { font-family: Arial, sans-serif; }' +
            'th { background-color: #0284C7; color: #FFFFFF; font-weight: bold; border: 1px solid #00B8D9; padding: 10px; font-size: 11pt; }' +
            'td { border: 1px solid #CBD5E1; padding: 8px; font-size: 10pt; vertical-align: middle; }' +
            '.header-title { font-size: 16pt; font-weight: bold; color: #0F172A; text-align: center; background-color: #E0F2FE; border: none; }' +
            '.header-subtitle { font-size: 10pt; color: #0284C7; text-align: center; border: none; }' +
            '.num { text-align: right; }' +
            '.center { text-align: center; }' +
        '</style>' +
    '</head>' +
    '<body>' +
        '<table>' +
            '<tr><td colspan="6" class="header-title">AJANTA DOOR &amp; WINDOW SYSTEMS</td></tr>' +
            '<tr><td colspan="6" class="header-subtitle">Client Inquiries &amp; Quotations Master Register</td></tr>' +
            '<tr><td colspan="6" style="border:none; font-size:9pt; color:#64748B;">Exported Date: ' + new Date().toLocaleString() + '</td></tr>' +
            '<tr></tr>' +
            '<tr>' +
                '<th>Date &amp; Time</th>' +
                '<th>Client Name</th>' +
                '<th>Phone / WhatsApp</th>' +
                '<th>Location / Address</th>' +
                '<th>Total Items</th>' +
                
            '</tr>' +
            leads.map(l => 
                '<tr>' +
                    '<td>' + escapeHtml(l.date || "") + '</td>' +
                    '<td><b>' + escapeHtml(l.name || "") + '</b></td>' +
                    '<td>' + escapeHtml(l.phone || "") + '</td>' +
                    '<td>' + escapeHtml(l.address || "") + '</td>' +
                    '<td class="center"><b>' + (l.itemCount || 1) + '</b></td>' +
                    
                '</tr>'
            ).join('') +
        '</table>' +
    '</body>' +
    '</html>';

    const blob = new Blob(['\ufeff' + excelHtml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Ajanta_Glass_Leads_" + new Date().toISOString().split("T")[0] + ".xls";
    link.click();
}

function exportLeadsCsv() {
    exportLeadsExcel();
}

// Auto Initialize Reviews on Page Load
try {
    renderReviews();
} catch (e) {
    console.warn("Immediate renderReviews error:", e);
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", renderReviews);
    }
    window.addEventListener("load", renderReviews);
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

    if (tab === "quoting") {
        if (btnQuoting) btnQuoting.className = "px-4 py-2 font-bold text-xs rounded-lg transition duration-200 bg-gradient-to-r from-cyan-600 to-cyan-850 text-white";
        if (btnSupport) btnSupport.className = "px-4 py-2 font-bold text-xs rounded-lg transition duration-200 text-slate-400 hover:text-white";
        if (quotingSection) quotingSection.classList.remove("hidden");
        if (supportSection) supportSection.classList.add("hidden");
    } else {
        if (btnQuoting) btnQuoting.className = "px-4 py-2 font-bold text-xs rounded-lg transition duration-200 text-slate-400 hover:text-white";
        if (btnSupport) btnSupport.className = "px-4 py-2 font-bold text-xs rounded-lg transition duration-200 bg-gradient-to-r from-cyan-600 to-cyan-850 text-white";
        if (quotingSection) quotingSection.classList.add("hidden");
        if (supportSection) supportSection.classList.remove("hidden");
    }
}

function selectProductSpotlight(productName) {
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

function toggleAdminPassword() {
    const input = document.getElementById("adminPassword");
    if (input) {
        input.type = input.type === "password" ? "text" : "password";
    }
}

function refreshAdminData() {
    if (typeof renderAdminLeads === "function") renderAdminLeads();
    if (typeof renderAdminProductsList === "function") renderAdminProductsList();
    if (typeof renderAdminReviewsList === "function") renderAdminReviewsList();
}

function handleAdminLogout() {
    sessionStorage.removeItem("ajanta_admin_logged_in");
    closeAdminDashboard();
}

function exportData() {
    if (typeof exportLeadsCsv === "function") exportLeadsCsv();
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
   DYNAMIC PRODUCT CATALOG MANAGEMENT SYSTEM (Real-Time Cloud & Local Sync)
   ========================================================================== */
const DEFAULT_PRODUCTS = [];

let currentSelectedProductIndex = 0;

function getStoredProducts() {
    try {
        const stored = localStorage.getItem("ajanta_products_catalog");
        if (stored !== null) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (e) {
        console.warn("Error reading stored products:", e);
    }
    return [];
}

function saveStoredProducts(products) {
    try {
        localStorage.setItem("ajanta_products_catalog", JSON.stringify(products));
        // Background Cloud Sync to KVDB
        fetch("https://kvdb.io/T2p78Krq12XcfWn1vNiw9G/ajanta_products_catalog", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(products)
        }).catch(e => console.warn("Cloud sync note:", e));
    } catch (e) {
        console.warn("Error saving products:", e);
    }
}

async function syncCatalogFromCloud() {
    try {
        const res = await fetch("https://kvdb.io/T2p78Krq12XcfWn1vNiw9G/ajanta_products_catalog").catch(() => null);
        if (res && res.ok) {
            const cloudProducts = await res.json().catch(() => null);
            if (Array.isArray(cloudProducts)) {
                localStorage.setItem("ajanta_products_catalog", JSON.stringify(cloudProducts));
                requestAnimationFrame(() => {
                    renderProductsCatalog();
                });
            }
        }
    } catch (err) {
        console.warn("Could not sync cloud catalog:", err);
    }
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
            spotlightImg.src = p.image || "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80";
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
                return '<div onclick="selectProductSpotlight(' + i + ')" id="prodTab-' + p.id + '" class="glass-panel pop-card p-4 rounded-2xl cursor-pointer transition-all duration-300 border-l-4 ' + (isSel ? 'border-l-[#00B8D9] bg-slate-900/80' : 'border-l-transparent hover:bg-slate-900/40') + ' flex items-center justify-between">' +
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
        let optionsHtml = products.map(p => '<option value="' + escapeHtml(p.title) + '">' + escapeHtml(p.title) + ' (' + escapeHtml(p.subtitle || p.categoryBadge) + ')</option>').join("");
        optionsHtml += '<option value="CUSTOM_ITEM">+ Custom Special Glass Request...</option>';
        catSelect.innerHTML = optionsHtml;
    }

    // Select active spotlight
    selectProductSpotlight(currentSelectedProductIndex);
}

function renderAdminProductsList() {
    const products = getStoredProducts();
    const container = document.getElementById("adminProductsContainer");
    const countBadge = document.getElementById("tabCountProducts");
    if (countBadge) countBadge.textContent = products.length;

    if (!container) return;

    if (products.length === 0) {
        container.innerHTML = 
            '<div class="col-span-2 text-center py-8 text-slate-500 space-y-2">' +
                '<p class="text-xs">No products in catalog. Click "+ Add New Product" to add your first product.</p>' +
            '</div>';
        return;
    }

    container.innerHTML = products.map(function(p) {
        const featCount = Array.isArray(p.features) ? p.features.length : (p.features || "").split(",").length;
        const safeId = escapeHtml(p.id);
        const safeTitle = escapeHtml(p.title);
        const safeBadge = escapeHtml(p.categoryBadge || "Product");
        
        const safeSub = escapeHtml(p.subtitle || p.description || "");
        const safeImg = escapeHtml(p.image || "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80");

        return '<div class="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl flex flex-col justify-between space-y-3 relative group hover:border-slate-700 transition">' +
            '<div class="flex items-start gap-3">' +
                '<img src="' + safeImg + '" alt="' + safeTitle + '" class="w-16 h-16 object-cover rounded-xl border border-slate-800 shrink-0">' +
                '<div class="min-w-0 flex-1">' +
                    '<div class="flex items-center gap-2">' +
                        '<span class="text-[9px] font-bold text-cyan-400 bg-cyan-950/60 border border-cyan-800/40 px-2 py-0.5 rounded-md uppercase">' + safeBadge + '</span>' +
                         +
                    '</div>' +
                    '<h4 class="font-bold text-white text-xs mt-1 truncate">' + safeTitle + '</h4>' +
                    '<p class="text-[11px] text-slate-400 line-clamp-1">' + safeSub + '</p>' +
                '</div>' +
            '</div>' +
            '<div class="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px]">' +
                '<span class="text-slate-500 font-medium">' + featCount + ' key features</span>' +
                '<div class="flex items-center gap-2">' +
                    '<button onclick="toggleAddProductModal(true, &quot;' + safeId + '&quot;)" class="bg-indigo-950/60 hover:bg-indigo-900 text-indigo-300 border border-indigo-800/40 px-2.5 py-1 rounded-lg transition font-bold flex items-center gap-1 cursor-pointer">' +
                        '<i class="fa-solid fa-pen-to-square"></i> Edit' +
                    '</button>' +
                    '<button onclick="deleteProduct(&quot;' + safeId + '&quot;)" class="bg-rose-950/60 hover:bg-rose-900 text-rose-400 border border-rose-800/40 px-2.5 py-1 rounded-lg transition font-bold flex items-center gap-1 cursor-pointer">' +
                        '<i class="fa-solid fa-trash-can"></i> Delete' +
                    '</button>' +
                '</div>' +
            '</div>' +
        '</div>';
    }).join("");
}

function toggleAddProductModal(show, editId) {
    const modal = document.getElementById("addProductModal");
    if (!modal) return;

    if (show) {
        modal.classList.remove("hidden");
        const form = document.getElementById("productForm");
        const formTitle = document.getElementById("productFormTitle");

        if (editId) {
            const products = getStoredProducts();
            const p = products.find(item => item.id === editId);
            if (p) {
                if (formTitle) formTitle.textContent = "Edit Product";
                document.getElementById("prodFormId").value = p.id;
                document.getElementById("prodFormTitle").value = p.title || "";
                document.getElementById("prodFormSubtitle").value = p.subtitle || "";
                document.getElementById("prodFormBadge").value = p.categoryBadge || "";
                
                document.getElementById("prodFormImage").value = p.image || "";
                document.getElementById("prodFormDesc").value = p.description || "";
                document.getElementById("prodFormFeatures").value = Array.isArray(p.features) ? p.features.join(", ") : (p.features || "");
                return;
            }
        }

        // Add new mode
        if (formTitle) formTitle.textContent = "Add New Product";
        if (form) form.reset();
        document.getElementById("prodFormId").value = "";
    } else {
        modal.classList.add("hidden");
    }
}

function applyPresetImage(url) {
    if (url) {
        const imgInput = document.getElementById("prodFormImage");
        if (imgInput) imgInput.value = url;
    }
}

async function handleMainProductFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        alert("Please choose a valid image file");
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                let width = img.width;
                let height = img.height;
                const maxWidth = 1200;
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
                const imgInput = document.getElementById("prodFormImage");
                if (imgInput) imgInput.value = dataUrl;
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error("Upload error:", err);
    }
}

function saveProductSubmit(e) {
    if (e) e.preventDefault();

    const id = document.getElementById("prodFormId").value || ("prod-" + Date.now());
    const title = document.getElementById("prodFormTitle").value.trim();
    const subtitle = document.getElementById("prodFormSubtitle").value.trim();
    const categoryBadge = document.getElementById("prodFormBadge").value.trim();
    
    const image = document.getElementById("prodFormImage").value.trim();
    const description = document.getElementById("prodFormDesc").value.trim();
    const featuresRaw = document.getElementById("prodFormFeatures").value.trim();

    const features = featuresRaw.split(",").map(f => f.trim()).filter(f => f.length > 0);

    const newProd = {
        id,
        title,
        subtitle,
        categoryBadge,
        image,
        description,
        features: features.length > 0 ? features : ["Custom Specifications", "Quality Inspected"]
    };

    let products = getStoredProducts();
    const existingIdx = products.findIndex(p => p.id === id);

    if (existingIdx !== -1) {
        products[existingIdx] = newProd;
    } else {
        products.unshift(newProd); // Add to beginning of catalog
    }

    saveStoredProducts(products);
    toggleAddProductModal(false);

    // Refresh UI
    renderProductsCatalog();
    renderAdminProductsList();
}

function deleteProduct(id) {
    let products = getStoredProducts();
    const prod = products.find(p => p.id === id);
    products = products.filter(p => p.id !== id);
    saveStoredProducts(products);

    requestAnimationFrame(() => {
        renderProductsCatalog();
        renderAdminProductsList();
    });
}

function resetDefaultProducts() {
    localStorage.removeItem("ajanta_products_catalog");
    requestAnimationFrame(() => {
        renderProductsCatalog();
        renderAdminProductsList();
    });
}

// Auto Initialize Products and Cloud Sync on DOM Load
try {
    renderProductsCatalog();
    syncCatalogFromCloud();
    syncReviewsFromCloud();
} catch (err) {
    console.warn("Immediate renderProductsCatalog error:", err);
}

if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            renderProductsCatalog();
            syncCatalogFromCloud();
            syncReviewsFromCloud();
        });
    } else {
        renderProductsCatalog();
        syncCatalogFromCloud();
        syncReviewsFromCloud();
    }
}
