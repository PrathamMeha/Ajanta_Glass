/**
 * Ajanta Glass - Customer Requirement Portal
 * Interactive Form, Live Calculations, Geolocation, and Real-Time Syncing Script
 * Crafted with premium UX in mind.
 */

// Array to store customer glass specification inputs
if (typeof window.clientSpecsList === 'undefined') window.clientSpecsList = [];
// Hardcoded to submit directly to owner sunny mehta
if (typeof window.MAIN_OWNER_ACCOUNT === 'undefined') window.MAIN_OWNER_ACCOUNT = "sunnymehta123@gmail.com";
if (typeof window.fabricatorUser === 'undefined') window.fabricatorUser = window.MAIN_OWNER_ACCOUNT;

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
    const customApiKey = localStorage.getItem('gemini_api_key') || (typeof window !== 'undefined' ? window.GEMINI_API_KEY : '');
    
    // System instruction prompt
    const systemInstruction = "Your name is Ajanta AI — Lead Architectural Glass & Window Systems Consultant for Ajanta Door & Window Systems (Est. 1976, Sirsa, Haryana, India).\n" +
        "CRITICAL PERSONALITY & IDENTITY RULES:\n" +
        "- Always identify yourself strictly as 'Ajanta AI'. When asked 'Who are you?', 'Who is this?', or 'What is your name?', respond warmly: 'I am Ajanta AI'.\n" +
        "- NEVER say 'I am a language model', 'I am an AI model', 'I am a large language model', or mention Google or AI technology in any way.\n" +
        "- Maintain a friendly, warm, polite, and highly professional tone.\n" +
        "- Provide clear, structured, and expert architectural advice regarding Toughened Glass, DGU Insulated Glass, Laminated Glass, UPVC & Slimline Aluminum Windows, and shower partitions.\n" +
        "- Keep responses clean, concise, and formatted with bullet points and bold headers.";

    if (customApiKey && customApiKey.trim().length > 10) {
        const models = ['gemini-2.5-flash', 'gemini-1.5-flash'];
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
    const query = prompt.toLowerCase();

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
               "• **Glass Pairing:** 6mm Toughened for small/medium windows; 10mm–12mm Toughened or DGU for large span balcony windows.\n\n" +
               "💡 You can configure your exact window dimensions, glass type, and profile colors in our **Ajanta Live Configurator**!";
    }

    if (query.includes('railing') || query.includes('balcony') || query.includes('stair')) {
        return "**Balcony & Staircase Glass Railing Recommendations:**\n\n" +
               "• **Standard Balconies:** 12mm Toughened Glass with SS304 spigots or continuous bottom aluminum profile channel.\n" +
               "• **High-Rise & Commercial Railings:** 13.52mm Laminated Glass (6mm Toughened + 1.52mm PVB + 6mm Toughened).\n" +
               "• **Safety Standard:** Handrail or top profile channel recommended for structural wind loads above 10th floor.\n\n" +
               "💡 Contact Ajanta for custom structural glass railing engineering & load tests!";
    }

    if (query.includes('price') || query.includes('cost') || query.includes('rate') || query.includes('estimate') || query.includes('sqft')) {
        return "**Ajanta Glass & Glazing Price Factors:**\n\n" +
               "Glass rates depend on thickness, glass type, and customized edgework/processing:\n" +
               "• **5mm - 6mm Clear Glass:** Base architectural glazing\n" +
               "• **8mm - 12mm Toughened Glass:** Premium heavy-duty safety glass\n" +
               "• **DGU / Insulated Units:** Double pane thermal/acoustic glass\n" +
               "• **Custom Finishes:** Beveling, frost etching, UV printing, CNC cutouts & hole drilling.\n\n" +
               "💡 **Get an Instant Quote:** Use the **Ajanta Live Quote Configurator** on this page to enter your dimensions and get instant exact itemized calculations!";
    }

    return `**Ajanta Architectural Glass & Window Systems Advice:**\n\n` +
           `For **${escapeHtml(prompt)}**, here are key architectural recommendations:\n\n` +
           `• **Glass Selection:** We supply 5mm to 19mm Toughened Safety Glass, DGU Double Glazed Units, Laminated Safety Glass, and Frosted/Tinted decorative options.\n` +
           `• **Window Profiles:** High-grade UPVC and Slimline Italian Aluminum profiles with multi-point locking hardware.\n` +
           `• **Custom Processing:** CNC shape cutting, hole drilling, cutout processing, UV glass printing, and sandblasting.\n\n` +
           `💡 **Next Steps:** Scroll down to our **Live Configurator** to specify your project dimensions and generate a full itemized quote!`;
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
