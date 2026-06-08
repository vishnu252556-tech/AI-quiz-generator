/* ==========================================================================
   GeoValue AI - California House Price Prediction Dashboard Controller
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Top Bar Live Clock
    initClock();

    // UI Tab Manager
    initTabManager();

    // Variable Input Sliders & Number Boxes Synchronization
    initInputSync();

    // Map Coordinates Preset Shortcuts
    initPresets();

    // Prediction Form Submission Handler
    initPredictionHandler();

    // Load Data for Dashboard (Charts, Tables, Map)
    loadDashboardData();
});

/* ==========================================================================
   Live Header Clock
   ========================================================================== */
function initClock() {
    const timeDisplay = document.getElementById('time-display');
    setInterval(() => {
        const now = new Date();
        timeDisplay.textContent = now.toLocaleTimeString();
    }, 1000);
}

/* ==========================================================================
   Tab Navigation Manager
   ========================================================================== */
let mapInstance = null; // Leaflet map global reference

function initTabManager() {
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabPanels = document.querySelectorAll('.tab-panel');
    const currentTabTitle = document.getElementById('current-tab-title');
    const currentTabDesc = document.getElementById('current-tab-desc');

    const tabMeta = {
        'predictor-tab': {
            title: 'House Price Predictor',
            desc: 'Adjust variables to run the Gradient Boosting Machine Learning model'
        },
        'analytics-tab': {
            title: 'ML Model Analytics',
            desc: 'Performance evaluation, error margins, and feature contribution charts'
        },
        'explorer-tab': {
            title: 'Dataset Explorer',
            desc: 'Browse statistics and sample records from the California Housing dataset'
        },
        'map-tab': {
            title: 'California Spatial Distribution',
            desc: 'Geographic visualization of housing prices and prediction residuals'
        }
    };

    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');

            // Set active button
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Show active panel
            tabPanels.forEach(panel => panel.classList.remove('active'));
            document.getElementById(targetTab).classList.add('active');

            // Update Header Meta
            if (tabMeta[targetTab]) {
                currentTabTitle.textContent = tabMeta[targetTab].title;
                currentTabDesc.textContent = tabMeta[targetTab].desc;
            }

            // Fix Leaflet Map rendering issue when switching to map tab
            if (targetTab === 'map-tab' && mapInstance) {
                setTimeout(() => {
                    mapInstance.invalidateSize();
                }, 100);
            }
        });
    });
}

/* ==========================================================================
   Variable Slider Sync
   ========================================================================== */
function initInputSync() {
    const syncPairs = [
        { slider: 'MedInc', num: 'MedInc_num' },
        { slider: 'HouseAge', num: 'HouseAge_num' },
        { slider: 'AveRooms', num: 'AveRooms_num' },
        { slider: 'AveBedrms', num: 'AveBedrms_num' },
        { slider: 'Population', num: 'Population_num' },
        { slider: 'AveOccup', num: 'AveOccup_num' }
    ];

    syncPairs.forEach(pair => {
        const sliderEl = document.getElementById(pair.slider);
        const numEl = document.getElementById(pair.num);

        if (sliderEl && numEl) {
            // Slider changes -> update number
            sliderEl.addEventListener('input', (e) => {
                numEl.value = e.target.value;
            });

            // Number changes -> update slider
            numEl.addEventListener('input', (e) => {
                let val = parseFloat(e.target.value);
                const min = parseFloat(sliderEl.min);
                const max = parseFloat(sliderEl.max);

                if (isNaN(val)) return;
                
                // Clamp inputs
                if (val < min) val = min;
                if (val > max) val = max;

                sliderEl.value = val;
            });
        }
    });
}

/* ==========================================================================
   Presets Coordinator
   ========================================================================== */
