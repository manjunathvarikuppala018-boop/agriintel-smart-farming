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

BASE_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, 'models')

print(f"Model directory: {MODEL_DIR}")
print(f"Files found: {os.listdir(MODEL_DIR) if os.path.exists(MODEL_DIR) else 'MISSING'}")

app = Flask(__name__)
CORS(app, origins=['http://localhost:5173', 'https://*.vercel.app'])


def safe_load(filename):
    path = os.path.join(MODEL_DIR, filename)
    try:
        model = joblib.load(path)
        print(f"Loaded: {filename}")
        return model
    except Exception as e:
        print(f"Failed: {filename} — {e}")
        return None


crop_model   = safe_load('random_forest.pkl')
scaler       = safe_load('scaler.pkl')
le           = safe_load('label_encoder.pkl')
yield_model  = safe_load('yield_model.pkl')
yield_scaler = safe_load('yield_scaler.pkl')

with open(os.path.join(MODEL_DIR, 'disease_db.json')) as f:
    DISEASE_DB = json.load(f)

cnn_model = None
label_map = None
cnn_path    = os.path.join(MODEL_DIR, 'disease_cnn.h5')
labels_path = os.path.join(MODEL_DIR, 'disease_class_labels.json')

if os.path.exists(cnn_path) and os.path.exists(labels_path):
    try:
        from tensorflow.keras.models import load_model
        cnn_model = load_model(cnn_path)
        with open(labels_path) as f:
            label_map = json.load(f)
        print("CNN model loaded")
    except Exception as e:
        print(f"CNN load failed: {e}")


CROP_MOISTURE = {
    'rice'      : {'min': 60, 'max': 80, 'optimal': 70},
    'wheat'     : {'min': 35, 'max': 55, 'optimal': 45},
    'maize'     : {'min': 40, 'max': 65, 'optimal': 55},
    'cotton'    : {'min': 30, 'max': 50, 'optimal': 40},
    'tomato'    : {'min': 45, 'max': 70, 'optimal': 60},
    'potato'    : {'min': 50, 'max': 75, 'optimal': 65},
    'sugarcane' : {'min': 55, 'max': 80, 'optimal': 70},
    'default'   : {'min': 40, 'max': 65, 'optimal': 55}
}


def irrigation_advice(rainfall, temperature, humidity):
    if rainfall > 200:
        return {
            'level'  : 'Low',
            'amount' : '100-150 mm/season',
            'method' : 'Rainfall is sufficient. Supplement only during dry spells.'
        }
    elif rainfall > 100:
        return {
            'level'  : 'Moderate',
            'amount' : '200-300 mm/season',
            'method' : 'Drip or sprinkler irrigation recommended.'
        }
    else:
        return {
            'level'  : 'High',
            'amount' : '350-500 mm/season',
            'method' : 'Flood or furrow irrigation required. Monitor soil moisture daily.'
        }


def fertilizer_advice(n, p, k):
    advice = []
    if n < 40:
        advice.append('Nitrogen deficient — apply Urea (46-0-0) at 50 kg/ha')
    elif n > 100:
        advice.append('Nitrogen excess — reduce nitrogenous fertilizer')
    if p < 20:
        advice.append('Phosphorus deficient — apply DAP (18-46-0) at 30 kg/ha')
    elif p > 100:
        advice.append('Phosphorus excess — skip phosphatic fertilizers')
    if k < 20:
        advice.append('Potassium deficient — apply MOP (0-0-60) at 25 kg/ha')
    elif k > 150:
        advice.append('Potassium excess — avoid potassic fertilizers')
    if not advice:
        advice.append('Soil nutrients balanced — apply standard NPK 10-10-10')
    return advice


def water_level_recommendation(moisture_pct, crop=None):
    crop_key     = crop.lower() if crop else 'default'
    requirements = CROP_MOISTURE.get(crop_key, CROP_MOISTURE['default'])
    min_req      = requirements['min']
    max_req      = requirements['max']
    optimal      = requirements['optimal']
    deficit      = optimal - moisture_pct

    if moisture_pct < min_req - 10:
        return {'status': 'Critical', 'water_needed': True,
                'action': 'Irrigate immediately', 'urgency': 'High',
                'water_amount_mm': round(deficit * 0.8, 1)}
    elif moisture_pct < min_req:
        return {'status': 'Low', 'water_needed': True,
                'action': 'Irrigation required within 24 hours', 'urgency': 'Medium',
                'water_amount_mm': round(deficit * 0.5, 1)}
    elif moisture_pct <= max_req:
        return {'status': 'Optimal', 'water_needed': False,
                'action': 'No irrigation needed', 'urgency': 'None',
                'water_amount_mm': 0}
    else:
        return {'status': 'Excess', 'water_needed': False,
                'action': 'Stop irrigation. Improve drainage.', 'urgency': 'Low',
                'water_amount_mm': 0}


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status'     : 'running',
        'cnn_loaded' : cnn_model is not None,
        'models'     : ['random_forest', 'yield_model', 'disease_db', 'cnn_image'],
        'version'    : '1.0.0'
    })


