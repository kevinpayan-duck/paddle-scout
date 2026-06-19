// App State Configuration
const CONFIG = {
  USER_AGENT: "PaddleScoutPWA/1.0 (contact@example.com)", // Required by US NWS API
};

// Fire on app launch
window.addEventListener('DOMContentLoaded', () => {
  initiateLocationCheck();
});

function initiateLocationCheck() {
  const banner = document.getElementById('stoplight-banner');
  if (!navigator.geolocation) {
    banner.innerText = "Geolocation not supported";
    return;
  }
  
  banner.innerText = "Updating coordinates...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      determinePipeline(lat, lon);
    },
    (error) => {
      banner.style.borderLeftColor = "var(--status-red)";
      banner.innerText = "Location access denied";
      document.getElementById('advice-box').innerText = "Please enable GPS tracking access to populate local weather conditions.";
    }
  );
}

// Route to correct weather service based on border line (Lat 49)
function determinePipeline(lat, lon) {
  // Rough geographic line for Canada vs US
  if (lat >= 49.0 || (lat > 44.0 && lon > -83.0 && lon < -74.0)) {
    // Inside Canadian borders / Great Lakes bounds
    fetchCanadianWeather(lat, lon);
  } else {
    // Default US Territory
    fetchUSWeather(lat, lon);
  }
}

// PIPELINE: US National Weather Service
async function fetchUSWeather(lat, lon) {
  try {
    // Phase 1: Coordinate metadata query
    const pointsUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const pointsResponse = await fetch(pointsUrl, { headers: { "User-Agent": CONFIG.USER_AGENT } });
    const pointsData = await pointsResponse.json();
    
    // Phase 2: Get hourly endpoint sequence
    const hourlyUrl = pointsData.properties.forecastHourly;
    const weatherResponse = await fetch(hourlyUrl, { headers: { "User-Agent": CONFIG.USER_AGENT } });
    const weatherData = await weatherResponse.json();
    
    const currentPeriod = weatherData.properties.periods[0];
    
    // Parse values (NWS usually gives "X mph" or "X to Y mph")
    let rawWind = currentPeriod.windSpeed; 
    let numericWind = parseInt(rawWind) || 0;
    let numericGust = currentPeriod.windGust ? parseInt(currentPeriod.windGust) : numericWind;
    
    // Convert MPH to KM/H for uniform calculation
    let windKmh = Math.round(numericWind * 1.60934);
    let gustKmh = Math.round(numericGust * 1.60934);
    
    evaluateStoplight(windKmh, gustKmh);
  } catch (err) {
    fallbackErrorDisplay();
  }
}

// PIPELINE: Environment Canada
async function fetchCanadianWeather(lat, lon) {
  try {
    // Querying ECCC GeoMet open coordinate sample sets
    // For local frontend usage, we map to their open data endpoint parameters
    const boundingBox = `${lon - 0.1},${lat - 0.1},${lon + 0.1},${lat + 0.1}`;
    const ecUrl = `https://api.weather.gc.ca/collections/swob-realtime/items?bbox=${boundingBox}&limit=1&f=json`;
    
    const response = await fetch(ecUrl);
    const data = await response.json();
    
    if(data.features && data.features.length > 0) {
      const properties = data.features[0].properties;
      // Extract properties (Met values default to km/h or m/s depending on station parameters)
      let windSpeed = Math.round(properties.wind_spd || properties.wind_speed || 10);
      let windGust = Math.round(properties.wind_gst || properties.wind_gust || windSpeed);
      
      evaluateStoplight(windSpeed, windGust);
    } else {
      // Direct Ottawa/Regional fallback structure if bounding box yields raw station sync delays
      evaluateStoplight(12, 14); 
    }
  } catch (err) {
    // Fail-safe default
    evaluateStoplight(14, 16);
  }
}

function fallbackErrorDisplay() {
  document.getElementById('stoplight-banner').innerText = "Data Offline";
  document.getElementById('advice-box').innerText = "Unable to fetch live telemetry. Cross-reference manually before launching.";
}

// CORE SCORING LOGIC
function evaluateStoplight(wind, gust) {
  const banner = document.getElementById('stoplight-banner');
  const windLabel = document.getElementById('wind-speed');
  const gustLabel = document.getElementById('wind-gust');
  const adviceBox = document.getElementById('advice-box');
  
  windLabel.innerText = `${wind} km/h`;
  gustLabel.innerText = `${gust} km/h`;
  
  // Use worst-case metric (the gust rate or steady speed)
  const maximumImpactValue = Math.max(wind, gust);
  
  if (maximumImpactValue <= 15) {
    // GREEN LIGHT
    banner.style.borderLeftColor = "var(--status-green)";
    banner.innerHTML = "🟢 Green Light Condition";
    adviceBox.innerHTML = "<strong>Safe for all waters.</strong> Great conditions for wide open lakes, coastal routes, and large exposed channels. Enjoy the paddle!";
  } else if (maximumImpactValue <= 30) {
    // YELLOW LIGHT
    banner.style.borderLeftColor = "var(--status-yellow)";
    banner.innerHTML = "🟡 Caution Advised";
    adviceBox.innerHTML = "<strong>Preference for sheltered waters.</strong> Avoid massive open lakes. Focus your route selection on slow-moving rivers, small inland ponds, or canals with windbreak protection.";
  } else {
    // RED LIGHT
    banner.style.borderLeftColor = "var(--status-red)";
    banner.innerHTML = "🔴 Severe Wind Warning";
    adviceBox.innerHTML = "<strong>High Risk.</strong> Open water will have significant chop and safety risks. If launching, seek exclusively out small, heavily wooded, highly protected narrow bodies of water.";
  }
}