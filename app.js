// App State Configuration
const CONFIG = {
  USER_AGENT: "PaddleScoutPWA/1.0",
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
      fetchLiveWeather(lat, lon);
    },
    (error) => {
      banner.style.borderLeftColor = "var(--status-red)";
      banner.innerText = "Location access denied";
      document.getElementById('advice-box').innerText = "Please enable GPS tracking access to populate local weather conditions.";
    }
  );
}

// UNBLOCKED PUBLIC WEATHER PIPELINE
async function fetchLiveWeather(lat, lon) {
  try {
    // Open-Meteo explicitly allows browser access and automatically routes to the nearest local telemetry station
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=wind_speed_10m,wind_gusts_10m&wind_speed_unit=kmh`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error("Network response was not stable");
    
    const data = await response.json();
    
    if (data && data.current) {
      const windSpeed = Math.round(data.current.wind_speed_10m);
      const windGust = Math.round(data.current.wind_gusts_10m);
      
      evaluateStoplight(windSpeed, windGust);
    } else {
      throw new Error("Data format unexpected");
    }
  } catch (err) {
    fallbackErrorDisplay();
  }
}

function fallbackErrorDisplay() {
  document.getElementById('stoplight-banner').style.borderLeftColor = "var(--status-red)";
  document.getElementById('stoplight-banner').innerText = "Telemetry Offline";
  document.getElementById('wind-speed').innerText = "--";
  document.getElementById('wind-gust').innerText = "--";
  document.getElementById('advice-box').innerText = "Unable to bypass security rules. Cross-reference local wind data manually before launching.";
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
