import { processOCRWithSarvam } from './sarvamOCR.js';

class EnhancedMSASystem {
    constructor() {
        this.currentPage = 'dashboard';
        this.maps = { mini: null, main: null };
        this.layers = {
            maritimeBoundary: null,
            vessels: L.layerGroup(),
            patrol: L.layerGroup(),
            exercise: L.layerGroup(),
            piracy: L.layerGroup(),
            checkpoints: L.layerGroup()
        };
        this.vesselMarkers = {};
        this.checkpointMarkers = {};
        this.regionPolygons = { patrol: [], exercise: [] };
        this.data = {
            vessels: [],
            alerts: [],
            uploadHistory: [],
            checkpoints: [],
            patrolAreas: [],
            exerciseAreas: []
        };
        this.db = null;
        this.dbName = 'msa_data.db';
        this.dbVersion = 1;
        this.apiKey = localStorage.getItem('grok_api_key') || '';

        // Indian 200-NM Maritime Boundary (Complete)
        this.maritimeBoundary = [
            [25, 64.5],
            [15.0, 64.5],
            [5.0, 69.5],
            [4.0, 76.0],
            [4.0, 84.0],
            [6.0, 87.5],
            [15.0, 93.0],
            [21.5, 90.0]
        ];
        
        // Smooth the boundary for better visualization
        this.smoothedBoundary = this.smoothBoundary(this.maritimeBoundary, 300);

        // Piracy areas
        this.piracyAreas = [
            { bounds: [[10, 43], [15, 53]], tooltip: "Gulf of Aden" },
            { bounds: [[0, 65], [5, 70]], tooltip: "Arabian Sea near Horn of Africa" },
            { bounds: [[0, 97], [5, 102]], tooltip: "Malacca Strait" }
        ];

        this.initDB().then(() => {
            this.loadDataFromDB().then(() => {
                this.init();
            });
        });
    }

    smoothBoundary(points, numPoints) {
        // Interpolate points along the boundary for smoother visualization
        if (points.length < 2) return points;
        
        const smoothed = [];
        const totalSegments = points.length - 1;
        const pointsPerSegment = Math.floor(numPoints / totalSegments);
        
        for (let i = 0; i < points.length - 1; i++) {
            const [lat1, lon1] = points[i];
            const [lat2, lon2] = points[i + 1];
            
            for (let j = 0; j < pointsPerSegment; j++) {
                const t = j / pointsPerSegment;
                const lat = lat1 + (lat2 - lat1) * t;
                const lon = lon1 + (lon2 - lon1) * t;
                smoothed.push([lat, lon]);
            }
        }
        
        // Add the last point
        smoothed.push(points[points.length - 1]);
        
        return smoothed;
    }

