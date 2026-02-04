📌 Overview

The Maritime Situational Awareness (MSA) System is a centralized, web-based command and control platform designed to support real-time maritime surveillance, vessel monitoring, threat detection, and operational decision-making across vast maritime domains.

This project simulates the core principles and functional architecture used by modern maritime forces such as the Indian Navy and Indian Coast Guard, where data from multiple sources is fused into a single operational picture to enhance maritime domain awareness (MDA).

The system integrates geospatial intelligence, vessel tracking, automated alert generation, data persistence, and multi-source information ingestion into a unified command interface.

🎯 Project Objectives

The primary objectives of this Maritime Situational Awareness system are:

1. To provide a real-time operational picture of maritime activities.
2. To track, classify, and monitor vessels within and around Indian maritime boundaries.
3. To detect suspicious behaviour and generate automated alerts.
4. To support decision-making for interception, patrol, and surveillance.
5. To demonstrate a centralized command & communication model used in naval and coast guard operations.
6. To simulate data fusion from heterogeneous sources (manual input, documents, OCR, logs).

🧠 Conceptual Background

Modern maritime security operations rely on:

1. AIS & non-AIS vessel tracking.
2. Coastal radar chains.
3. Aerial and surface patrol reports.
4. Intelligence & surveillance logs.
5. Centralized command centres

This project models the software backbone of such systems, focusing on:

1. Data fusion.
2. Geospatial analysis.
3. Threat assessment.
4. Persistent situational awareness

🧩 Key Features
🔐 Secure Command Access

1. Login-based access simulating restricted command centre entry.
2. Role-based operational interface.
3. Persistent session-based data storage.

🗺️ Interactive Maritime Map

Real-time interactive map using Leaflet

Visualization of:

1. Indian maritime boundaries (East & West).
2. Vessel positions.
3. Patrol areas.
4. Exercise zones.
5. Piracy-prone regions.
6. Security checkpoints.
7. Layer-based toggling for operational clarity.

🚢 Vessel Tracking & Classification

Manual and automated vessel ingestion.

Vessel attributes:

1. Position (Lat/Lon).
2. Speed & course.
3. Vessel type.
4. Flag inference.
5. Friendly vs unidentified classification.
6. Real-time tracking and zoom-to-target functionality.

📊 Operational Dashboard (Command Overview)

Key Performance Indicators (KPIs):

1. Total vessels.
2. Friendly vessels.
3. Suspicious vessels.
4. Active alerts.
5. Mini-map overview.
6. Recent alerts feed.
7. Active vessel summary.
8. System health indicators.

🚨 Automated Threat Detection & Alerts

The system automatically generates alerts based on:

1. High-speed unidentified vessels.
2. Entry into restricted patrol or exercise zones.
3. Piracy-zone presence.
4. Predicted maritime boundary violation.
5. Collision risk detection.
6. Trajectory-based future movement prediction.

Each alert includes:

1. Priority level (Medium / High).
2. Location.
3. Timestamp.
4. Source.
5. Associated vessel(s).

🧭 Trajectory Prediction & Boundary Analysis

Predicts future vessel movement based on:

1. Speed.
2. Course.
3. Time window.

Detects:

1. Boundary crossings.
2. Intersections with maritime limits.
3. Recommends nearest naval or coast guard asset for interception with ETA estimation.

📁 Multi-Source Data Ingestion

Supports ingestion of operational data from:

1. Text & Markdown reports.
2. CSV & Excel files.
3. DOCX documents.
4. PDFs & scanned images (OCR using Tesseract).
5. JSON-based operational area definitions.
6. Manual vessel input forms.

This simulates real-world intelligence fusion from diverse maritime reporting channels.

🧠 Text Intelligence Processing

Extracts structured vessel data from unstructured surveillance logs

Automatically parses:

1. Coordinates (DMS formats).
2. Vessel identity.
3. Speed & heading.
4. Operational context.
5. Converts raw reports into actionable data.


💾 Persistent Data Storage

Uses IndexedDB for offline-capable persistence.

Data survives browser reloads.

Supports:

1. Data export (TXT / CSV).
2. Data import.
3. Backup & restore.
4. System refresh.

🗂️ Data Management Module

1. System-wide statistics.
2. Exportable operational datasets.
3. Manual data import.
4. Full system reset (with confirmation).

🛠️ Technology Stack

1. Frontend: HTML5, CSS3, JavaScript.
2. Mapping & GIS: Leaflet.js, OpenStreetMap.
3. Data Storage: IndexedDB.
4. OCR: Tesseract.js.
5. File Parsing: Mammoth.js, SheetJS (XLSX).
6. Icons: Font Awesome.

🧪 Use-Case Scenarios

1. Coastal surveillance simulation.
2. Naval & coast guard training demonstrations.
3. Defence technology academic projects.
4. Maritime security research.
5. Hackathons & innovation challenges.
6. Command-and-control system prototyping.

⚠️ Disclaimer

This project is a simulation and academic implementation inspired by publicly known principles of maritime surveillance systems.

It does not use classified data, real military feeds or operational intelligence and does not represent any official system currently deployed by defence forces.

🚀 Future Enhancements

1. AIS feed simulation.
2. Role-based access control.
3. AI-based threat scoring.
4. Satellite & UAV integration models.
5. Real-time communication overlays.
6. Backend API integration.
7. Multi-command synchronization.

👨‍💻 Author

Developed as an advanced maritime surveillance and situational awareness project to demonstrate system design, geospatial intelligence and defence-oriented software architecture.
