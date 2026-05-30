/**
 * Ajanta Glass - Customer Requirement Portal
 * Interactive Form, Live Calculations, Geolocation, and Real-Time Syncing Script
 * Crafted with premium UX in mind.
 */

// Array to store customer glass specification inputs
let clientSpecsList = [];
// Hardcoded to submit directly to owner sunny mehta
const MAIN_OWNER_ACCOUNT = "sunnymehta123@gmail.com";
let fabricatorUser = MAIN_OWNER_ACCOUNT;

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
                const country = ipData.country_name || "";
                const zip = ipData.postal || "";
                
                const addr = [city, region, country, zip].filter(Boolean).join(', ');
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

        // TIER 1: BigDataCloud Reverse Geocoding (Fast, CORS, Keyless)
        try {
            const bdcResponse = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
            if (bdcResponse.ok) {
                const bdcData = await bdcResponse.json();
                let parts = [];
                
                if (bdcData.localityInfo && bdcData.localityInfo.informative) {
                    bdcData.localityInfo.informative.forEach(inf => {
                        if (inf.name && !parts.includes(inf.name) && inf.order > 2) {
                            parts.unshift(inf.name);
                        }
                    });
                }
                
                if (bdcData.locality && !parts.includes(bdcData.locality)) {
                    parts.push(bdcData.locality);
                }
                if (bdcData.principalSubdivision && !parts.includes(bdcData.principalSubdivision)) {
                    parts.push(bdcData.principalSubdivision);
                }
                if (bdcData.countryName && !parts.includes(bdcData.countryName)) {
                    parts.push(bdcData.countryName);
                }

                if (parts.length > 0) {
                    resolvedAddr = parts.join(", ");
                }
            }
        } catch (bdcErr) {
            console.error("BigDataCloud geocoder failed, trying Nominatim:", bdcErr);
        }

        // TIER 2: OpenStreetMap Nominatim Fallback
        if (!resolvedAddr) {
            try {
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.display_name) {
                        resolvedAddr = data.display_name;
                    }
                }
            } catch (err) {
                console.error("Nominatim service error:", err);
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

    // Init estimate calculations
    calculateLiveEstimate();
    
    // Attach event listeners for custom input triggers dynamically
    const fieldsToTrack = [
        'customMaterialName', 'customMaterialPrice',
        'customThicknessName', 'customThicknessPrice',
        'customCategoryInput'
    ];
    fieldsToTrack.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', calculateLiveEstimate);
        }
    });
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
    calculateLiveEstimate();
}

function handleGlassTypeChange() {
    const select = document.getElementById('itemGlassType');
    const customContainer = document.getElementById('customMaterialContainer');
    if (select.value === 'CUSTOM_MATERIAL') {
        customContainer.classList.remove('hidden');
    } else {
        customContainer.classList.add('hidden');
    }
    calculateLiveEstimate();
}

function handleThicknessChange() {
    const select = document.getElementById('itemThickness');
    const customContainer = document.getElementById('customThicknessContainer');
    if (select.value === 'CUSTOM_THICKNESS') {
        customContainer.classList.remove('hidden');
    } else {
        customContainer.classList.add('hidden');
    }
    calculateLiveEstimate();
}

// Live Dynamic Cost Estimator math using standard rules:
// Size rounding to nearest inch, area (sqft) calculation, base rate, thickness premiums, edgework linear surcharges
function getSpecPricingDetails() {
    // Category title lookup
    const catSelect = document.getElementById('itemCategory');
    let category = catSelect.value;
    if (category === 'CUSTOM_ITEM') {
        category = document.getElementById('customCategoryInput').value.trim() || 'Custom Item';
    }

    // Glass type pricing
    const glassSelect = document.getElementById('itemGlassType');
    let glassName = glassSelect.value;
    let glassRate = 80.0;
    if (glassName === 'CUSTOM_MATERIAL') {
        glassName = document.getElementById('customMaterialName').value.trim() || 'Custom Material';
        glassRate = parseFloat(document.getElementById('customMaterialPrice').value) || 0.0;
    } else {
        const opt = glassSelect.options[glassSelect.selectedIndex];
        glassRate = parseFloat(opt.getAttribute('data-price')) || 80.0;
    }

    // Thickness pricing premium
    const thickSelect = document.getElementById('itemThickness');
    let thicknessName = thickSelect.value;
    let thicknessPremium = 0.0;
    if (thicknessName === 'CUSTOM_THICKNESS') {
        thicknessName = document.getElementById('customThicknessName').value.trim() || 'Custom Thickness';
        thicknessPremium = parseFloat(document.getElementById('customThicknessPrice').value) || 0.0;
    } else {
        const opt = thickSelect.options[thickSelect.selectedIndex];
        thicknessPremium = parseFloat(opt.getAttribute('data-price')) || 0.0;
    }

    // Edgework pricing
    const edgeSelect = document.getElementById('itemEdgework');
    const edgeName = edgeSelect.value;
    const optEdge = edgeSelect.options[edgeSelect.selectedIndex];
    const edgePremiumInch = parseFloat(optEdge.getAttribute('data-price')) || 0.0;

    const width = parseFloat(document.getElementById('itemWidth').value) || 0.0;
    const height = parseFloat(document.getElementById('itemHeight').value) || 0.0;
    const qty = parseInt(document.getElementById('itemQty').value) || 1;

    return {
        category,
        glassName,
        glassRate,
        thicknessName,
        thicknessPremium,
        edgeName,
        edgePremiumInch,
        width,
        height,
        qty
    };
}

