import gdown
import os
import sys
import json
import time
import warnings
import numpy as np
import joblib

from flask import Flask, request, jsonify
from flask_cors import CORS

warnings.filterwarnings('ignore')

# ==============================

# PATH SETUP

# ==============================

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'models')
os.makedirs(MODEL_DIR, exist_ok=True)

# ==============================

# MODEL FILES

# ==============================

MODEL_FILES = {
'random_forest.pkl'         : '11R9TQf5aYn0PVobQUgXg1q2GNS0zcq6G',
'scaler.pkl'                : '1RajjlR5nlLAb9VKQq45TzEiWWQ-mc25a',
'label_encoder.pkl'         : '1kZ4p5tlDyKV3DJ8rhpviAAHd85JYgLZC',
'yield_model.pkl'           : '10i3Vhipy07hX7ipQdwkISAQOABhvohAa',
'yield_scaler.pkl'          : '11hBnJay_odIVntR2Im_TCVlSh3hlHtJK',
'disease_db.json'           : '1BCEWzVAXHMcjceev_fGBigI3gTN3g4zk',
'disease_cnn.h5'            : '1e4rCJ9LiP2XmmS9aW0ZpOS7hVzq3HGxB',
'disease_class_labels.json' : '1iEfpO6ObScyikuwqlCJtxoaZzab287EF',
}

# ==============================

# DOWNLOAD FUNCTION

# ==============================

def download_file(file_id, filepath):
url = f'https://drive.google.com/uc?id={file_id}'
try:
print(f"Downloading {os.path.basename(filepath)}...")
result = gdown.download(url, filepath, quiet=False, fuzzy=True)

```
    if result is None or not os.path.exists(filepath) or os.path.getsize(filepath) == 0:
        raise Exception("Download failed or file empty")

    print(f"✅ Downloaded {os.path.basename(filepath)}")
    return True

except Exception as e:
    print(f"❌ Error downloading {filepath}: {e}")
    return False
```

# ==============================

# CHECK & DOWNLOAD MODELS

# ==============================

print("=== Checking model files ===")
failed_files = []

for filename, file_id in MODEL_FILES.items():
filepath = os.path.join(MODEL_DIR, filename)

```
if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
    size = os.path.getsize(filepath) / (1024 * 1024)
    print(f"✔ Found {filename} ({size:.2f} MB)")
else:
    success = download_file(file_id, filepath)
    if not success:
        failed_files.append(filename)
```

if failed_files:
print("\n❌ Failed downloads:", failed_files)
print("Check Google Drive permissions (must be public)")
sys.exit(1)

print("🎉 All models ready!\n")

# ==============================

# LOAD MODELS

# ==============================

crop_model   = joblib.load(os.path.join(MODEL_DIR, 'random_forest.pkl'))
scaler       = joblib.load(os.path.join(MODEL_DIR, 'scaler.pkl'))
le           = joblib.load(os.path.join(MODEL_DIR, 'label_encoder.pkl'))

yield_model  = joblib.load(os.path.join(MODEL_DIR, 'yield_model.pkl'))
yield_scaler = joblib.load(os.path.join(MODEL_DIR, 'yield_scaler.pkl'))

with open(os.path.join(MODEL_DIR, 'disease_db.json')) as f:
DISEASE_DB = json.load(f)

# ==============================

# SAFE CNN LOADING

# ==============================

cnn_model = None
label_map = None

cnn_path = os.path.join(MODEL_DIR, 'disease_cnn.h5')
labels_path = os.path.join(MODEL_DIR, 'disease_class_labels.json')

try:
if os.path.exists(cnn_path) and os.path.exists(labels_path):
from tensorflow.keras.models import load_model
cnn_model = load_model(cnn_path)

```
    with open(labels_path) as f:
        label_map = json.load(f)

    print("✅ CNN model loaded")
```

except Exception as e:
print("⚠ CNN loading failed:", e)
cnn_model = None

# ==============================

# FLASK APP

# ==============================

app = Flask(**name**)
CORS(app)

# ==============================

# HELPERS

# ==============================

def irrigation_advice(rainfall):
if rainfall > 200:
return "Low irrigation needed"
elif rainfall > 100:
return "Moderate irrigation needed"
else:
return "High irrigation required"

def fertilizer_advice(n, p, k):
advice = []
if n < 40:
advice.append("Add Nitrogen fertilizer")
if p < 20:
advice.append("Add Phosphorus fertilizer")
if k < 20:
advice.append("Add Potassium fertilizer")
if not advice:
advice.append("Balanced fertilizer (NPK)")
return advice

def safe_float(data, key):
try:
return float(data.get(key, 0))
except:
return 0.0

# ==============================

# ROUTES

# ==============================

@app.route('/health')
def health():
return jsonify({
"status": "running",
"cnn_loaded": cnn_model is not None
})

# ------------------------------

# CROP RECOMMENDATION

# ------------------------------

@app.route('/recommend', methods=['POST'])
def recommend():
try:
data = request.get_json()
print("Received input:", data)

```
    n    = safe_float(data, 'N')
    p    = safe_float(data, 'P')
    k    = safe_float(data, 'K')
    temp = safe_float(data, 'temperature')
    hum  = safe_float(data, 'humidity')
    ph   = safe_float(data, 'ph')
    rain = safe_float(data, 'rainfall')

    features = scaler.transform([[n, p, k, temp, hum, ph, rain]])

    prediction = crop_model.predict(features)
    prob       = crop_model.predict_proba(features)

    crop = le.inverse_transform(prediction)[0]
    confidence = round(float(np.max(prob)) * 100, 2)

    return jsonify({
        "crop": crop,
        "confidence": confidence,
        "irrigation": irrigation_advice(rain),
        "fertilizer": fertilizer_advice(n, p, k)
    })

except Exception as e:
    return jsonify({"error": str(e)}), 500
```

# ------------------------------

# YIELD PREDICTION

# ------------------------------

@app.route('/yield', methods=['POST'])
def predict_yield():
try:
data = request.get_json()

```
    rainfall    = safe_float(data, 'rainfall')
    pesticides  = safe_float(data, 'pesticides')
    temperature = safe_float(data, 'temperature')
    year        = safe_float(data, 'year')

    features = yield_scaler.transform([[rainfall, pesticides, temperature, year]])
    prediction = yield_model.predict(features)[0]

    return jsonify({
        "yield_tonnes_per_ha": round(prediction / 10000, 3)
    })

except Exception as e:
    return jsonify({"error": str(e)}), 500
```

# ------------------------------

# DISEASE (SYMPTOMS)

# ------------------------------

@app.route('/disease/symptoms', methods=['POST'])
def disease_symptoms():
data = request.get_json()
crop = data.get('crop', '').lower()

```
if crop not in DISEASE_DB:
    return jsonify({"error": "Crop not found"}), 404

return jsonify(DISEASE_DB[crop])
```

# ------------------------------

# SENSOR DATA

# ------------------------------

@app.route('/sensors', methods=['POST'])
def sensors():
data = request.get_json()
moisture = safe_float(data, 'moisture')

```
if moisture < 30:
    status = "Low - Irrigate"
elif moisture < 70:
    status = "Optimal"
else:
    status = "High moisture"

return jsonify({"moisture_status": status})
```

# ==============================

# RUN APP

# ==============================

if **name** == '**main**':
port = int(os.environ.get("PORT", 5000))
app.run(host="0.0.0.0", port=port)