function initPresets() {
    const presetButtons = document.querySelectorAll('.preset-btn');
    const latInput = document.getElementById('Latitude');
    const lngInput = document.getElementById('Longitude');

    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const lat = btn.getAttribute('data-lat');
            const lng = btn.getAttribute('data-lng');

            if (latInput && lngInput) {
                latInput.value = lat;
                lngInput.value = lng;
                
                // Add highlight visual feedback
                btn.style.borderColor = 'var(--color-cyan)';
                setTimeout(() => {
                    btn.style.borderColor = '';
                }, 800);
            }
        });
    });
}

/* ==========================================================================
   ML Model Prediction API caller
   ========================================================================== */
function initPredictionHandler() {
    const form = document.getElementById('prediction-form');
    const predictBtn = document.getElementById('predict-btn');
    const predOutput = document.getElementById('prediction-output');
    const diffAverage = document.getElementById('pred-diff-average');
    const pricePerRoom = document.getElementById('pred-price-per-room');

    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Prepare Inputs
        const formData = {
            MedInc: parseFloat(document.getElementById('MedInc').value),
            HouseAge: parseFloat(document.getElementById('HouseAge').value),
            AveRooms: parseFloat(document.getElementById('AveRooms').value),
            AveBedrms: parseFloat(document.getElementById('AveBedrms').value),
            Population: parseFloat(document.getElementById('Population').value),
            AveOccup: parseFloat(document.getElementById('AveOccup').value),
            Latitude: parseFloat(document.getElementById('Latitude').value),
            Longitude: parseFloat(document.getElementById('Longitude').value)
        };

        // UI Loading State
        predictBtn.disabled = true;
        predictBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Running inference...';
        predOutput.textContent = 'Calculating...';
        predOutput.style.opacity = '0.5';

        try {
            const response = await fetch('/api/predict', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.status === 'success') {
                const predictedVal = result.prediction;
                const averageVal = result.average_price;

                // Animate predicted price output
                animatePriceValue(predOutput, predictedVal);

                // Diff relative to California dataset average
                const diffPercent = ((predictedVal - averageVal) / averageVal) * 100;
                const sign = diffPercent >= 0 ? '+' : '';
                const colorClass = diffPercent >= 0 ? 'text-emerald' : 'text-cyan';
                diffAverage.className = `item-val ${colorClass}`;
                diffAverage.textContent = `${sign}${diffPercent.toFixed(1)}% (${diffPercent >= 0 ? 'Above' : 'Below'} Avg)`;

                // Price per room
                const roomsCount = formData.AveRooms;
                const costPerRoom = predictedVal / roomsCount;
                pricePerRoom.textContent = `$${costPerRoom.toLocaleString(undefined, { maximumFractionDigits: 0 })} / room`;
            } else {
                predOutput.textContent = 'Prediction Error';
                alert('Prediction Error: ' + (result.error || 'Unknown issue'));
            }
        } catch (error) {
            console.error('Failed to run ML inference:', error);
            predOutput.textContent = 'Error';
            alert('Prediction failed. Is Flask server running?');
        } finally {
            predictBtn.disabled = false;
            predictBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Predict Valuation';
            predOutput.style.opacity = '1';
        }
    });
}

function animatePriceValue(element, targetValue) {
    let startTimestamp = null;
    const duration = 800; // ms
    const startValue = 206856; // start from avg baseline or similar
    
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        
        // Easing out quadratic
        const easeProgress = progress * (2 - progress);
        const currentValue = Math.floor(easeProgress * (targetValue - startValue) + startValue);
        
        element.textContent = `$${currentValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            element.textContent = `$${targetValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        }
    };
    
    window.requestAnimationFrame(step);
}

/* ==========================================================================
   Dashboard Data Loading Coordinator
   ========================================================================== */
async function loadDashboardData() {
    try {
        // Fetch Metrics & Charts
        const metricsRes = await fetch('/api/metrics');
        const metricsData = await metricsRes.json();
        
        // Fetch Sample & Stats
        const datasetRes = await fetch('/api/dataset');
        const datasetData = await datasetRes.json();

        // Initialize UI Displays
        renderModelMetrics(metricsData);
        renderCharts(metricsData, datasetData.sample);
        renderDatasetSummary(datasetData.statistics);
        renderDatasetTable(datasetData.sample);
        renderCaliforniaMap(datasetData.sample);

    } catch (e) {
        console.error("Error loading initial dashboard data: ", e);
    }
}