@app.route('/recommend', methods=['POST'])
def recommend():
    data = request.get_json()
    required = ['N', 'P', 'K', 'temperature', 'humidity', 'ph', 'rainfall']
    missing  = [f for f in required if f not in data]
    if missing:
        return jsonify({'error': f'Missing fields: {missing}'}), 400

    try:
        n    = float(data['N'])
        p    = float(data['P'])
        k    = float(data['K'])
        temp = float(data['temperature'])
        hum  = float(data['humidity'])
        ph   = float(data['ph'])
        rain = float(data['rainfall'])

        features    = scaler.transform([[n, p, k, temp, hum, ph, rain]])
        prediction  = crop_model.predict(features)
        probability = crop_model.predict_proba(features)
        crop_name   = le.inverse_transform(prediction)[0]
        confidence  = round(float(probability.max()) * 100, 2)

        top3_idx     = np.argsort(probability[0])[::-1][:3]
        alternatives = [
            {'crop': le.inverse_transform([i])[0],
             'confidence': round(float(probability[0][i]) * 100, 2)}
            for i in top3_idx
        ]

        return jsonify({
            'crop'         : crop_name,
            'confidence'   : confidence,
            'alternatives' : alternatives,
            'irrigation'   : irrigation_advice(rain, temp, hum),
            'fertilizer'   : fertilizer_advice(n, p, k),
            'input_summary': {
                'soil'   : {'N': n, 'P': p, 'K': k, 'ph': ph},
                'weather': {'temperature': temp, 'humidity': hum, 'rainfall': rain}
            }
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/yield', methods=['POST'])
def predict_yield():
    data = request.get_json()
    required = ['rainfall', 'temperature', 'pesticides', 'year']
    missing  = [f for f in required if f not in data]
    if missing:
        return jsonify({'error': f'Missing fields: {missing}'}), 400

    try:
        features   = yield_scaler.transform([[
            float(data['rainfall']),
            float(data['pesticides']),
            float(data['temperature']),
            float(data['year'])
        ]])
        prediction = yield_model.predict(features)[0]
        return jsonify({
            'yield_hg_per_ha'    : round(float(prediction), 2),
            'yield_kg_per_ha'    : round(float(prediction) / 10, 2),
            'yield_tonnes_per_ha': round(float(prediction) / 10000, 3)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/disease/symptoms', methods=['POST'])
def disease_symptoms():
    data     = request.get_json()
    crop     = data.get('crop', '').lower().strip()
    symptoms = [s.lower().strip() for s in data.get('symptoms', [])]

    if not crop:
        return jsonify({'error': 'Crop name is required'}), 400
    if crop not in DISEASE_DB:
        return jsonify({'status': 'crop_not_found',
                        'supported_crops': list(DISEASE_DB.keys())}), 404

    results = []
    for disease_name, info in DISEASE_DB[crop].items():
        known   = info['symptoms']
        matched = [s for s in symptoms if any(s in k or k in s for k in known)]
        score   = len(matched) / len(known) if known else 0
        if score > 0:
            results.append({
                'disease'         : disease_name.replace('_', ' ').title(),
                'confidence_pct'  : round(score * 100, 1),
                'severity'        : info['severity'],
                'cause'           : info['cause'],
                'matched_symptoms': matched,
                'treatment'       : info['treatment'],
                'prevention'      : info['prevention'],
                'method'          : 'rule_based'
            })

    results.sort(key=lambda x: x['confidence_pct'], reverse=True)
    return jsonify({'crop': crop,
                    'status': 'found' if results else 'no_match',
                    'results': results})


@app.route('/disease/image', methods=['POST'])
def disease_image():
    if cnn_model is None:
        return jsonify({'error': 'CNN model not loaded',
                        'message': 'Use symptom-based detection instead.'}), 503
    if 'file' not in request.files:
        return jsonify({'error': 'No image file provided'}), 400
    try:
        from PIL import Image
        import io
        file        = request.files['file']
        img         = Image.open(io.BytesIO(file.read())).convert('RGB').resize((64, 64))
        img_array   = np.expand_dims(np.array(img) / 255.0, axis=0)
        predictions = cnn_model.predict(img_array, verbose=0)
        top3_idx    = np.argsort(predictions[0])[::-1][:3]
        results = [
            {'rank'      : i + 1,
             'disease'   : label_map[str(idx)].replace('_', ' ').replace('__', ' - '),
             'confidence': round(float(predictions[0][idx]) * 100, 2)}
            for i, idx in enumerate(top3_idx)
        ]
        return jsonify({'method': 'cnn_image', 'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/sensors', methods=['POST'])
def sensor_reading():
    data        = request.get_json()
    moisture    = float(data.get('moisture', 0))
    humidity    = float(data.get('humidity', 0))
    temperature = float(data.get('temperature', 0))
    crop        = data.get('crop', None)

    humidity_status = (
        'Low'     if humidity < 30  else
        'Optimal' if humidity <= 70 else
        'High'
    )
    humidity_advice = (
        'Risk of drought stress. Consider misting.'
        if humidity < 30 else
        'Humidity levels are ideal for plant growth.'
        if humidity <= 70 else
        'High humidity - risk of fungal disease. Improve ventilation.'
    )
    return jsonify({
        'moisture'   : water_level_recommendation(moisture, crop),
        'humidity'   : {'value': humidity, 'status': humidity_status, 'advice': humidity_advice},
        'temperature': {'value': temperature, 'unit': 'Celsius'},
        'timestamp'  : time.strftime('%Y-%m-%d %H:%M:%S')
    })


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)