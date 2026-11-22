const SUPABASE_URL = "https://jvkdmfeoefrpkejjdmyk.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_tD3xBAd-rLkR4BW7fr1G9Q_xz1Fl_Fp";
const TABLE_NAME = "sensor_readings";
const POLL_INTERVAL_MS = 3000;

const phEl = document.getElementById("ph-value");
const tdsEl = document.getElementById("tds-value");
const turbEl = document.getElementById("turb-value");
const updatedEl = document.getElementById("last-updated");
const historyBody = document.getElementById("history-body");
const statusEl = document.getElementById("status");

async function fetchReadings() {
  const url = `${SUPABASE_URL}/rest/v1/${TABLE_NAME}?select=id,created_at,ph,tds,turbidity&order=created_at.desc&limit=10`;

  try {
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const rows = await res.json();
    statusEl.textContent = "Live";
    statusEl.style.color = "#b589d6";

    if (!rows.length) {
      updatedEl.textContent = "No rows yet";
      historyBody.innerHTML = `<tr><td colspan="4">No readings recorded yet.</td></tr>`;
      return;
    }

    const latest = rows[0];
    phEl.textContent = latest.ph !== null ? Number(latest.ph).toFixed(2) : "--";
    tdsEl.textContent = latest.tds !== null ? latest.tds : "--";
    turbEl.textContent = latest.turbidity !== null ? latest.turbidity : "--";
    updatedEl.textContent = new Date(latest.created_at).toLocaleString();

    historyBody.innerHTML = rows
      .map(
        (r) => `
        <tr>
          <td>${new Date(r.created_at).toLocaleTimeString()}</td>
          <td>${r.ph !== null ? Number(r.ph).toFixed(2) : "--"}</td>
          <td>${r.tds ?? "--"}</td>
          <td>${r.turbidity ?? "--"}</td>
        </tr>
      `
      )
      .join("");
  } catch (err) {
    statusEl.textContent = "Sync Error";
    statusEl.style.color = "#c9646b";
    console.error("Failed to load readings:", err);
  }
}

fetchReadings();
setInterval(fetchReadings, POLL_INTERVAL_MS);