/* ==========================================================================
   Inference Model Metrics Cards Injector
   ========================================================================== */
function renderModelMetrics(data) {
    const activeEngineText = document.getElementById('active-engine-text');
    if (activeEngineText) {
        activeEngineText.textContent = data.best_model;
    }

    const bestModelName = data.best_model;
    const bestMetrics = data.models[bestModelName];

    if (bestMetrics) {
        document.getElementById('best-r2-val').textContent = `${(bestMetrics.r2 * 100).toFixed(2)}%`;
        document.getElementById('best-mae-val').textContent = `$${bestMetrics.mae_dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
        document.getElementById('best-rmse-val').textContent = `$${bestMetrics.rmse_dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    }
}

/* ==========================================================================
   Chart.js Render Pipeline
   ========================================================================== */
function renderCharts(metricsData, sampleData) {
    // Global chart theme configurations
    Chart.defaults.color = '#9ca3af';
    Chart.defaults.font.family = "'Inter', sans-serif";

    // 1. Chart - Feature Importances
    const features = Object.keys(metricsData.feature_importances);
    const importances = Object.values(metricsData.feature_importances);
    
    // User-friendly mappings for features
    const labelMapping = {
        'MedInc': 'Median Income',
        'HouseAge': 'Median House Age',
        'AveRooms': 'Average Rooms',
        'AveBedrms': 'Average Bedrooms',
        'Population': 'Population',
        'AveOccup': 'Avg Occupancy',
        'Latitude': 'Latitude Location',
        'Longitude': 'Longitude Location'
    };
    const friendlyLabels = features.map(f => labelMapping[f] || f);

    const featCtx = document.getElementById('featureImportanceChart').getContext('2d');
    new Chart(featCtx, {
        type: 'bar',
        data: {
            labels: friendlyLabels,
            datasets: [{
                label: 'Relative Importance Weight',
                data: importances,
                backgroundColor: 'rgba(140, 82, 255, 0.65)',
                borderColor: '#8c52ff',
                borderWidth: 1.5,
                borderRadius: 4,
                hoverBackgroundColor: 'rgba(140, 82, 255, 0.85)'
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: { display: true, text: 'Importance Weight (0.0 to 1.0)' }
                },
                y: {
                    grid: { display: false }
                }
            }
        }
    });

    // 2. Chart - Model Comparisons (R2 Scores)
    const modelNames = Object.keys(metricsData.models);
    const r2Scores = modelNames.map(m => metricsData.models[m].r2 * 100);

    const compCtx = document.getElementById('modelComparisonChart').getContext('2d');
    new Chart(compCtx, {
        type: 'bar',
        data: {
            labels: modelNames,
            datasets: [{
                label: 'R² Score Accuracy',
                data: r2Scores,
                backgroundColor: [
                    'rgba(255, 255, 255, 0.1)',
                    'rgba(0, 242, 254, 0.55)',
                    'rgba(16, 185, 129, 0.65)'
                ],
                borderColor: [
                    'rgba(255, 255, 255, 0.3)',
                    '#00f2fe',
                    '#10b981'
                ],
                borderWidth: 1.5,
                borderRadius: 6,
                barThickness: 32
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: { display: true, text: 'R² Score Accuracy (%)' },
                    min: 0,
                    max: 100
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // 3. Chart - Actual vs Predicted Scatter
    // Sort sample items by actual price to show a clean sorted line vs scatter points
    const sortedSample = [...sampleData].sort((a, b) => a.ActualPrice - b.ActualPrice);
    
    // Reduce points count slightly to 150 points for scatter plot neatness
    const stepSize = Math.floor(sortedSample.length / 150) || 1;
    const chartPoints = [];
    
    for (let i = 0; i < sortedSample.length; i += stepSize) {
        chartPoints.push({
            x: sortedSample[i].ActualPrice * 100000,
            y: sortedSample[i].PredictedPrice * 100000
        });
    }

    const scatCtx = document.getElementById('actualVsPredictedChart').getContext('2d');
    new Chart(scatCtx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Sample Prediction Points',
                    data: chartPoints,
                    backgroundColor: 'rgba(0, 242, 254, 0.6)',
                    borderColor: 'rgba(0, 242, 254, 0.1)',
                    pointRadius: 4,
                    hoverRadius: 6
                },
                {
                    label: 'Perfect Match (Target Line)',
                    data: [
                        { x: 15000, y: 15000 },
                        { x: 500000, y: 500000 }
                    ],
                    type: 'line',
                    borderColor: 'rgba(140, 82, 255, 0.8)',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { boxWidth: 12 }
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: { display: true, text: 'Actual Price ($)' },
                    min: 0,
                    max: 550000
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    title: { display: true, text: 'Predicted Price ($)' },
                    min: 0,
                    max: 550000
                }
            }
        }
    });
}

/* ==========================================================================
   Dataset statistics carousel summary cards
   ========================================================================== */
function renderDatasetSummary(statistics) {
    const grid = document.getElementById('stats-summary-grid');
    if (!grid) return;

    grid.innerHTML = '';

    const labelMapping = {
        'MedInc': { name: 'Median Income', unit: '$10k/yr' },
        'HouseAge': { name: 'Median House Age', unit: 'yrs' },
        'AveRooms': { name: 'Average Rooms', unit: 'rooms' },
        'AveBedrms': { name: 'Average Bedrooms', unit: 'bedrms' },
        'Population': { name: 'Block Population', unit: 'residents' },
        'AveOccup': { name: 'Avg Occupancy', unit: 'people' },
        'Latitude': { name: 'Latitude', unit: 'deg N' },
        'Longitude': { name: 'Longitude', unit: 'deg E' },
        'MedHouseVal': { name: 'Median Price', unit: '$100k blocks' } // wait target in df is MedHouseVal or similar, california frame target name
    };

    // Find actual target name in stats
    let targetKey = null;
    for (let k of Object.keys(statistics)) {
        if (!labelMapping[k]) {
            targetKey = k;
        }
    }
    if (targetKey) {
        labelMapping[targetKey] = { name: 'Median House Value', unit: '$100k blocks' };
    }

    Object.keys(statistics).forEach(key => {
        const item = statistics[key];
        const label = labelMapping[key] || { name: key, unit: '' };
        
        // Format values nicely
        const formatNum = (v) => {
            if (key === 'Population') return Math.round(v).toLocaleString();
            return v.toFixed(2);
        };

        const card = document.createElement('div');
        card.className = 'stat-metric-badge';
        card.innerHTML = `
            <h4>${label.name}</h4>
            <div class="stat-values-list">
                <div class="stat-row"><span>Mean</span><strong>${formatNum(item.mean)} ${label.unit}</strong></div>
                <div class="stat-row"><span>Median</span><strong>${formatNum(item.median)} ${label.unit}</strong></div>
                <div class="stat-row"><span>Range</span><strong>${formatNum(item.min)} - ${formatNum(item.max)}</strong></div>
                <div class="stat-row"><span>Std Dev</span><strong>${formatNum(item.std)}</strong></div>
            </div>
        `;
        grid.appendChild(card);
    });
}

/* ==========================================================================
   Dataset table pagination & search controller
   ========================================================================== */
function renderDatasetTable(sampleData) {
    const tableBody = document.getElementById('sample-table-body');
    const tableSearch = document.getElementById('table-search');
    const pagPrev = document.getElementById('pag-prev');
    const pagNext = document.getElementById('pag-next');
    const pagStart = document.getElementById('pag-start');
    const pagEnd = document.getElementById('pag-end');
    const pagTotal = document.getElementById('pag-total');
    const pagNumbers = document.getElementById('pag-numbers-container');

    if (!tableBody) return;

    let filteredData = [...sampleData];
    let currentPage = 1;
    const itemsPerPage = 10;

    const renderTablePage = () => {
        tableBody.innerHTML = '';
        
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);

        if (filteredData.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="11" class="loading-state">No matching housing records found</td></tr>`;
            pagStart.textContent = 0;
            pagEnd.textContent = 0;
            pagTotal.textContent = 0;
            pagPrev.disabled = true;
            pagNext.disabled = true;
            pagNumbers.innerHTML = '';
            return;
        }

        // Populate table rows
        for (let i = startIndex; i < endIndex; i++) {
            const row = filteredData[i];
            const actualUSD = row.ActualPrice * 100000;
            const predUSD = row.PredictedPrice * 100000;
            
            // Percentage error
            const errPercent = ((predUSD - actualUSD) / actualUSD) * 100;
            const errBadgeClass = Math.abs(errPercent) <= 15 ? 'error-low' : 'error-high';
            const sign = errPercent >= 0 ? '+' : '';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${i + 1}</td>
                <td>$${(row.MedInc * 10).toFixed(1)}k</td>
                <td>${Math.round(row.HouseAge)} yrs</td>
                <td>${row.AveRooms.toFixed(1)}</td>
                <td>${row.AveBedrms.toFixed(1)}</td>
                <td>${Math.round(row.Population).toLocaleString()}</td>
                <td>${row.AveOccup.toFixed(1)}</td>
                <td class="coord-cell">${row.Latitude.toFixed(2)}, ${row.Longitude.toFixed(2)}</td>
                <td class="price-cell">$${actualUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td class="price-cell">$${predUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                <td><span class="badge-error ${errBadgeClass}">${sign}${errPercent.toFixed(1)}%</span></td>
            `;
            tableBody.appendChild(tr);
        }

        // Update pagination numbers info
        pagStart.textContent = startIndex + 1;
        pagEnd.textContent = endIndex;
        pagTotal.textContent = filteredData.length;

        // Button statuses
        pagPrev.disabled = currentPage === 1;
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        pagNext.disabled = currentPage === totalPages || totalPages === 0;

        // Render page indicator buttons
        renderPaginationButtons(totalPages);
    };

    const renderPaginationButtons = (totalPages) => {
        pagNumbers.innerHTML = '';
        
        let startPage = Math.max(1, currentPage - 1);
        let endPage = Math.min(totalPages, startPage + 2);
        
        if (endPage - startPage < 2 && totalPages > 2) {
            startPage = Math.max(1, endPage - 2);
        }

        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `pag-num ${i === currentPage ? 'active' : ''}`;
            btn.textContent = i;
            btn.addEventListener('click', () => {
                currentPage = i;
                renderTablePage();
            });
            pagNumbers.appendChild(btn);
        }
    };

    // Table Search Filter Logic
    tableSearch.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        if (query === '') {
            filteredData = [...sampleData];
        } else {
            filteredData = sampleData.filter(row => {
                // Searchable columns: Age, Population, coordinates, price matches
                const actualUSD = (row.ActualPrice * 100000).toFixed(0);
                const predUSD = (row.PredictedPrice * 100000).toFixed(0);
                
                return (
                    row.Latitude.toFixed(2).includes(query) ||
                    row.Longitude.toFixed(2).includes(query) ||
                    Math.round(row.HouseAge).toString().includes(query) ||
                    Math.round(row.Population).toString().includes(query) ||
                    actualUSD.includes(query) ||
                    predUSD.includes(query)
                );
            });
        }
        
        currentPage = 1;
        renderTablePage();
    });

    // Pagination Click Bindings
    pagPrev.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTablePage();
        }
    });

    pagNext.addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTablePage();
        }
    });

    // Initial page load
    renderTablePage();
}