// Round up to nearest integer (standard ERP requirement rounding)
function roundGlassDimension(val) {
    return Math.ceil(val);
}

function calculateLiveEstimate() {
    const p = getSpecPricingDetails();

    if (p.width > 0 && p.height > 0) {
        // Round up dimensions like the ERP math does internally
        const rW = roundGlassDimension(p.width);
        const rH = roundGlassDimension(p.height);
        const sqFt = (rW * rH) / 144.0;
        
        // Edgework in running feet
        const runningFeet = (2.0 * (rW + rH)) / 12.0;
        // Running feet price = linear inch rate * 12
        const edgeworkCost = runningFeet * (p.edgePremiumInch * 12);
        
        // Material unit price = sqft * (glassRate + thicknessPremium)
        const materialCost = sqFt * (p.glassRate + p.thicknessPremium);
        
        const unitPrice = materialCost + edgeworkCost;
        const totalPrice = unitPrice * p.qty;

        document.getElementById('liveEstSummary').innerHTML = 
            `<strong class="text-white">${p.glassName} (${p.thicknessName})</strong> with <strong class="text-white">${p.edgeName}</strong>`;
        
        document.getElementById('liveEstDims').innerText = 
            `Sizing Math: ${rW}" x ${rH}" rounded (${sqFt.toFixed(2)} SqFt) • ${runningFeet.toFixed(1)} RF edge length`;
        
        document.getElementById('liveEstPrice').innerText = `₹${totalPrice.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    } else {
        document.getElementById('liveEstSummary').innerHTML = `Type specs & dimensions to start...`;
        document.getElementById('liveEstDims').innerText = "Supports millimeter, feet or standard inches auto rounding.";
        document.getElementById('liveEstPrice').innerText = "₹0.00";
    }
}

function addSpecLineItem() {
    const p = getSpecPricingDetails();

    if (p.width <= 0 || p.height <= 0) {
        alert("Please specify positive width and height dimensions.");
        return;
    }

    // Dimension math
    const rW = roundGlassDimension(p.width);
    const rH = roundGlassDimension(p.height);
    const sqFt = (rW * rH) / 144.0;
    const runningFeet = (2.0 * (rW + rH)) / 12.0;

    const edgeworkCost = runningFeet * (p.edgePremiumInch * 12);
    const materialCost = sqFt * (p.glassRate + p.thicknessPremium);
    const unitPrice = materialCost + edgeworkCost;

    // Pack clean detailed item description for the owner's app
    const fullSpecDetails = `${p.category} [${p.glassName}, ${p.thicknessName}, ${p.edgeName}]`;

    const itemSpec = {
        id: `spec-${Date.now()}-${Math.floor(Math.random()*100)}`,
        name: fullSpecDetails,
        width: p.width,
        height: p.height,
        qty: p.qty,
        rate: parseFloat(unitPrice.toFixed(2))
    };

    clientSpecsList.push(itemSpec);
    renderSpecLinesTable();

    // Reset size inputs
    document.getElementById('itemWidth').value = '';
    document.getElementById('itemHeight').value = '';
    document.getElementById('itemQty').value = '1';
    
    // Recalculate
    calculateLiveEstimate();
}

function removeSpecLineItem(id) {
    clientSpecsList = clientSpecsList.filter(item => item.id !== id);
    renderSpecLinesTable();
}

function renderSpecLinesTable() {
    const container = document.getElementById('specItemsContainer');
    const tbody = document.getElementById('specItemsBody');
    tbody.innerHTML = '';

    if (clientSpecsList.length === 0) {
        container.classList.add('hidden');
    } else {
        container.classList.remove('hidden');
        clientSpecsList.forEach(item => {
            tbody.innerHTML += `
                <tr class="border-b border-slate-800/60 hover:bg-slate-900/40 animate-slide-in">
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
                </tr>
            `;
        });
    }
}

async function submitForm(event) {
    event.preventDefault();
    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fa fa-circle-notch animate-spin"></i> <span>Sending Specifications...</span>`;

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
        requirements: note || "Custom glass or window panel size specs",
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
        btn.innerHTML = `<i class="fa fa-paper-plane"></i> <span>Submit Sizing to Sunny Mehta</span>`;
    }
}

function closeSuccessModal() {
    document.getElementById('successModal').classList.add('hidden');
}
