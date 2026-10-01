const API_KEY = '5a820fa7661bba61ada2b6a189c38751';

const defaultLocation = {
  lat: 25.0330,
  lon: 121.5654,
  label: '台北市（預設）'
};

const ui = {
  statusBadge: document.getElementById('statusBadge'),
  location: document.getElementById('location'),
  temp: document.getElementById('temp'),
  feelsLike: document.getElementById('feelsLike'),
  humidity: document.getElementById('humidity'),
  description: document.getElementById('description'),
  updatedAt: document.getElementById('updatedAt'),
  icon: document.getElementById('icon'),
  message: document.getElementById('message'),
  refreshBtn: document.getElementById('refreshBtn'),
  notifyBtn: document.getElementById('notifyBtn'),
  testNotifyBtn: document.getElementById('testNotifyBtn'),
};

let lastWeather = null;
let lastLocationLabel = '';

function setStatus(text) {
  ui.statusBadge.textContent = text;
}

function setMessage(text, tone = 'info') {
  ui.message.textContent = text;
  ui.message.dataset.tone = tone;
}

function formatTime(date = new Date()) {
  return new Intl.DateTimeFormat('zh-Hant-TW', {
    hour12: false,
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

async function fetchWeather({ lat, lon, label }) {
  if (!API_KEY || API_KEY === 'YOUR_API_KEY') {
    setMessage('請先在 app.js 填入 OpenWeatherMap 的 API Key。', 'warn');
    return;
  }

  const url = new URL('https://api.openweathermap.org/data/2.5/weather');
  url.searchParams.set('lat', lat);
  url.searchParams.set('lon', lon);
  url.searchParams.set('appid', API_KEY);
  url.searchParams.set('units', 'metric');
  url.searchParams.set('lang', 'zh_tw');

  setStatus('正在取得天氣資料…');
  setMessage('');
  ui.refreshBtn.disabled = true;

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`無法取得天氣資料 (HTTP ${res.status})`);
    }
    const data = await res.json();
    lastWeather = data;
    lastLocationLabel = label || data.name || '';
    renderWeather(data, label);
    setStatus('已更新');
  } catch (err) {
    console.error(err);
    setStatus('更新失敗');
    setMessage(err.message || '取得天氣失敗，請稍後再試。', 'error');
  } finally {
    ui.refreshBtn.disabled = false;
  }
}

function renderWeather(data, labelFallback) {
  const { name, main, weather } = data;
  const weatherItem = weather && weather[0] ? weather[0] : {};

  const locationLabel = name || labelFallback || '未知地區';
  ui.location.textContent = labelFallback ? `${locationLabel} · ${labelFallback}` : locationLabel;

  ui.temp.textContent = main && Number.isFinite(main.temp)
    ? `${Math.round(main.temp)}°C`
    : '--°C';

  ui.feelsLike.textContent = main && Number.isFinite(main.feels_like)
    ? `${Math.round(main.feels_like)}°C`
    : '—';

  ui.humidity.textContent = main && Number.isFinite(main.humidity)
    ? `${Math.round(main.humidity)}%`
    : '—';

  ui.description.textContent = weatherItem.description || '—';

  const iconCode = weatherItem.icon;
  if (iconCode) {
    ui.icon.src = `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
    ui.icon.alt = weatherItem.description || '天氣圖示';
  } else {
    ui.icon.src = '';
    ui.icon.alt = '';
  }

  ui.updatedAt.textContent = formatTime();
  updateNotificationButtonState();
}

function attemptGeolocation() {
  if (!('geolocation' in navigator)) {
    setStatus('裝置不支援定位，改用預設城市');
    setMessage('此瀏覽器不支援定位，改為顯示台北市天氣。');
    fetchWeather(defaultLocation);
    return;
  }

  setStatus('正在要求定位權限…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      setStatus('已取得定位');
      fetchWeather({ lat: latitude, lon: longitude, label: '目前位置' });
    },
    (err) => {
      console.warn('Geolocation error', err);
      setStatus('定位失敗，改用預設城市');
      setMessage('無法取得定位，改為顯示台北市天氣。');
      fetchWeather(defaultLocation);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    }
  );
}

function updateNotificationButtonState() {
  if (typeof Notification === 'undefined') {
    ui.notifyBtn.disabled = true;
    ui.testNotifyBtn.disabled = true;
    return;
  }
  const permission = Notification.permission;
  ui.testNotifyBtn.disabled = permission !== 'granted' || !lastWeather;
  ui.notifyBtn.textContent = permission === 'granted' ? '通知已開啟' : '開啟天氣通知';
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    setMessage('此瀏覽器不支援通知功能。', 'warn');
    return;
  }
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    setMessage('已開啟通知，可以發送測試通知。');
  } else if (permission === 'denied') {
    setMessage('通知權限被拒絕，如需使用請在瀏覽器設定中開啟。', 'warn');
  }
  updateNotificationButtonState();
}

function sendTestNotification() {
  if (!lastWeather) {
    setMessage('尚未取得天氣資料，請先點擊「重新取得天氣」。', 'warn');
    return;
  }
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    setMessage('通知尚未啟用。', 'warn');
    return;
  }

  const { main, weather } = lastWeather;
  const weatherItem = weather && weather[0] ? weather[0] : {};
  const temp = main && Number.isFinite(main.temp) ? `${Math.round(main.temp)}°C` : '';
  const body = [temp, weatherItem.description].filter(Boolean).join(' · ');
  const iconCode = weatherItem.icon;

  new Notification('即時天氣通知', {
    body: body || '天氣更新',
    icon: iconCode ? `https://openweathermap.org/img/wn/${iconCode}@2x.png` : undefined,
  });
}

function bindEvents() {
  ui.refreshBtn.addEventListener('click', () => {
    if (lastWeather && lastWeather.coord) {
      fetchWeather({
        lat: lastWeather.coord.lat,
        lon: lastWeather.coord.lon,
        label: lastLocationLabel,
      });
    } else {
      attemptGeolocation();
    }
  });

  ui.notifyBtn.addEventListener('click', requestNotificationPermission);
  ui.testNotifyBtn.addEventListener('click', sendTestNotification);
}

function init() {
  bindEvents();
  updateNotificationButtonState();
  attemptGeolocation();
}

document.addEventListener('DOMContentLoaded', init);