/* ==========================================================================
   Leaflet Geographic Map Render System
   ========================================================================== */
function renderCaliforniaMap(sampleData) {
    const mapContainer = document.getElementById('california-map');
    if (!mapContainer) return;

    // Center on California coordinates
    const caCenter = [37.2, -119.5];
    const initialZoom = 6;

    // Initialize map with custom options
    mapInstance = L.map('california-map', {
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: false
    }).setView(caCenter, initialZoom);

    // Dark-mode Map Tiles from CARTO
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 18,
        minZoom: 5
    }).addTo(mapInstance);

    // Color gradient mapping based on house prices
    // CA values range from ~$15k to $500k+
    const getColor = (price) => {
        const priceUSD = price * 100000;
        if (priceUSD < 100000) return '#3b82f6'; // Deep blue for cheap blocks
        if (priceUSD < 200000) return '#10b981'; // Green for below avg
        if (priceUSD < 350000) return '#f59e0b'; // Amber for upper-middle
        return '#ef4444'; // Radiant Red for luxury blocks
    };

    // Point selector details container reference
    const pointDetailsDisplay = document.getElementById('point-details-display');
    const pointPlaceholder = document.querySelector('.map-selected-point-card .placeholder-text');

    const mCoord = document.getElementById('m-coord');
    const mIncome = document.getElementById('m-income');
    const mAge = document.getElementById('m-age');
    const mRooms = document.getElementById('m-rooms');
    const mActual = document.getElementById('m-actual');
    const mPredicted = document.getElementById('m-predicted');
    const mResidual = document.getElementById('m-residual');

    // Loop through sample rows and plot circle dots
    sampleData.forEach((row) => {
        const markerColor = getColor(row.ActualPrice);
        const actualUSD = row.ActualPrice * 100000;
        const predUSD = row.PredictedPrice * 100000;
        const residualUSD = predUSD - actualUSD;
        const residualPercent = (residualUSD / actualUSD) * 100;

        const marker = L.circleMarker([row.Latitude, row.Longitude], {
            radius: 5,
            fillColor: markerColor,
            color: '#080c14',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.75
        }).addTo(mapInstance);

        // Bind standard popup
        marker.bindPopup(`
            <div style="font-family: 'Inter', sans-serif; font-size: 11px; color:#f3f4f6;">
                <b style="color:var(--color-cyan)">CA Coordinates:</b> ${row.Latitude.toFixed(3)}, ${row.Longitude.toFixed(3)}<br/>
                <b>Actual Price:</b> $${actualUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                <b>Predicted:</b> $${predUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}<br/>
                <b>Deviation Error:</b> ${residualPercent >= 0 ? '+' : ''}${residualPercent.toFixed(1)}%
            </div>
        `);

        // Circle marker click handles loading item stats details
        marker.on('click', () => {
            // Hide placeholder text
            if (pointPlaceholder) pointPlaceholder.classList.add('hidden');
            if (pointDetailsDisplay) pointDetailsDisplay.classList.remove('hidden');

            // Populate coordinates card info
            mCoord.textContent = `${row.Latitude.toFixed(4)}°, ${row.Longitude.toFixed(4)}°`;
            mIncome.textContent = `$${(row.MedInc * 10).toFixed(1)}k / year`;
            mAge.textContent = `${Math.round(row.HouseAge)} years`;
            mRooms.textContent = `${row.AveRooms.toFixed(1)} rooms`;
            
            mActual.textContent = `$${actualUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            mPredicted.textContent = `$${predUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            
            const sign = residualUSD >= 0 ? '+' : '';
            const residualColor = Math.abs(residualPercent) <= 15 ? 'var(--color-emerald)' : 'var(--color-red)';
            mResidual.textContent = `${sign}$${residualUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${sign}${residualPercent.toFixed(1)}%)`;
            mResidual.style.color = residualColor;
        });
    });
}
