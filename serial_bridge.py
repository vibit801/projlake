import os
import re
import time
import requests
import serial

# Update SERIAL_PORT to match your Arduino Uno port:
# - Linux: "/dev/ttyACM0" or "/dev/ttyUSB0"
# - Windows: "COM3", "COM4", etc.
SERIAL_PORT = os.getenv("SERIAL_PORT", "/dev/ttyACM0")
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

# Matches lines like: TURB:120,TDS:340,PH:7.12
LINE_PATTERN = re.compile( r"TURB\s*:\s*(-?\d+)\s*,\s*TDS\s*:\s*(-?\d+)\s*,\s*PH\s*:\s*(-?\d+(?:\.\d+)?)")

def connect_serial(port: str, baud: int) -> serial.Serial:
    while True:
        try:
            ser = serial.Serial(port, baud, timeout=2)
            time.sleep(2)  # Wait for Arduino Uno auto-reset on serial open
            print(f"Connected to {port} at {baud} baud.")
            return ser
        except serial.SerialException as exc:
            print(f"Waiting for serial port {port}... ({exc})")
            time.sleep(2)


def post_reading(payload: dict) -> None:
    try:
        resp = requests.post(REST_URL, headers=HEADERS, json=payload, timeout=5)
        if resp.status_code in (200, 201, 204):
            print(f"Inserted -> {payload} (HTTP {resp.status_code})")
        else:
            print(f"Insert failed -> {payload} (HTTP {resp.status_code}): {resp.text}")
    except requests.RequestException as exc:
        print(f"Network/Supabase error: {exc}")


def main() -> None:
    ser = connect_serial(SERIAL_PORT, BAUD_RATE)

    try:
        while True:
            try:
                raw_line = ser.readline().decode("utf-8", errors="ignore").strip()
                if not raw_line:
                    continue

                match = LINE_PATTERN.search(raw_line)
                if match:
                    payload = {
                        "turbidity": int(match.group(1)),
                        "tds": int(match.group(2)),
                        "ph": float(match.group(3)),
                    }
                    post_reading(payload)
                else:
                    print(f"Ignored non-matching line: {raw_line}")

            except serial.SerialException as exc:
                print(f"Serial disconnected ({exc}). Reconnecting...")
                ser.close()
                ser = connect_serial(SERIAL_PORT, BAUD_RATE)

    except KeyboardInterrupt:
        print("\nStopping serial bridge.")
    finally:
        if ser.is_open:
            ser.close()


if __name__ == "__main__":
    main()