import streamlit as st
import folium
from folium.plugins import MarkerCluster, HeatMap
from streamlit_folium import st_folium
import pandas as pd
import numpy as np
from datetime import datetime
import sqlite3
import json
from sklearn.ensemble import IsolationForest
from scipy.interpolate import splprep, splev

# Custom CSS for styling
st.markdown(
    <style>
    .main {background-color: #f0f8ff;}
    .sidebar .sidebar-content {background-color: #e6f0fa; margin-left: 50px; width: 300px;}
    .stButton>button {background-color: #1e90ff; color: white; border-radius: 5px;}
    .alert-box {
        color: #222;
        background: #f8fafd;
        padding: 16px 18px 16px 18px;
        margin-bottom: 16px;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.07);
        font-family: 'Segoe UI', 'Roboto', Arial, sans-serif;
        font-size: 1rem;
        font-weight: 500;
        display: flex;
        align-items: center;
        border-left: 6px solid #bbb;
        transition: box-shadow 0.2s;
        word-break: break-word;
    }
    .alert-box.speed {
        border-left: 6px solid #2196f3;
        background: #eaf4fb;
    }
    .alert-box.piracy {
        border-left: 6px solid #e53935;
        background: #fbeaea;
    }
    .alert-box.boundary {
        border-left: 6px solid #8b0000;
        background: #f7eaea;
    }
    .alert-icon {
        font-size: 1.3em;
        margin-right: 10px;
        flex-shrink: 0;
    }
    .layout-container {
        display: flex;
        flex-direction: row;
        width: 100%;
        height: 90vh;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
    }
    .map-container {
        flex: 1;
        height: 100%;
        margin: 0;
        padding: 0;
        min-width: 0;
    }
    .alert-container {
        width: 500px;
        height: 100%;
        background: #fff;
        padding: 18px 18px 18px 18px;
        border-left: 2px solid #ddd;
        overflow-y: auto;
        margin: 0;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
    }
    .alert-title {
        font-size: 1.1em;
        font-weight: bold;
        margin-bottom: 10px;
        border-bottom: 2px solid #eee;
        padding-bottom: 4px;
        letter-spacing: 0.5px;
    }
    </style>
, unsafe_allow_html=True)

# Database setup
def init_db():
    conn = sqlite3.connect('vessel_data.db')
    c = conn.cursor()
    c.execute(
        CREATE TABLE IF NOT EXISTS vessels (
            vessel_id TEXT PRIMARY KEY,
            lat REAL,
            lon REAL,
            speed REAL,
            heading REAL,
            timestamp REAL,
            trajectory TEXT,
            is_friendly INTEGER
        )
    )
    conn.commit()
    conn.close()

# Load data from database
def load_ais_data():
    conn = sqlite3.connect('vessel_data.db')
    df = pd.read_sql_query("SELECT * FROM vessels", conn)
    conn.close()
    if 'trajectory' not in df.columns:
        df['trajectory'] = None
    if 'is_friendly' not in df.columns:
        df['is_friendly'] = 1
    df['trajectory'] = df['trajectory'].apply(lambda x: json.loads(x) if x and x != 'null' else None)
    return df

# Save data to database
def save_vessel_to_db(vessel_data, trajectory=None, is_friendly=1):
    conn = sqlite3.connect('vessel_data.db')
    c = conn.cursor()
    trajectory_json = json.dumps(trajectory) if trajectory else None
    c.execute('''
        INSERT OR REPLACE INTO vessels (vessel_id, lat, lon, speed, heading, timestamp, trajectory, is_friendly)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        vessel_data['vessel_id'], vessel_data['lat'], vessel_data['lon'],
        vessel_data['speed'], vessel_data['heading'], vessel_data['timestamp'],
        trajectory_json, is_friendly
    ))
    conn.commit()
    conn.close()

# Remove vessel from database
def remove_vessel_from_db(vessel_id):
    conn = sqlite3.connect('vessel_data.db')
    c = conn.cursor()
    c.execute("DELETE FROM vessels WHERE vessel_id = ?", (vessel_id,))
    conn.commit()
    conn.close()

# Generate initial AIS data if database is empty
def generate_initial_ais_data():
    np.random.seed(42)
    n_vessels = 10
    base_time = datetime.now().timestamp()
    regions = [
        (23.5, 64.5), (15.0, 64.5), (5.0, 69.5), (4.0, 76.0), (4.0, 84.0),
        (6.0, 87.5), (15.0, 93.0), (20.0, 92.0), (12.0, 44.0), (2.0, 99.0)
    ]
    lats, lons = [], []
    for _ in range(n_vessels):
        region = regions[np.random.randint(0, len(regions))]
        lat = region[0] + np.random.uniform(-0.5, 0.5)
        lon = region[1] + np.random.uniform(-0.5, 0.5)
        lats.append(lat)
        lons.append(lon)
    
    df = pd.DataFrame({
        'vessel_id': [f"VESSEL{str(i).zfill(3)}" for i in range(1, n_vessels + 1)],
        'lat': lats, 'lon': lons, 'speed': np.random.uniform(5, 20, n_vessels),
        'heading': np.random.uniform(0, 360, n_vessels), 'timestamp': [base_time - i * 300 for i in range(n_vessels)],
        'trajectory': [None] * n_vessels, 'is_friendly': np.random.randint(0, 2, n_vessels)
    })
    
    for _, row in df.iterrows():
        save_vessel_to_db(row, None, row['is_friendly'])
    return df

def update_ais_data(df):
    df['timestamp'] += 60
    lat_change = np.sin(np.radians(df['heading'])) * df['speed'] * 0.0001
    lon_change = np.cos(np.radians(df['heading'])) * df['speed'] * 0.0001
    df['lat'] += lat_change
    df['lon'] += lon_change
    df['speed'] = df['speed'].clip(0, 25)
    
    for _, row in df.iterrows():
        save_vessel_to_db(row, row['trajectory'], row['is_friendly'])
    return df

# Risk and alerts
def calculate_risk_score(row):
    score = 0
    if row['speed'] > 12:
        score += 40
    if (10 <= row['lat'] <= 15 and 43 <= row['lon'] <= 53) or \
       (0 <= row['lat'] <= 5 and 65 <= row['lon'] <= 70) or \
       (0 <= row['lat'] <= 5 and 97 <= row['lon'] <= 102):
        score += 30
    if row.get('anomaly', 1) == -1:
        score += 30
    return min(score, 100)

def generate_alerts(vessel_info, trajectories, maritime_boundary):
    alerts = []
    if vessel_info['speed'] and vessel_info['speed'] > 12:
        alerts.append(('speed', f"High Speed: {vessel_info['vessel_id']} at {vessel_info['speed']:.1f} knots"))
    if vessel_info['lat'] and vessel_info['lon']:
        if 10 <= vessel_info['lat'] <= 15 and 43 <= vessel_info['lon'] <= 53:
            alerts.append(('piracy', f"Piracy Risk: {vessel_info['vessel_id']} in Gulf of Aden"))
        elif 0 <= vessel_info['lat'] <= 5 and 65 <= vessel_info['lon'] <= 70:
            alerts.append(('piracy', f"Piracy Risk: {vessel_info['vessel_id']} in Arabian Sea near Horn of Africa"))
        elif 0 <= vessel_info['lat'] <= 5 and 97 <= vessel_info['lon'] <= 102:
            alerts.append(('piracy', f"Piracy Risk: {vessel_info['vessel_id']} in Malacca Strait"))
    
    if vessel_info['is_friendly'] == 0 and vessel_info['vessel_id'] in trajectories:
        trajectory = trajectories[vessel_info['vessel_id']]
        if trajectory and check_boundary_crossing(trajectory, maritime_boundary):
            alert_msg = f"Boundary Violation: Non-Friendly {vessel_info['vessel_id']} crossed Indian maritime boundary"
            if vessel_info['speed'] > 12:
                alert_msg += f" at {vessel_info['speed']:.1f} knots"
            alerts.append(('boundary', alert_msg))
    return alerts

# Check if a trajectory intersects the maritime boundary
def check_boundary_crossing(trajectory, boundary):
    from shapely.geometry import LineString, MultiLineString
    try:
        traj_line = LineString(trajectory)
        boundary_lines = MultiLineString([LineString([boundary[i], boundary[(i + 1) % len(boundary)]]) for i in range(len(boundary))])
        return traj_line.intersects(boundary_lines)
    except Exception as e:
        st.warning(f"Boundary crossing check failed: {str(e)}")
        return False

# Anomaly detection
@st.cache_data
def detect_anomalies(df):
    if df.empty:
        return df
    features = df[['speed', 'heading']].fillna(0)
    iso_forest = IsolationForest(contamination=0.1, random_state=42)
    df['anomaly'] = iso_forest.fit_predict(features)
    df['risk_score'] = df.apply(calculate_risk_score, axis=1)
    return df

# Calculate trajectory points
def calculate_trajectory(lat, lon, speed, heading, time_minutes):
    speed_km_per_min = speed * 1.852 / 60
    total_distance_km = speed_km_per_min * time_minutes
    distance_deg = total_distance_km / 111
    heading_rad = np.radians(heading)
    lat_change = distance_deg * np.cos(heading_rad)
    lon_change = distance_deg * np.sin(heading_rad) / np.cos(np.radians(lat))
    return [[lat, lon], [lat + lat_change, lon + lon_change]]

# Smooth boundary lines
def smooth_boundary(points, num_points=100):
    lats, lons = zip(*points)
    t = np.linspace(0, 1, len(points))
    if len(points) < 3:
        return points
    try:
        tck, u = splprep([lats, lons], s=0, k=2)
        u_fine = np.linspace(0, 1, num_points)
        lats_fine, lons_fine = splev(u_fine, tck)
        return list(zip(lats_fine, lons_fine))
    except Exception as e:
        st.warning(f"Failed to smooth boundary: {str(e)}. Using original points.")
        return points

# Map setup with maritime boundary, heatmap, and pins toggle
def setup_map(df, center, zoom, style="cartodbpositron", trajectories=None, show_heatmap=True, show_pins=True):
    try:
        # Always center on India by default if center is invalid or not provided
        if not center or not (-90 <= center[0] <= 90 and -180 <= center[1] <= 180):
            center = [20.5937, 78.9629]
        m = folium.Map(location=center, zoom_start=zoom, tiles=style)
        
        # Add maritime boundary
        maritime_boundary = [
            [23.5, 64.5], [15.0, 64.5], [5.0, 69.5], [4.0, 76.0], [4.0, 84.0],
            [6.0, 87.5], [15.0, 93.0], [23.5, 90.0]
        ]
        smoothed_boundary = smooth_boundary(maritime_boundary, num_points=300)
        folium.PolyLine(
            locations=smoothed_boundary,
            color='#0066cc',
            weight=1,
            opacity=0.8,
            dash_array='5, 5',
            tooltip="India 200-NM Maritime Boundary"
        ).add_to(m)

        # Add piracy risk zones
        folium.Rectangle(bounds=[[10, 43], [15, 53]], color='red', fill=True, fill_opacity=0.1, tooltip="Piracy Risk: Gulf of Aden").add_to(m)
        folium.Rectangle(bounds=[[0, 65], [5, 70]], color='red', fill=True, fill_opacity=0.1, tooltip="Piracy Risk: Arabian Sea").add_to(m)
        folium.Rectangle(bounds=[[0, 97], [5, 102]], color='red', fill=True, fill_opacity=0.1, tooltip="Piracy Risk: Malacca Strait").add_to(m)

        # Add vessel markers if enabled
        if show_pins:
            marker_cluster = MarkerCluster().add_to(m)
            for _, row in df.iterrows():
                if row['is_friendly'] == 1:
                    color = 'orange' if row['risk_score'] > 30 else 'green'
                else:
                    color = 'red'
                status = 'Friendly' if row['is_friendly'] == 1 else 'Non-Friendly'
                popup_html = f"<b>{row['vessel_id']}</b><br>Speed: {row['speed']:.1f} knots<br>Risk: {row['risk_score']}<br>Status: {status}"
                folium.Marker(
                    [row['lat'], row['lon']],
                    popup=folium.Popup(popup_html, max_width=250),
                    icon=folium.Icon(color=color, icon='ship', prefix='fa')
                ).add_to(marker_cluster)
        
        # Add trajectories
        if trajectories:
            for vessel_id, trajectory in trajectories.items():
                if trajectory:
                    folium.PolyLine(
                        locations=trajectory,
                        color='orange',
                        weight=3,
                        dash_array='5, 5',
                        tooltip=f"Trajectory: {vessel_id}"
                    ).add_to(m)
        
        # Add heatmap if enabled
        if show_heatmap and len(df) > 3:
            HeatMap(df[['lat', 'lon']].values).add_to(m)
        
        folium.LayerControl().add_to(m)
        return m
    except Exception as e:
        st.error(f"Map rendering failed: {str(e)}")
        return folium.Map(location=[20.5937, 78.9629], zoom_start=5)

# Main app
def main():
    st.title("🌊 Maritime Awareness Dashboard")
    st.markdown("Track and manage vessels with Indian 200-NM maritime boundaries.")

    init_db()
    ais_data = load_ais_data()
    if ais_data.empty:
        ais_data = generate_initial_ais_data()

    if 'map_key' not in st.session_state:
        st.session_state.map_key = 0
    if 'new_alerts' not in st.session_state:
        st.session_state.new_alerts = []
    if 'trajectories' not in st.session_state:
        trajectories = {row['vessel_id']: row['trajectory'] for _, row in ais_data.iterrows() if row['trajectory']}
        st.session_state.trajectories = trajectories
    if 'show_heatmap' not in st.session_state:
        st.session_state.show_heatmap = True
    if 'show_pins' not in st.session_state:
        st.session_state.show_pins = True

    maritime_boundary = [
        [23.5, 64.5], [15.0, 64.5], [5.0, 69.5], [4.0, 76.0], [4.0, 84.0],
        [6.0, 87.5], [15.0, 93.0], [23.5, 90.0]
    ]

    with st.sidebar:
        st.header("⚙ Controls")
        min_speed = st.slider("Min Speed (knots)", 0, 20, 0)
        map_style = st.selectbox("Map Style", ["openstreetmap", "cartodbpositron"])
        zoom_level = st.slider("Zoom Level", 4, 12, 5)
        st.session_state.show_heatmap = st.checkbox("Show Heatmap", value=st.session_state.show_heatmap)
        st.session_state.show_pins = st.checkbox("Show Vessel Pins", value=st.session_state.show_pins)
        if st.button("Update AIS Data"):
            ais_data = update_ais_data(ais_data)
            st.session_state.map_key += 1
        if st.button("Clear Recent Alerts"):
            st.session_state.new_alerts = []
            st.success("Recent alerts cleared.")

        st.subheader("➕ Add New Vessel")
        with st.form("add_vessel_form"):
            vessel_id = st.text_input("Vessel ID", value=f"VESSEL{len(ais_data) + 1:03d}")
            lat = st.number_input("Latitude", -90.0, 90.0, 20.0, step=0.01)
            lon = st.number_input("Longitude", -180.0, 180.0, 78.0, step=0.01)
            heading = st.number_input("Heading (degrees)", 0.0, 360.0, 0.0, step=1.0)
            speed = st.number_input("Speed (knots)", 0.0, 25.0, 10.0, step=0.1)
            time_minutes = st.number_input("Time (minutes)", 60, 1440, 60, step=10)
            is_friendly = st.selectbox("Vessel Status", ["Friendly", "Non-Friendly"]) == "Friendly"
            submit = st.form_submit_button("Add Vessel")
            if submit:
                new_vessel = {
                    'vessel_id': vessel_id,
                    'lat': lat,
                    'lon': lon,
                    'speed': speed,
                    'heading': heading,
                    'timestamp': datetime.now().timestamp(),
                    'is_friendly': 1 if is_friendly else 0
                }
                trajectory = calculate_trajectory(lat, lon, speed, heading, time_minutes)
                save_vessel_to_db(new_vessel, trajectory, new_vessel['is_friendly'])
                st.session_state.trajectories[vessel_id] = trajectory
                st.session_state.map_key += 1
                ais_data = load_ais_data()
                alerts = generate_alerts(new_vessel, st.session_state.trajectories, maritime_boundary)
                if alerts:
                    st.session_state.new_alerts = alerts
                st.success(f"Added {vessel_id} to database as {'Friendly' if is_friendly else 'Non-Friendly'}.")

        st.subheader("➖ Remove Vessel")
        vessel_to_remove = st.selectbox("Select Vessel to Remove", ["None"] + ais_data['vessel_id'].tolist())
        if st.button("Remove Vessel") and vessel_to_remove != "None":
            remove_vessel_from_db(vessel_to_remove)
            if vessel_to_remove in st.session_state.trajectories:
                del st.session_state.trajectories[vessel_to_remove]
            st.session_state.map_key += 1
            ais_data = load_ais_data()
            st.success(f"Removed {vessel_to_remove} from database.")

    # Process data
    ais_data = detect_anomalies(ais_data)
    filtered_data = ais_data[ais_data['speed'] >= min_speed]

    # Layout with columns





    # Both map and alert box inside the same parent flex container, in one markdown call
    india_center = [22.0, 79.0]
    india_zoom = 5
    center = india_center if filtered_data.empty else [filtered_data['lat'].mean(), filtered_data['lon'].mean()]
    zoom = india_zoom if filtered_data.empty else zoom_level
    m = setup_map(
        filtered_data,
        center,
        zoom,
        map_style,
        st.session_state.trajectories,
        show_heatmap=st.session_state.show_heatmap,
        show_pins=st.session_state.show_pins
    )
    # Prepare alert HTML with icons and improved design
    def alert_icon(alert_type):
        if alert_type == "speed":
            return "<span class='alert-icon'>⚡</span>"
        elif alert_type == "piracy":
            return "<span class='alert-icon'>☠️</span>"
        elif alert_type == "boundary":
            return "<span class='alert-icon'>🚧</span>"
        else:
            return "<span class='alert-icon'>⚠️</span>"

    recent_alerts_html = ''
    if st.session_state.new_alerts:
        recent_alerts_html += "<div class='alert-title'>Recent Alerts</div>"
        for alert_type, alert in st.session_state.new_alerts:
            recent_alerts_html += f"<div class='alert-box {alert_type}'>" + alert_icon(alert_type) + f"{alert}</div>"

    other_alerts_list = [item for row in filtered_data.iterrows() for item in generate_alerts(row[1], st.session_state.trajectories, maritime_boundary)]
    other_alerts_html = ''
    filtered_other_alerts = [(alert_type, alert) for alert_type, alert in other_alerts_list if (alert_type, alert) not in st.session_state.new_alerts]
    if filtered_other_alerts:
        other_alerts_html += "<div class='alert-title'>Other Alerts</div>"
        for alert_type, alert in filtered_other_alerts:
            other_alerts_html += f"<div class='alert-box {alert_type}'>" + alert_icon(alert_type) + f"{alert}</div>"

    no_alerts_html = ''
    if not st.session_state.new_alerts and not filtered_other_alerts:
        no_alerts_html = "No active alerts."

    layout_html = f"""
    <div class='layout-container'>
        <div class='map-container'>
            <!-- Map will be rendered here by st_folium -->
        </div>
        <div class='alert-container'>
            <h3 style='margin-bottom:18px;'>🚨 Alerts</h3>
            {recent_alerts_html}
            {other_alerts_html}
            {no_alerts_html}
        </div>
    </div>
    """
    st.markdown(layout_html, unsafe_allow_html=True)
    # Render map inside the map-container using st_folium
    try:
        st_folium(m, width=1800, height=900, key=f"map_{st.session_state.map_key}")
    except Exception as e:
        st.error(f"Failed to render map: {str(e)}")

    with st.expander("Vessel Data"):
        st.dataframe(filtered_data[['vessel_id', 'speed', 'lat', 'lon', 'risk_score', 'is_friendly']])

if __name__ == "__main__":
    main()
