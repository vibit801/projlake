const SUPABASE_URL = "https://jvkdmfeoefrpkejjdmyk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tD3xBAd-rLkR4BW7fr1G9Q_xz1Fl_Fp";
const TABLE_NAME = "sensor_readings";
const POLL_INTERVAL_MS = 2000;
const MAX_ROWS = 500;

const views = {
  home: document.getElementById("home"),
  data: document.getElementById("data"),
  bridge: document.getElementById("bridge"),
  test: document.getElementById("test"),
};

const bridgeBtn = document.getElementById("bridge-btn");
const testBtn = document.getElementById("test-btn");
const toastEl = document.getElementById("toast");

// Bridge test mode elements
const phEl = document.getElementById("ph-value");
const tdsEl = document.getElementById("tds-value");
const turbEl = document.getElementById("turb-value");
const updatedEl = document.getElementById("last-updated");
const bridgeHistoryBody = document.getElementById("bridge-history-body");
const statusEl = document.getElementById("status");

const supabaseHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

let pollTimer = null;
let lastId = null;
let hasBridgeRows = false;
let toastTimer = null;

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.hidden = true;
  }, 3000);
}

function showView(name) {
  Object.entries(views).forEach(([key, el]) => {
    el.hidden = key !== name;
  });
  bridgeBtn.classList.toggle("active", name === "bridge");
  testBtn.classList.toggle("active", name === "test");

  if (name === "bridge") {
    startBridgePolling();
  } else {
    stopBridgePolling();
  }
}

function fmtPh(v) {
  return v !== null && v !== undefined ? Number(v).toFixed(2) : "--";
}

function bridgeRowHtml(r) {
  return `
    <tr>
      <td>${new Date(r.created_at).toLocaleTimeString()}</td>
      <td>${fmtPh(r.ph)}</td>
      <td>${r.tds ?? "--"}</td>
      <td>${r.turbidity ?? "--"}</td>
    </tr>`;
}

async function querySupabase(params) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?${params}`;
  const res = await fetch(url, { headers: supabaseHeaders, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function pollBridge() {
  try {
    if (lastId === null) {
      const latest = await querySupabase("select=id&order=id.desc&limit=1");
      lastId = latest.length ? latest[0].id : 0;
      bridgeHistoryBody.innerHTML =
        `<tr><td colspan="4">Waiting for new readings...</td></tr>`;
      updatedEl.textContent = "--";
      statusEl.textContent = "Live";
      statusEl.className = "pill ok";
      return;
    }

    const rows = await querySupabase(
      `select=id,created_at,ph,tds,turbidity&id=gt.${lastId}&order=id.asc&limit=200`
    );

    statusEl.textContent = "Live";
    statusEl.className = "pill ok";

    if (!rows.length) return;

    if (!hasBridgeRows) {
      bridgeHistoryBody.innerHTML = "";
      hasBridgeRows = true;
    }

    bridgeHistoryBody.insertAdjacentHTML(
      "afterbegin",
      rows.slice().reverse().map(bridgeRowHtml).join("")
    );
    while (bridgeHistoryBody.rows.length > MAX_ROWS) {
      bridgeHistoryBody.deleteRow(-1);
    }

    const latest = rows[rows.length - 1];
    lastId = latest.id;
    phEl.textContent = fmtPh(latest.ph);
    tdsEl.textContent = latest.tds ?? "--";
    turbEl.textContent = latest.turbidity ?? "--";
    updatedEl.textContent = new Date(latest.created_at).toLocaleString();
  } catch (err) {
    statusEl.textContent = "Sync Error";
    statusEl.className = "pill";
    statusEl.style.color = "var(--warn)";
    console.error("Failed to load readings:", err);
  }
}

function startBridgePolling() {
  stopBridgePolling();
  lastId = null;
  hasBridgeRows = false;
  statusEl.style.color = "";
  statusEl.textContent = "Connecting...";
  statusEl.className = "pill";
  pollBridge();
  pollTimer = setInterval(pollBridge, POLL_INTERVAL_MS);
}

function stopBridgePolling() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

bridgeBtn.addEventListener("click", () => {
  showView(views.bridge.hidden ? "bridge" : "home");
});

testBtn.addEventListener("click", () => {
  showView(views.test.hidden ? "test" : "home");
});

document.querySelectorAll("[data-back]").forEach((btn) => {
  btn.addEventListener("click", () => showView("home"));
});

document.getElementById("schedule-btn")?.addEventListener("click", () => {
  showToast("Notifying ESP32 to stay awake and enable Wi-Fi...");
});

document.getElementById("history-btn")?.addEventListener("click", () => {
  showView("data");
});

const analysisToggle = document.getElementById("analysis-toggle");
const analysisBox = document.getElementById("analysis");
analysisToggle?.addEventListener("change", () => {
  analysisBox.hidden = !analysisToggle.checked;
});

document.getElementById("print-btn")?.addEventListener("click", () => {
  window.print();
});

showView("home");