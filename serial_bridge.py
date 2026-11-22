import os
import re
import time
import requests
import serial
from serial.tools import list_ports

# Optional manual override: SERIAL_PORT=/dev/ttyACM1 python3 serial_bridge.py
# Leave unset to auto-detect.
SERIAL_PORT = os.getenv("SERIAL_PORT")
BAUD_RATE = 9600

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://jvkdmfeoefrpkejjdmyk.supabase.co")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY", "sb_publishable_tD3xBAd-rLkR4BW7fr1G9Q_xz1Fl_Fp")
TABLE_NAME = "sensor_readings"
REST_URL = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"

HEADERS = {
    "apikey": SUPABASE_API_KEY,
    "Authorization": f"Bearer {SUPABASE_API_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

LINE_PATTERN = re.compile(
    r"TURB\s*:\s*(-?\d+)\s*,\s*TDS\s*:\s*(-?\d+)\s*,\s*PH\s*:\s*(-?\d+(?:\.\d+)?)"
)

# USB vendor IDs: Arduino, Arduino (clone), CH340, FTDI, CP210x
KNOWN_VIDS = {0x2341, 0x2A03, 0x1A86, 0x0403, 0x10C4}
KNOWN_NAMES = ("arduino", "ch340", "usb serial", "cp210", "ftdi", "acm")


def find_port():
    if SERIAL_PORT:
        return SERIAL_PORT
    ports = list(list_ports.comports())
    for p in ports:
        if p.vid in KNOWN_VIDS:
            return p.device
    for p in ports:
        text = f"{p.description} {p.device}".lower()
        if any(k in text for k in KNOWN_NAMES):
            return p.device
    return None


def connect_serial():
    """Block until a board is found and opened."""
    while True:
        port = find_port()
        if port is None:
            print("No Arduino found. Waiting...")
            time.sleep(2)
            continue
        try:
            ser = serial.Serial(port, BAUD_RATE, timeout=2)
            time.sleep(2)  # Arduino auto-resets when the port opens
            ser.reset_input_buffer()
            print(f"Connected to {port} at {BAUD_RATE} baud.")
            return ser
        except (serial.SerialException, OSError) as exc:
            print(f"Could not open {port}: {exc}")
            time.sleep(2)


def post_reading(payload: dict) -> None:
    try:
        resp = requests.post(REST_URL, headers=HEADERS, json=payload, timeout=5)
        if resp.status_code in (200, 201, 204):
            print(f"Inserted -> {payload}")
        else:
            print(f"Insert failed -> {payload} (HTTP {resp.status_code}): {resp.text}")
    except requests.RequestException as exc:
        print(f"Network/Supabase error: {exc}")


def main() -> None:
    ser = connect_serial()
    try:
        while True:
            try:
                raw = ser.readline().decode("utf-8", errors="ignore").strip()
                if not raw:
                    continue
                m = LINE_PATTERN.search(raw)
                if m:
                    post_reading({
                        "turbidity": int(m.group(1)),
                        "tds": int(m.group(2)),
                        "ph": float(m.group(3)),
                    })
                else:
                    print(f"Ignored non-matching line: {raw}")
            except (serial.SerialException, OSError) as exc:
                print(f"Serial lost ({exc}). Reconnecting...")
                try:
                    ser.close()
                except Exception:
                    pass
                ser = connect_serial()
    except KeyboardInterrupt:
        print("\nStopping serial bridge.")
    finally:
        try:
            ser.close()
        except Exception:
            pass


if __name__ == "__main__":
    main()