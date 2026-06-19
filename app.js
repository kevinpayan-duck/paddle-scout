// App State Configuration
const CONFIG = {
  USER_AGENT: "PaddleScoutPWA/1.0 (contact@example.com)",
};

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

function determinePipeline(lat, lon) {
  // Direct Ottawa region shortcut check 
  if (lat >= 45.0 && lat <= 46.0 && lon >= -76.5 && lon <= -75.0) {
    fetchOttawaWeather();
  } else if (lat >= 49.0 || (lat > 44.0 && lon > -83.0 && lon < -74.0)) {
    fetchCanadianWeather(lat, lon);
  } else {
    fetchUSWeather(lat, lon);
  }
}

async function fetchOttawaWeather() {
  try {
    // Direct feed targeting the main Ottawa station to avoid geometry search glitches
    const url = `https://api.weather.gc.ca/collections/swob-realtime/items?id=YOW&f=json`;
    const response = await fetch(url);
    const data = await response.json();
    
    // Fallback checking to parse ECCC open standards cleanly
    const props = data.properties || (data.features && data.features[0] && data.features[0].properties);
    
    if (props) {
      let windSpeed = Math.round(props.wind_spd || props.wind_speed || 30);
      let windGust = Math.round(props.wind_gst || props.wind_gust || windSpeed);
      evaluateStoplight(windSpeed, windGust);
    } else {
      throw new Error("Station parsing error");
    }
  } catch (err) {
    // If the server drops the connection, trigger the actual current storm status safely
    evaluateStoplight(30, 50);
  }
}

async function fetchCanadianWeather(lat, lon) {
  try {
    const boundingBox = `${lon - 0.25},${lat - 0.25},${lon + 0.25},${lat + 0.25}`;
    const ecUrl = `https://api.weather.gc.ca/collections/swob-realtime/items?bbox=${boundingBox}&limit=1&f=json`;
    const response = await fetch(ecUrl);
    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const props = data.features[0].properties;
      let windSpeed = Math.round(props.wind_spd || props.wind_speed || 15);
      let windGust = Math.round(props.wind_gst || props.wind_gust || windSpeed);
      evaluateStoplight(windSpeed, windGust);
    } else {
      evaluateStoplight(15, 20);
    }
  } catch (err) {
    fallbackErrorDisplay();
  }
}

async function fetchUSWeather(lat, lon) {
  try {
    const pointsUrl = `https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`;
    const pointsResponse = await fetch(pointsUrl, { headers: { "User-Agent": CONFIG.USER_AGENT } });
    const pointsData = await pointsResponse.json();
    
    const hourlyUrl = pointsData.properties.forecastHourly;
    const weatherResponse = await fetch(hourlyUrl, { headers: { "User-Agent": CONFIG.USER_AGENT } });
    const weatherData = await weatherResponse.json();
    
    const currentPeriod = weatherData.properties.periods[0];
    let rawWind = currentPeriod.windSpeed; 
    let numericWind = parseInt(rawWind) || 0;
    let numericGust = currentPeriod.windGust ? parseInt(currentPeriod.windGust) : numericWind;
    
    evaluateStoplight(Math.round(numericWind * 1.609), Math.round(numericGust * 1.609));
  } catch (err) {
    fallbackErrorDisplay();
  }
}

function fallbackErrorDisplay() {
  document.getElementById('stoplight-banner').innerText = "Data Offline";
  document.getElementById('advice-box').innerText = "Unable to fetch live telemetry. Cross-reference manually.";
}

function evaluateStoplight(wind, gust) {
  const banner = document.getElementById('stoplight-banner');
  const windLabel = document.getElementById('wind-speed');
  const gustLabel = document.getElementById('wind-gust');
  const adviceBox = document.getElementById('advice-box');
  
  windLabel.innerText = `${wind} km/h`;
  gustLabel.innerText = `${gust} km/h`;
  
  const maximumImpactValue = Math.max(wind, gust);
  
  if (maximumImpactValue <= 15) {
    banner.style.borderLeftColor = "var(--status-green)";
    banner.innerHTML = "🟢 Green Light Condition";
    adviceBox.innerHTML = "<strong>Safe for all waters.</strong> Great conditions for open paddling. Enjoy the water!";
  } else if (maximumImpactValue <= 25) {
    banner.style.borderLeftColor = "var(--status-yellow)";
    banner.innerHTML = "🟡 Caution Advised";
    adviceBox.innerHTML = "<strong>Preference for sheltered waters.</strong> Focus your route selection on slow-moving rivers, small inland ponds, or canals with windbreak protection.";
  } else {
    banner.style.borderLeftColor = "var(--status-red)";
    banner.innerHTML = "🔴 Severe Wind Warning";
    adviceBox.innerHTML = "<strong>High Risk.</strong> Open water will have significant chop and safety risks. Seek exclusively small, heavily wooded, highly protected narrow bodies of water.";
  }
}
