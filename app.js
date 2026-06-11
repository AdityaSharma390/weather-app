// ── Config ──────────────────────────────────────────────
const API_KEY = '14404284d5eb9157a4c374e068e849ba';

// ── DOM Helpers ──────────────────────────────────────────
const $ = id => document.getElementById(id);

document.addEventListener('DOMContentLoaded', () => {
  $('cityInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') getWeather();
  });
});

function setStatus(msg) { $('status').textContent = msg; }
function showErr(msg) {
  const box = $('errBox');
  box.textContent = msg;
  box.style.display = 'block';
  $('result').style.display = 'none';
}
function hideErr() { $('errBox').style.display = 'none'; }

// ── Utility Functions ────────────────────────────────────

function formatTime(unix, offsetSec) {
  const d = new Date((unix + offsetSec) * 1000);
  let h = d.getUTCHours(), m = d.getUTCMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${ampm}`;
}

function formatLocalDate(unix, offsetSec) {
  const d = new Date((unix + offsetSec) * 1000);
  const days   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${days[d.getUTCDay()]}, ${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}

function getMoonPhase() {
  // Approximate current moon phase
  const known = new Date('2000-01-06').getTime();
  const now   = Date.now();
  const cycle = 29.53058867 * 24 * 3600 * 1000;
  const phase = ((now - known) % cycle) / cycle;
  const v = phase < 0 ? phase + 1 : phase;
  if (v < 0.03 || v > 0.97) return 'New Moon';
  if (v < 0.22) return 'Waxing Crescent';
  if (v < 0.28) return 'First Quarter';
  if (v < 0.47) return 'Waxing Gibbous';
  if (v < 0.53) return 'Full Moon';
  if (v < 0.72) return 'Waning Gibbous';
  if (v < 0.78) return 'Last Quarter';
  return 'Waning Crescent';
}

function getWindDirection(deg) {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function getUVInfo(uvi) {
  if (uvi <= 2)  return { label: 'Low',       cls: 'b-green' };
  if (uvi <= 5)  return { label: 'Moderate',  cls: 'b-amber' };
  if (uvi <= 7)  return { label: 'High',      cls: 'b-amber' };
  if (uvi <= 10) return { label: 'Very High', cls: 'b-red'   };
  return             { label: 'Extreme',   cls: 'b-red'   };
}

function buildBar(percent, colorClass) {
  const pct = Math.min(100, Math.round(percent));
  return `<div class="bar-track"><div class="bar-fill ${colorClass}" style="width:${pct}%"></div></div>`;
}

// ── Main Fetch Logic ─────────────────────────────────────

async function getWeather() {
  const city = $('cityInput').value.trim();
  if (!city) { showErr('Please enter a city name.'); return; }

  hideErr();
  $('searchBtn').disabled = true;
  $('result').style.display = 'none';
  setStatus('Fetching weather data…');

  try {
    // Current Weather API 2.5 — works with all free keys
    const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${API_KEY}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.cod && data.cod !== 200) {
      const errMsgs = {
        '401': 'Invalid API key. Get one free at openweathermap.org.',
        '404': `City "${city}" not found. Check the spelling or try adding a country, e.g. "Paris, FR".`,
        '429': 'Too many requests. Please wait a moment and try again.'
      };
      showErr(errMsgs[String(data.cod)] || `Error ${data.cod}: ${data.message}`);
      setStatus('');
      return;
    }

    // Also fetch UV index using lat/lon from current weather
    let uvi = 0;
    try {
      const uvRes  = await fetch(`https://api.openweathermap.org/data/2.5/uvi?lat=${data.coord.lat}&lon=${data.coord.lon}&appid=${API_KEY}`);
      const uvData = await uvRes.json();
      uvi = uvData.value ?? 0;
    } catch (_) { /* UV optional */ }

    renderWeather(data, uvi);
    setStatus('');

  } catch (err) {
    showErr('Network error. Check your internet connection and try again.');
    setStatus('');
  } finally {
    $('searchBtn').disabled = false;
  }
}

// ── Render Function ──────────────────────────────────────

