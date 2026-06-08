import os
import json
import traceback
import joblib
import numpy as np
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

# Constants
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "best_model.joblib")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.joblib")
METRICS_PATH = os.path.join(BASE_DIR, "model_metrics.json")
DATASET_PATH = os.path.join(BASE_DIR, "dataset_sample.json")

# Global variables for model and scaler
model = None
scaler = None

def load_ml_assets():
    global model, scaler
    try:
        if os.path.exists(MODEL_PATH) and os.path.exists(SCALER_PATH):
            model = joblib.load(MODEL_PATH)
            scaler = joblib.load(SCALER_PATH)
            print("Successfully loaded model and scaler.")
        else:
            print("Warning: model.joblib or scaler.joblib not found. Run train.py first.")
    except Exception as e:
        print(f"Error loading ML assets: {str(e)}")
        traceback.print_exc()

# Load assets on startup
load_ml_assets()

@app.route('/')
def index():
    """Render the dashboard page."""
    return render_template('index.html')

@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    """Return model evaluation metrics."""
    try:
        if os.path.exists(METRICS_PATH):
            with open(METRICS_PATH, 'r') as f:
                metrics = json.load(f)
            return jsonify(metrics)
        else:
            return jsonify({"error": "Metrics file not found. Please train models first."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/dataset', methods=['GET'])
def get_dataset():
    """Return California housing dataset statistics and sample rows."""
    try:
        if os.path.exists(DATASET_PATH):
            with open(DATASET_PATH, 'r') as f:
                dataset_data = json.load(f)
            return jsonify(dataset_data)
        else:
            return jsonify({"error": "Dataset sample not found. Please train models first."}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    """Predict house price based on input parameters."""
    global model, scaler
    if model is None or scaler is None:
        # Reload assets if they weren't loaded yet
        load_ml_assets()
        if model is None or scaler is None:
            return jsonify({"error": "Machine learning model or scaler is not loaded."}), 500
            
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No input data provided."}), 400
            
        # Extract features and validate
        required_features = [
            'MedInc', 'HouseAge', 'AveRooms', 'AveBedrms', 
            'Population', 'AveOccup', 'Latitude', 'Longitude'
        ]
        
        input_features = []
        for feature in required_features:
            if feature not in data:
                return jsonify({"error": f"Missing feature: {feature}"}), 400
            try:
                val = float(data[feature])
                input_features.append(val)
            except (ValueError, TypeError):
                return jsonify({"error": f"Invalid format for feature: {feature}. Must be numeric."}), 400
                
        # Format for scaler (must be 2D array: [[f1, f2, ...]])
        features_array = np.array([input_features])
        
        # Scale features
        features_scaled = scaler.transform(features_array)
        
        # Make prediction
        prediction = model.predict(features_scaled)
        
        # California Housing dataset target represents Median House Value in hundreds of thousands of dollars ($100k).
        # We multiply by 100,000 to return the price in actual dollars.
        predicted_price_dollars = float(prediction[0]) * 100000
        
        # Clip negative predictions (if any outlier outputs occur) to a logical minimum (e.g. $10,000)
        predicted_price_dollars = max(10000.0, predicted_price_dollars)
        
        # Generate some contextual info
        # Standard statistics from the dataset to compare
        context = {
            "prediction": predicted_price_dollars,
            "average_price": 206855.81, # Median price across entire CA dataset is approx $206k
            "status": "success"
        }
        
        return jsonify(context)
        
    except Exception as e:
        print(f"Error predicting: {str(e)}")
        traceback.print_exc()
        return jsonify({"error": f"Prediction failed: {str(e)}"}), 500

if __name__ == '__main__':
    app.run(debug=True, host='127.0.0.1', port=5000)
