import serial
import requests
import time

SERIAL_PORT = 'COM5'
BAUD_RATE   = 9600
API_URL     = 'https://agriintel-smart-farming.onrender.com/sensors/update'
CROP        = 'rice'

print(f"Connecting to Arduino on {SERIAL_PORT}...")

try:
    ser = serial.Serial(SERIAL_PORT, BAUD_RATE, timeout=2)
    print("Connected! Sending live data to AgriIntel...")
    time.sleep(2)
except Exception as e:
    print(f"Cannot open port: {e}")
    exit()

print("-" * 50)

while True:
    try:
        line = ser.readline().decode('utf-8').strip()

        # Skip empty lines or lines that don't have exactly 3 comma-separated values
        if not line:
            continue
        parts = line.split(',')
        if len(parts) != 3:
            continue

        # Skip if any part is empty or not a valid number
        if any(p.strip() == '' for p in parts):
            continue

        moisture    = float(parts[0].strip())
        humidity    = float(parts[1].strip())
        temperature = float(parts[2].strip())

        print(f"Moisture: {moisture}%  Humidity: {humidity}%  Temp: {temperature}C")

        response = requests.post(API_URL, json={
            'moisture'   : moisture,
            'humidity'   : humidity,
            'temperature': temperature,
            'crop'       : CROP
        }, timeout=30)

        print(f"Sent to website successfully")
        print("-" * 50)

    except KeyboardInterrupt:
        print("\nStopped.")
        ser.close()
        break
    except ValueError as e:
        # Silently skip bad lines from Arduino
        continue
    except Exception as e:
        print(f"Error: {e}")

    time.sleep(2)