function renderWeather(d, uvi) {
  const offset    = d.timezone; // seconds from UTC
  const icon      = d.weather[0]?.icon;
  const iconUrl   = icon ? `https://openweathermap.org/img/wn/${icon}@2x.png` : null;
  const iconHtml  = iconUrl
    ? `<div class="hero-icon"><img src="${iconUrl}" alt="${d.weather[0].description}"/></div>`
    : `<i class="ti ti-cloud" style="font-size:60px;color:#9ca3af;"></i>`;

  const sunrise   = d.sys?.sunrise ? formatTime(d.sys.sunrise, offset) : '—';
  const sunset    = d.sys?.sunset  ? formatTime(d.sys.sunset,  offset) : '—';
  const moonLabel = getMoonPhase();
  const dateStr   = `${formatLocalDate(d.dt, offset)} · ${formatTime(d.dt, offset)}`;

  const rain      = d.rain?.['1h'] ?? d.rain?.['3h'] ?? null;
  const snow      = d.snow?.['1h'] ?? d.snow?.['3h'] ?? null;
  const precip    = rain ?? snow ?? 0;
  const precipType = snow != null ? 'Snow' : rain != null ? 'Rain' : 'None';

  const windKmh   = Math.round((d.wind?.speed || 0) * 3.6);
  const gustKmh   = d.wind?.gust ? Math.round(d.wind.gust * 3.6) : null;
  const windDeg   = d.wind?.deg ?? 0;
  const visKm     = d.visibility ? (d.visibility / 1000).toFixed(1) : '—';

  const humidity  = d.main?.humidity ?? 0;
  const dewPoint  = Math.round(d.main?.temp - ((100 - humidity) / 5));
  const pressure  = d.main?.pressure ?? '—';
  const clouds    = d.clouds?.all ?? 0;
  const uvInfo    = getUVInfo(uvi);
  const uviFixed  = parseFloat(uvi).toFixed(1);

  const lat = d.coord?.lat?.toFixed(2);
  const lon = d.coord?.lon?.toFixed(2);
  const locationStr = [d.name, d.sys?.country].filter(Boolean).join(', ');

  const html = `
    <!-- City Header -->
    <div class="city-name">${locationStr}</div>
    <div class="city-sub">${dateStr} · ${lat}°N, ${lon}°E</div>

    <!-- Hero Condition -->
    <div class="hero">
      ${iconHtml}
      <div class="hero-right">
        <div class="hero-cond">${d.weather[0]?.main || '—'}</div>
        <div class="hero-desc">${d.weather[0]?.description || ''}</div>
        <div class="temp-row">
          <span class="temp-big">${Math.round(d.main.temp)}°C</span>
          <span class="temp-feels">feels like ${Math.round(d.main.feels_like)}°C</span>
        </div>
        <div class="temp-range">
          <span><i class="ti ti-arrow-down"></i> ${Math.round(d.main.temp_min)}°C</span>
          <span><i class="ti ti-arrow-up"></i> ${Math.round(d.main.temp_max)}°C</span>
        </div>
      </div>
    </div>

    <!-- Atmosphere -->
    <div class="slbl">Atmosphere</div>
    <div class="grid">
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-droplet"></i> Humidity</div>
        <div class="sc-val">${humidity}<span class="sc-u">%</span></div>
      </div>
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-droplet-half-2"></i> Dew point</div>
        <div class="sc-val">${dewPoint}<span class="sc-u">°C</span></div>
      </div>
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-gauge"></i> Pressure</div>
        <div class="sc-val" style="font-size:17px">${pressure}<span class="sc-u"> hPa</span></div>
      </div>
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-cloud"></i> Cloud cover</div>
        <div class="sc-val">${clouds}<span class="sc-u">%</span></div>
      </div>
    </div>

    <div class="bar-box">
      <div class="bar-lbl"><span><i class="ti ti-droplet"></i> Humidity</span><span>${humidity}%</span></div>
      ${buildBar(humidity, 'b-blue')}
    </div>
    <div class="bar-box">
      <div class="bar-lbl"><span><i class="ti ti-cloud"></i> Cloud cover</span><span>${clouds}%</span></div>
      ${buildBar(clouds, 'b-blue')}
    </div>

    <!-- Wind -->
    <div class="slbl">Wind</div>
    <div class="grid">
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-wind"></i> Speed</div>
        <div class="sc-val">${windKmh}<span class="sc-u"> km/h</span></div>
      </div>
      ${gustKmh != null ? `
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-wind"></i> Gusts</div>
        <div class="sc-val">${gustKmh}<span class="sc-u"> km/h</span></div>
      </div>` : ''}
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-compass"></i> Direction</div>
        <div class="sc-val" style="font-size:17px">${getWindDirection(windDeg)} <span class="sc-u">${windDeg}°</span></div>
      </div>
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-eye"></i> Visibility</div>
        <div class="sc-val">${visKm}<span class="sc-u"> km</span></div>
      </div>
    </div>

    <!-- Precipitation -->
    <div class="slbl">Precipitation</div>
    <div class="grid">
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-umbrella"></i> Last hour</div>
        <div class="sc-val">${parseFloat(precip).toFixed(1)}<span class="sc-u"> mm/h</span></div>
      </div>
      <div class="sc">
        <div class="sc-lbl"><i class="ti ti-cloud-rain"></i> Type</div>
        <div class="sc-val" style="font-size:17px">${precipType}</div>
      </div>
    </div>

    <!-- UV Index -->
    <div class="slbl">UV Index</div>
    <div class="sc" style="margin-bottom:0.5rem">
      <div class="sc-lbl"><i class="ti ti-sun"></i> UV index · ${uvInfo.label}</div>
      <div class="sc-val">${uviFixed}<span class="sc-u"> / 11</span></div>
    </div>
    <div class="bar-box">
      <div class="bar-lbl"><span>UV level</span><span>${uviFixed}</span></div>
      ${buildBar((uvi / 11) * 100, uvInfo.cls)}
    </div>

    <!-- Sun & Moon -->
    <div class="slbl">Sun & Moon</div>
    <div class="sun-grid">
      <div class="sun-card">
        <i class="ti ti-sunrise sun-icon-rise"></i>
        <div>
          <div class="sun-lbl">Sunrise</div>
          <div class="sun-val">${sunrise}</div>
        </div>
      </div>
      <div class="sun-card">
        <i class="ti ti-sunset sun-icon-set"></i>
        <div>
          <div class="sun-lbl">Sunset</div>
          <div class="sun-val">${sunset}</div>
        </div>
      </div>
      <div class="sun-card">
        <i class="ti ti-moon sun-icon-moon"></i>
        <div>
          <div class="sun-lbl">Moon phase</div>
          <div class="sun-val" style="font-size:13px">${moonLabel}</div>
        </div>
      </div>
    </div>
  `;

  $('result').innerHTML = html;
  $('result').style.display = 'block';
}