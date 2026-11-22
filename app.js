const SUPABASE_URL = "https://jvkdmfeoefrpkejjdmyk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tD3xBAd-rLkR4BW7fr1G9Q_xz1Fl_Fp";
const TABLE_NAME = "sensor_readings";
const POLL_INTERVAL_MS = 2000;
const MAX_ROWS = 500; // cap rows kept in the table

const phEl = document.getElementById("ph-value");
const tdsEl = document.getElementById("tds-value");
const turbEl = document.getElementById("turb-value");
const updatedEl = document.getElementById("last-updated");
const historyBody = document.getElementById("history-body");
const statusEl = document.getElementById("status");

const headers = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
};

let lastId = null; // null = baseline not set yet
let hasRows = false;

function fmtPh(v) {
  return v !== null && v !== undefined ? Number(v).toFixed(2) : "--";
}

function rowHtml(r) {
  return `
    <tr>
      <td>${new Date(r.created_at).toLocaleTimeString()}</td>
      <td>${fmtPh(r.ph)}</td>
      <td>${r.tds ?? "--"}</td>
      <td>${r.turbidity ?? "--"}</td>
    </tr>`;
}

async function query(params) {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?${params}`;
  const res = await fetch(url, { headers, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function poll() {
  try {
    // First call: set the baseline so old readings are not shown
    if (lastId === null) {
      const latest = await query("select=id&order=id.desc&limit=1");
      lastId = latest.length ? latest[0].id : 0;
      historyBody.innerHTML =
        `<tr><td colspan="4">Waiting for new readings...</td></tr>`;
      updatedEl.textContent = "--";
      statusEl.textContent = "Live";
      statusEl.style.color = "#b589d6";
      return;
    }

    // Later calls: only rows newer than the last one seen
    const rows = await query(
      `select=id,created_at,ph,tds,turbidity&id=gt.${lastId}&order=id.asc&limit=200`
    );

    statusEl.textContent = "Live";
    statusEl.style.color = "#b589d6";

    if (!rows.length) return;

    if (!hasRows) {
      historyBody.innerHTML = "";
      hasRows = true;
    }

    // Newest on top
    historyBody.insertAdjacentHTML(
      "afterbegin",
      rows.slice().reverse().map(rowHtml).join("")
    );
    while (historyBody.rows.length > MAX_ROWS) {
      historyBody.deleteRow(-1);
    }

    const latest = rows[rows.length - 1];
    lastId = latest.id;
    phEl.textContent = fmtPh(latest.ph);
    tdsEl.textContent = latest.tds ?? "--";
    turbEl.textContent = latest.turbidity ?? "--";
    updatedEl.textContent = new Date(latest.created_at).toLocaleString();
  } catch (err) {
    statusEl.textContent = "Sync Error";
    statusEl.style.color = "#c9646b";
    console.error("Failed to load readings:", err);
  }
}

poll();
setInterval(poll, POLL_INTERVAL_MS);