    async initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            request.onerror = (event) => reject(event.target.error);
            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };
            request.onupgradeneeded = (event) => {
                this.db = event.target.result;
                if (!this.db.objectStoreNames.contains('data')) {
                    this.db.createObjectStore('data', { keyPath: 'key' });
                }
            };
        });
    }
    smoothBoundary(points, numPoints) {
        // Interpolate points along the boundary for smoother visualization
        if (points.length < 2) return points;

        const smoothed = [];
        const totalSegments = points.length - 1;
        const pointsPerSegment = Math.floor(numPoints / totalSegments);

        for (let i = 0; i < points.length - 1; i++) {
            const [lat1, lon1] = points[i];
            const [lat2, lon2] = points[i + 1];

            for (let j = 0; j < pointsPerSegment; j++) {
                const t = j / pointsPerSegment;
                const lat = lat1 + (lat2 - lat1) * t;
                const lon = lon1 + (lon2 - lon1) * t;
                smoothed.push([lat, lon]);
            }
        }

        // Add the last point
        smoothed.push(points[points.length - 1]);

        return smoothed;
    }



    async saveDataToDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['data'], 'readwrite');
            const store = transaction.objectStore('data');
            const request = store.put({ key: 'msa_data', value: this.formatDataToText() });
            request.onsuccess = resolve;
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async loadDataFromDB() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['data'], 'readonly');
            const store = transaction.objectStore('data');
            const request = store.get('msa_data');
            request.onsuccess = (event) => {
                const result = event.target.result;
                if (result) {
                    this.data = this.parseTextData(result.value);
                }
                resolve();
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    formatDataToText() {
        let text = '=== Maritime Situational Awareness Data ===\n';
        text += '\n[Vessels]\n';
        this.data.vessels.forEach(vessel => {
            text += `ID: ${vessel.id}, Name: ${vessel.name}, Type: ${vessel.vesselType}, Lat: ${vessel.lat}, Lon: ${vessel.lon}, Speed: ${vessel.speed}, Course: ${vessel.course}, Friendly: ${vessel.isFriendly}, Flag: ${vessel.flag || 'Unknown'}, Source: ${vessel.source || 'Unknown'}, Pennant/IMO: ${vessel.pennantIMO || 'Unknown'}, Registry: ${vessel.registry || 'Unknown'}\n`;
        });
        text += '\n[Checkpoints]\n';
        this.data.checkpoints.forEach(checkpoint => {
            text += `Name: ${checkpoint.name}, Lat: ${checkpoint.lat}, Lon: ${checkpoint.lon}, Source: ${checkpoint.source || 'Unknown'}\n`;
        });
        text += '\n[Patrol Areas]\n';
        this.data.patrolAreas.forEach(area => {
            text += `Name: ${area.tooltip}, Coordinates: ${JSON.stringify(area.coords)}, Source: ${area.source || 'Unknown'}\n`;
        });
        text += '\n[Exercise Areas]\n';
        this.data.exerciseAreas.forEach(area => {
            text += `Name: ${area.tooltip}, Coordinates: ${JSON.stringify(area.coords)}, Source: ${area.source || 'Unknown'}\n`;
        });
        text += '\n[Alerts]\n';
        this.data.alerts.filter(alert => !alert.autoGenerated).forEach(alert => {
            text += `ID: ${alert.id}, Message: ${alert.message}, Priority: ${alert.priority}, Lat: ${alert.lat || 'N/A'}, Lon: ${alert.lon || 'N/A'}, Timestamp: ${alert.timestamp}, Source: ${alert.source || 'Unknown'}, VesselId: ${alert.vesselId || 'N/A'}\n`;
        });
        text += '\n[Upload History]\n';
        this.data.uploadHistory.forEach(upload => {
            text += `File: ${upload.file}, Timestamp: ${upload.timestamp}\n`;
        });
        return text;
    }

    parseTextData(text) {
        const data = {
            vessels: [],
            alerts: [],
            uploadHistory: [],
            checkpoints: [],
            patrolAreas: [],
            exerciseAreas: []
        };
        const sections = text.split(/\[(\w+\s*\w*)\]/);
        for (let i = 1; i < sections.length; i += 2) {
            const sectionName = sections[i].trim();
            const sectionContent = sections[i + 1].trim().split('\n');
            if (sectionName === 'Vessels') {
                sectionContent.forEach(line => {
                    if (line) {
                        const fields = line.match(/ID: ([^,]+), Name: ([^,]+), Type: ([^,]+), Lat: ([^,]+), Lon: ([^,]+), Speed: ([^,]+), Course: ([^,]+), Friendly: ([^,]+), Flag: ([^,]+), Source: ([^,]+), Pennant\/IMO: ([^,]+), Registry: ([^,]+)/);
                        if (fields) {
                            data.vessels.push({
                                id: fields[1].trim(),
                                name: fields[2].trim(),
                                vesselType: fields[3].trim(),
                                lat: parseFloat(fields[4]),
                                lon: parseFloat(fields[5]),
                                speed: parseFloat(fields[6]),
                                course: parseFloat(fields[7]),
                                isFriendly: fields[8].trim() === 'true',
                                flag: fields[9].trim(),
                                source: fields[10].trim(),
                                pennantIMO: fields[11].trim(),
                                registry: fields[12].trim()
                            });
                        }
                    }
                });
            } else if (sectionName === 'Checkpoints') {
                sectionContent.forEach(line => {
                    if (line) {
                        const fields = line.match(/Name: ([^,]+), Lat: ([^,]+), Lon: ([^,]+), Source: ([^,]+)/);
                        if (fields) {
                            data.checkpoints.push({
                                name: fields[1].trim(),
                                lat: parseFloat(fields[2]),
                                lon: parseFloat(fields[3]),
                                source: fields[4].trim()
                            });
                        }
                    }
                });
            } else if (sectionName === 'Patrol Areas') {
                sectionContent.forEach(line => {
                    if (line) {
                        const fields = line.match(/Name: ([^,]+), Coordinates: (\[.*?\]), Source: ([^,]+)/);
                        if (fields) {
                            data.patrolAreas.push({
                                tooltip: fields[1].trim(),
                                coords: JSON.parse(fields[2]),
                                source: fields[3].trim()
                            });
                        }
                    }
                });
            } else if (sectionName === 'Exercise Areas') {
                sectionContent.forEach(line => {
                    if (line) {
                        const fields = line.match(/Name: ([^,]+), Coordinates: (\[.*?\]), Source: ([^,]+)/);
                        if (fields) {
                            data.exerciseAreas.push({
                                tooltip: fields[1].trim(),
                                coords: JSON.parse(fields[2]),
                                source: fields[3].trim()
                            });
                        }
                    }
                });
            } else if (sectionName === 'Alerts') {
                sectionContent.forEach(line => {
                    if (line) {
                        const fields = line.match(/ID: ([^,]+), Message: ([^,]+), Priority: ([^,]+), Lat: ([^,]+), Lon: ([^,]+), Timestamp: ([^,]+), Source: ([^,]+), VesselId: ([^,]+)/);
                        if (fields) {
                            data.alerts.push({
                                id: fields[1].trim(),
                                message: fields[2].trim(),
                                priority: fields[3].trim(),
                                lat: fields[4].trim() === 'N/A' ? null : parseFloat(fields[4]),
                                lon: fields[5].trim() === 'N/A' ? null : parseFloat(fields[5]),
                                timestamp: fields[6].trim(),
                                source: fields[7].trim(),
                                vesselId: fields[8].trim() === 'N/A' ? null : fields[8].trim()
                            });
                        }
                    }
                });
            } else if (sectionName === 'Upload History') {
                sectionContent.forEach(line => {
                    if (line) {
                        const fields = line.match(/File: ([^,]+), Timestamp: ([^,]+)/);
                        if (fields) {
                            data.uploadHistory.push({
                                file: fields[1].trim(),
                                timestamp: fields[2].trim()
                            });
                        }
                    }
                });
            }
        }
        return data;
    }

    async init() {
        this.initMaps();
        this.setupEventListeners();
        await this.processProvidedData();
        this.updateAllUI();
        this.generateAlerts();
    }

    initMaps() {
        const worldBounds = [[-90, -180], [90, 180]];
        
        // Professional Satellite Map - Esri World Imagery
        const satelliteTiles = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
        
        this.maps.mini = L.map('dashboard-mini-map', {
            zoomControl: false,
            attributionControl: false,
            maxBounds: worldBounds,
            maxBoundsViscosity: 1.0,
            worldCopyJump: false
        }).setView([11, 82], 5);
        L.tileLayer(satelliteTiles, {
            attribution: 'Tiles &copy; Esri',
            noWrap: true,
            maxZoom: 18
        }).addTo(this.maps.mini);

        this.maps.main = L.map('main-map', {
            zoomControl: true,
            attributionControl: true,
            maxBounds: worldBounds,
            maxBoundsViscosity: 1.0,
            worldCopyJump: false
        }).setView([11, 82], 5);
        L.tileLayer(satelliteTiles, {
            attribution: 'Tiles &copy; Esri',
            noWrap: true,
            maxZoom: 18
        }).addTo(this.maps.main);

        // Add Indian 200-NM Maritime Boundary
        this.layers.maritimeBoundary = L.polyline(this.smoothedBoundary, {
            color: '#0066cc',
            weight: 2,
            opacity: 0.8,
            dashArray: '5, 5'
        }).bindTooltip("India 200-NM Maritime Boundary");

        this.piracyAreas.forEach(area => {
            L.rectangle(area.bounds, { color: '#dc3545', weight: 2, opacity: 0.7, fillOpacity: 0.2 })
                .bindTooltip(area.tooltip).addTo(this.layers.piracy);
        });

        // Add maritime boundary to both maps
        this.layers.maritimeBoundary.addTo(this.maps.mini);
        this.layers.maritimeBoundary.addTo(this.maps.main);
        
        // Add other layers
        Object.values(this.layers).forEach(layer => {
            if (layer !== this.layers.maritimeBoundary) {
                layer.addTo(this.maps.mini);
                layer.addTo(this.maps.main);
            }
        });

        setTimeout(() => {
            this.maps.mini.invalidateSize();
            this.maps.main.invalidateSize();
        }, 100);
    }

    setupEventListeners() {
        // Handle boundary toggle separately since it has a different ID
        const boundaryToggle = document.getElementById('boundary-toggle');
        if (boundaryToggle) {
            boundaryToggle.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.layers.maritimeBoundary.addTo(this.maps.main);
                    this.layers.maritimeBoundary.addTo(this.maps.mini);
                } else {
                    this.maps.main.removeLayer(this.layers.maritimeBoundary);
                    this.maps.mini.removeLayer(this.layers.maritimeBoundary);
                }
            });
        }
        
        // Handle other layer toggles
        ['vessels', 'patrol', 'exercise', 'piracy', 'checkpoints'].forEach(layer => {
            const toggle = document.getElementById(`${layer}-toggle`);
            if (toggle) {
                toggle.addEventListener('change', (e) => {
                    if (e.target.checked) {
                        this.layers[layer].addTo(this.maps.main);
                        this.layers[layer].addTo(this.maps.mini);
                    } else {
                        this.maps.main.removeLayer(this.layers[layer]);
                        this.maps.mini.removeLayer(this.layers[layer]);
                    }
                });
            }
        });

        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        const uploadArea = document.getElementById('upload-area');
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--color-accent)'; });
            uploadArea.addEventListener('dragleave', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--color-primary)'; });
            uploadArea.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--color-primary)'; this.handleFileUpload(e); });
        }

        const manualForm = document.getElementById('manual-vessel-form');
        if (manualForm) manualForm.addEventListener('submit', (e) => { e.preventDefault(); this.handleManualInput(e); });

        const importInput = document.getElementById('import-file-input');
        if (importInput) importInput.addEventListener('change', (e) => this.handleImport(e));
    }

    async handleFileUpload(event) {
        const files = event.target.files || event.dataTransfer.files;
        const uploadResults = document.getElementById('upload-results');
        if (uploadResults) uploadResults.innerHTML = '<p>Processing files...</p>';

        for (const file of files) {
            const fileType = file.name.split('.').pop().toLowerCase();
            let text = '';
            try {
                if (['txt', 'md'].includes(fileType)) {
                    text = await file.text();
                } else if (fileType === 'docx') {
                    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
                    text = result.value;
                } else if (fileType === 'xlsx') {
                    const data = await file.arrayBuffer();
                    const workbook = XLSX.read(data, { type: 'array' });
                    text = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 }).join('\n');
                } else if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(fileType)) {
                    // Show loading indicator
                    const loadingOverlay = document.getElementById('loading-overlay');
                    if (loadingOverlay) {
                        loadingOverlay.classList.remove('hidden');
                        const loadingText = loadingOverlay.querySelector('p');
                        if (loadingText) loadingText.textContent = 'Processing image with OCR (Tesseract.js)...';
                    }
                    
                    try {
                        text = await processOCRWithSarvam(file);
                        if (uploadResults) uploadResults.innerHTML += `<p style="color: #00d4ff;">ℹ OCR extracted text from ${file.name}</p>`;
                    } catch (ocrError) {
                        if (loadingOverlay) loadingOverlay.classList.add('hidden');
                        if (uploadResults) uploadResults.innerHTML += `<p style="color: #ff3366;">✗ OCR failed for ${file.name}: ${ocrError.message}</p>`;
                        alert(`OCR Error: ${ocrError.message}\n\nTips:\n1. Ensure image has clear, readable text\n2. Try a higher resolution image\n3. Avoid handwritten text\n4. Use JPG, PNG, WEBP, or BMP format`);
                        continue;
                    } finally {
                        if (loadingOverlay) loadingOverlay.classList.add('hidden');
                    }
                } else if (fileType === 'pdf') {
                    if (uploadResults) uploadResults.innerHTML += `<p style="color: #ffc107;">⚠ PDF files are not supported for OCR. Please convert to image format (JPG/PNG) or extract text manually.</p>`;
                    continue;
                } else {
                    throw new Error('Unsupported file type');
                }
                
                const extracted = await this.extractDataFromText(text, file.name);
                await this.processExtractedData(extracted, file.name);
                if (uploadResults) uploadResults.innerHTML += `<p style="color: #00ff88;">✓ Processed ${file.name}: ${extracted.vessels.length} vessels added.</p>`;
            } catch (error) {
                if (uploadResults) uploadResults.innerHTML += `<p style="color: #ff3366;">✗ Error processing ${file.name}: ${error.message}</p>`;
            }
        }

        this.updateAllUI();
        await this.saveDataToDB();
        this.generateAlerts();
    }

    async handleImport(event) {
        const file = event.target.files[0];
        if (!file) return;
        const text = await file.text();
        this.data = this.parseTextData(text);
        await this.saveDataToDB();
        this.updateAllUI();
        this.generateAlerts();
    }

    parseCoordinate(coordStr) {
        // Supports formats: 32°45'N, 8°30'S, 32°45.5'N, 32°45'N etc.
        const match = coordStr.trim().match(/^(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)?[']?\s*([NSWE])/i);
        if (!match) return null;

        let degrees = parseFloat(match[1]);
        const minutes = match[2] ? parseFloat(match[2]) / 60 : 0;
        let value = degrees + minutes;

        const direction = match[3].toUpperCase();
        if (direction === 'S' || direction === 'W') {
            value = -value;
        }
        return value;
    }

    async extractDataFromText(text, source) {
        const vessels = [];
        const checkpoints = [];
        const patrolAreas = [];
        const exerciseAreas = [];
        const alerts = [];

        // Normalize line endings and whitespace
        text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        // Split into report blocks starting with "Date:"
        let reportBlocks = text.split(/\nDate:/);
        // Restore "Date:" prefix for all blocks except possibly the first
        reportBlocks = reportBlocks.map((block, idx) => idx === 0 ? block : 'Date:' + block);
        // Filter out empty blocks
        reportBlocks = reportBlocks.map(b => b.trim()).filter(b => b.length > 0);

        for (const block of reportBlocks) {
            const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0);

            const data = {};
            for (const line of lines) {
                if (!line.includes(':')) continue;
                const colonIndex = line.indexOf(':');
                const key = line.substring(0, colonIndex).trim().toLowerCase();
                const value = line.substring(colonIndex + 1).trim();
                data[key] = value;
            }

            const vesselType = data['vessel type'] || 'Unknown';
            const observedVessel = data['observed vessel'] || '';
            if (!observedVessel) continue;

            const position = data['position'] || '';
            if (!position) continue;

            const headingStr = data['heading'] || '0';
            const speedStr = data['speed'] || '0';
            const pennant = data['pennant'] || data['pennant'] || '';
            const imo = data['imo'] || '';
            const registry = data['registry'] || data['status'] || 'Unknown';

            // Split position by comma or slash
            const posParts = position.split(/[\s,\/]+/).filter(p => p.length > 0);
            if (posParts.length < 2) continue;

            const lat = this.parseCoordinate(posParts[0]);
            const lon = this.parseCoordinate(posParts[1]);
            if (lat === null || lon === null) continue;

            const speedVal = parseFloat(speedStr.replace(/[^\d.]/g, '')) || 0;
            const courseVal = parseFloat(headingStr.replace(/[^\d.]/g, '')) || 0;

            // Determine if friendly
            const lowerType = vesselType.toLowerCase();
            const isFriendly = lowerType.includes('naval') || lowerType.includes('coast guard');

            // Extract name and pennant/IMO from observed vessel
            let name = observedVessel.trim();
            let pennantIMO = pennant || imo || 'Unknown';

            const nameMatch = observedVessel.match(/^(.+?)\s*\(([^)]+)\)$/);
            if (nameMatch) {
                name = nameMatch[1].trim();
                pennantIMO = nameMatch[2].trim();
            }

            // Basic flag inference
            let flag = 'Unknown';
            if (name.startsWith('USS') || name.startsWith('USNS') || name.includes('USCGC')) flag = 'USA';
            else if (name.startsWith('HMS')) flag = 'UK';
            else if (name.startsWith('HMAS')) flag = 'Australia';
            else if (name.startsWith('INS')) flag = 'India';
            else if (name.startsWith('JS') || name.startsWith('JMSDF')) flag = 'Japan';
            else if (name.startsWith('FS')) flag = 'France';
            else if (name.startsWith('PLAN')) flag = 'China';
            else if (name.startsWith('KRI')) flag = 'Indonesia';
            else if (name.startsWith('BRP')) flag = 'Philippines';

            const vesselId = `VESSEL_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            vessels.push({
                id: vesselId,
                name: name,
                vesselType: vesselType,
                lat: lat,
                lon: lon,
                speed: speedVal,
                course: courseVal,
                isFriendly: isFriendly,
                flag: flag,
                source: source,
                pennantIMO: pennantIMO,
                registry: registry
            });
        }

        // Preserve JSON block handling for areas/checkpoints (from original code)
        const jsonBlocks = text.match(/```json[\s\S]*?```/g) || [];
        jsonBlocks.forEach(block => {
            try {
                const obj = JSON.parse(block.replace(/```json|```/g, '').trim());
                const coords = obj.coordinates?.map(c => [c.lat, c.lon]) || [];
                if (coords.length === 1) {
                    checkpoints.push({ name: obj.name, lat: coords[0][0], lon: coords[0][1], source });
                } else if (coords.length >= 3) {
                    const area = { tooltip: obj.name, coords, source };
                    if (obj.type?.toLowerCase().includes('patrol') || obj.name.toLowerCase().includes('patrol')) {
                        patrolAreas.push(area);
                    } else {
                        exerciseAreas.push(area);
                    }
                }
            } catch (e) {
                console.error('Failed to parse JSON block:', e);
            }
        });

        return { vessels, checkpoints, patrolAreas, exerciseAreas, alerts };
    }

    async processExtractedData(extracted, source) {
        this.data.vessels.push(...extracted.vessels);
        this.data.checkpoints.push(...extracted.checkpoints);
        this.data.patrolAreas.push(...extracted.patrolAreas);
        this.data.exerciseAreas.push(...extracted.exerciseAreas);
        this.data.alerts.push(...extracted.alerts);
        this.data.uploadHistory.push({ id: Date.now(), file: source, timestamp: new Date().toISOString() });

        await this.saveDataToDB();
        this.updateAllUI();
        this.generateAlerts();
    }

    async handleManualInput(event) {
        const formData = new FormData(event.target);
        const vessel = {
            id: formData.get('vessel_id') || `VESSEL${this.data.vessels.length + 1}`,
            name: formData.get('name') || `VESSEL${this.data.vessels.length + 1}`,
            vesselType: formData.get('vessel_type'),
            lat: parseFloat(formData.get('latitude')),
            lon: parseFloat(formData.get('longitude')),
            speed: parseFloat(formData.get('speed')) || 0,
            course: parseFloat(formData.get('course')) || 0,
            isFriendly: formData.get('is_friendly') === 'true',
            flag: formData.get('flag') || 'Unknown',
            source: 'Manual Input',
            pennantIMO: formData.get('pennant_imo') || 'Unknown',
            registry: formData.get('registry') || 'Unknown'
        };

        this.data.vessels.push(vessel);
        await this.saveDataToDB();
        this.updateAllUI();
        this.generateAlerts();
        event.target.reset();
    }

    async processText() {
        const text = document.getElementById('text-input').value.trim();
        if (!text) {
            alert("Please paste some text first.");
            return;
        }

        const extracted = await this.extractDataFromText(text, 'Text Input');
        await this.processExtractedData(extracted, 'Text Input');

        const resultsDiv = document.getElementById('processing-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <h4>Extraction Results:</h4>
                <p><strong>Vessels Added:</strong> ${extracted.vessels.length}</p>
                <p><strong>Checkpoints:</strong> ${extracted.checkpoints.length}</p>
                <p><strong>Patrol Areas:</strong> ${extracted.patrolAreas.length}</p>
                <p><strong>Exercise Areas:</strong> ${extracted.exerciseAreas.length}</p>
                <p><strong>Alerts from Text:</strong> ${extracted.alerts.length}</p>
            `;
        }
    }

    clearText() {
        document.getElementById('text-input').value = '';
        const resultsDiv = document.getElementById('processing-results');
        if (resultsDiv) {
            resultsDiv.innerHTML = `
                <div class="results-placeholder">
                    <i class="fas fa-search"></i>
                    <p>Paste vessel reports and click "Process Text" to extract data</p>
                </div>
            `;
        }
    }

    async removeVessel(vesselId) {
        if (confirm(`Remove vessel ${vesselId}?`)) {
            this.data.vessels = this.data.vessels.filter(v => v.id !== vesselId);
            delete this.vesselMarkers[vesselId];
            await this.saveDataToDB();
            this.updateAllUI();
            this.generateAlerts();
        }
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c * 0.539957;
    }

    predictTrajectory(lat, lon, speed, course, timeMinutes = 60, steps = 12) {
        const speedKmPerMin = speed * 1.852 / 60;
        const stepTime = timeMinutes / steps;
        let path = [];
        let clat = lat, clon = lon;
        for (let i = 0; i <= steps; i++) {
            path.push([clat, clon]);
            const distKm = speedKmPerMin * stepTime;
            const distDeg = distKm / 111;
            const rad = course * Math.PI / 180;
            clat += distDeg * Math.cos(rad);
            clon += distDeg * Math.sin(rad) / Math.max(Math.cos(clat * Math.PI / 180), 1e-6);
        }
        return path;
    }

    orientation(p, q, r) { const val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]); return val === 0 ? 0 : val > 0 ? 1 : 2; }
    onSegment(p, q, r) { return q[0] <= Math.max(p[0], r[0]) && q[0] >= Math.min(p[0], r[0]) && q[1] <= Math.max(p[1], r[1]) && q[1] >= Math.min(p[1], r[1]); }
    doIntersect(p1, q1, p2, q2) {
        const o1 = this.orientation(p1, q1, p2), o2 = this.orientation(p1, q1, q2), o3 = this.orientation(p2, q2, p1), o4 = this.orientation(p2, q2, q1);
        if (o1 !== o2 && o3 !== o4) return true;
        if (o1 === 0 && this.onSegment(p1, p2, q1)) return true;
        if (o2 === 0 && this.onSegment(p1, q2, q1)) return true;
        if (o3 === 0 && this.onSegment(p2, p1, q2)) return true;
        if (o4 === 0 && this.onSegment(p2, q1, q2)) return true;
        return false;
    }

    isPointInPiracyZone(lat, lon) {
        for (let zone of this.piracyAreas) {
            const [[lat1, lon1], [lat2, lon2]] = zone.bounds;
            const minLat = Math.min(lat1, lat2), maxLat = Math.max(lat1, lat2);
            const minLon = Math.min(lon1, lon2), maxLon = Math.max(lon1, lon2);
            if (lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon) return zone.tooltip;
        }
        return null;
    }

    isPointInPolygon(lat, lon, polygon) {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][1], yi = polygon[i][0];
            const xj = polygon[j][1], yj = polygon[j][0];
            if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi + 1e-10) + xi)) inside = !inside;
        }
        return inside;
    }

    generateAlerts() {
        this.data.alerts = this.data.alerts.filter(a => !a.autoGenerated);
        const speedThreshold = 12;
        const boundarySegments = [];
        
        // Create boundary segments from the maritime boundary
        for (let i = 0; i < this.maritimeBoundary.length - 1; i++) {
            boundarySegments.push([this.maritimeBoundary[i], this.maritimeBoundary[i + 1]]);
        }

        // Collision detection
        const positionMap = new Map();
        this.data.vessels.forEach(vessel => {
            const key = `${vessel.lat.toFixed(6)},${vessel.lon.toFixed(6)}`;
            if (!positionMap.has(key)) positionMap.set(key, []);
            positionMap.get(key).push(vessel);
        });
        positionMap.forEach((vesselsAtPos, key) => {
            if (vesselsAtPos.length >= 2) {
                const [lat, lon] = key.split(',').map(parseFloat);
                const vesselNames = vesselsAtPos.map(v => v.name).join(', ');
                this.data.alerts.push({
                    message: `Collision Risk: Vessels ${vesselNames} at the same position ${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
                    priority: 'HIGH',
                    lat: lat,
                    lon: lon,
                    timestamp: new Date().toISOString(),
                    source: 'Auto Alert System',
                    autoGenerated: true,
                    vesselId: vesselsAtPos.map(v => v.id).join(',')
                });
            }
        });

        this.data.vessels.forEach(vessel => {
            if (vessel.isFriendly) return;
            const alerts = [];

            if (vessel.speed > speedThreshold) {
                alerts.push({
                    message: `High Speed: Unidentified vessel ${vessel.name} at ${vessel.speed.toFixed(1)} knots`,
                    priority: 'MEDIUM',
                    lat: vessel.lat,
                    lon: vessel.lon,
                    timestamp: new Date().toISOString(),
                    source: 'Auto Alert System',
                    autoGenerated: true,
                    vesselId: vessel.id
                });
            }

            const piracyZone = this.isPointInPiracyZone(vessel.lat, vessel.lon);
            if (piracyZone) {
                alerts.push({
                    message: `Piracy Risk: Unidentified vessel ${vessel.name} in ${piracyZone}`,
                    priority: 'HIGH',
                    lat: vessel.lat,
                    lon: vessel.lon,
                    timestamp: new Date().toISOString(),
                    source: 'Auto Alert System',
                    autoGenerated: true,
                    vesselId: vessel.id
                });
            }

            [...this.data.patrolAreas, ...this.data.exerciseAreas].forEach(area => {
                if (this.isPointInPolygon(vessel.lat, vessel.lon, area.coords)) {
                    alerts.push({
                        message: `Unidentified vessel ${vessel.name} inside restricted zone: ${area.tooltip}`,
                        priority: 'HIGH',
                        lat: vessel.lat,
                        lon: vessel.lon,
                        timestamp: new Date().toISOString(),
                        source: 'Auto Alert System',
                        autoGenerated: true,
                        vesselId: vessel.id
                    });
                }
            });

            const trajectory = this.predictTrajectory(vessel.lat, vessel.lon, vessel.speed, vessel.course);
            let crosses = false;
            for (let i = 0; i < trajectory.length - 1; i++) {
                const seg1 = [trajectory[i], trajectory[i + 1]];
                for (const seg2 of boundarySegments) {
                    if (this.doIntersect(seg1[0], seg1[1], seg2[0], seg2[1])) { crosses = true; break; }
                }
                if (crosses) break;
            }
            if (crosses) {
                let msg = `Boundary Violation: Unidentified vessel ${vessel.name} crossed Indian maritime boundary`;
                if (vessel.speed > speedThreshold) msg += ` at ${vessel.speed.toFixed(1)} knots`;
                const navalVessels = this.data.vessels.filter(v => v.isFriendly 
