import os
import json
import numpy as np
import pandas as pd
import joblib
from sklearn.datasets import fetch_california_housing
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

def train_and_evaluate():
    print("Starting Machine Learning pipeline...")
    
    # 1. Load the California Housing dataset
    print("Loading California Housing dataset...")
    california = fetch_california_housing(as_frame=True)
    df = california.frame
    
    # Features and Target
    X = california.data
    y = california.target  # Median house value in $100,000s
    
    feature_names = list(X.columns)
    print(f"Features: {feature_names}")
    print(f"Target: Median House Value (in $100k)")
    print(f"Dataset shape: {df.shape}")
    
    # Calculate dataset statistics for UI explorer
    stats = {}
    for col in df.columns:
        # Translate column name to user-friendly label if needed, but keeping original for mapping
        stats[col] = {
            "mean": float(df[col].mean()),
            "std": float(df[col].std()),
            "min": float(df[col].min()),
            "max": float(df[col].max()),
            "median": float(df[col].median())
        }
    
    # 2. Train-Test Split
    print("Splitting dataset into train and test sets...")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 3. Scaling
    print("Standardizing features...")
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Save the scaler
    scaler_path = "scaler.joblib"
    joblib.dump(scaler, scaler_path)
    print(f"Scaler saved to {scaler_path}")
    
    # 4. Define models to train
    models = {
        "Linear Regression": LinearRegression(),
        "Random Forest": RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42, n_jobs=-1),
        "Gradient Boosting": GradientBoostingRegressor(n_estimators=100, learning_rate=0.1, max_depth=6, random_state=42)
    }
    
    metrics = {}
    trained_models = {}
    best_model_name = None
    best_r2 = -float('inf')
    
    # 5. Train and evaluate models
    for name, model in models.items():
        print(f"Training {name}...")
        model.fit(X_train_scaled, y_train)
        trained_models[name] = model
        
        # Predictions
        y_pred = model.predict(X_test_scaled)
        
        # Calculate Metrics
        r2 = r2_score(y_test, y_pred)
        mae = mean_absolute_error(y_test, y_pred)
        mse = mean_squared_error(y_test, y_pred)
        rmse = np.sqrt(mse)
        
        # Translate to actual dollar errors (since target is in $100k)
        mae_dollars = mae * 100000
        rmse_dollars = rmse * 100000
        
        metrics[name] = {
            "r2": float(r2),
            "mae": float(mae),
            "mae_dollars": float(mae_dollars),
            "mse": float(mse),
            "rmse": float(rmse),
            "rmse_dollars": float(rmse_dollars)
        }
        print(f"{name} Metrics -> R2: {r2:.4f}, MAE: ${mae_dollars:,.2f}")
        
        if r2 > best_r2:
            best_r2 = r2
            best_model_name = name

    print(f"\nBest model is: {best_model_name} with R2: {best_r2:.4f}")
    
    # 6. Save the best model
    best_model = trained_models[best_model_name]
    model_path = "best_model.joblib"
    joblib.dump(best_model, model_path)
    print(f"Best model saved to {model_path}")
    
    # 7. Extract Feature Importance if supported (Random Forest and Gradient Boosting support this)
    feature_importances = {}
    if hasattr(best_model, 'feature_importances_'):
        importances = best_model.feature_importances_
        for feature, importance in zip(feature_names, importances):
            feature_importances[feature] = float(importance)
        # Sort importances
        feature_importances = dict(sorted(feature_importances.items(), key=lambda item: item[1], reverse=True))
    else:
        # Fallback for Linear Regression coefficients if it were the best (unlikely)
        coefs = np.abs(best_model.coef_)
        total_coef = sum(coefs)
        for feature, coef in zip(feature_names, coefs):
            feature_importances[feature] = float(coef / total_coef)
        feature_importances = dict(sorted(feature_importances.items(), key=lambda item: item[1], reverse=True))

    # Save metrics JSON
    metrics_summary = {
        "best_model": best_model_name,
        "models": metrics,
        "feature_importances": feature_importances
    }
    
    metrics_path = "model_metrics.json"
    with open(metrics_path, "w") as f:
        json.dump(metrics_summary, f, indent=4)
    print(f"Metrics summary saved to {metrics_path}")
    
    # 8. Create a sample dataset for frontend visualization (interactive map & table explorer)
    print("Generating dataset sample for UI...")
    # Select 500 random rows from the test set for fair visual representation
    sample_indices = np.random.RandomState(42).choice(X_test.index, size=500, replace=False)
    X_sample = X_test.loc[sample_indices]
    y_sample_actual = y_test.loc[sample_indices]
    
    # Get predictions for the sample using the best model
    X_sample_scaled = scaler.transform(X_sample)
    y_sample_pred = best_model.predict(X_sample_scaled)
    
    # Compile rows
    sample_rows = []
    for idx, (real_idx, row) in enumerate(X_sample.iterrows()):
        row_dict = row.to_dict()
        row_dict["ActualPrice"] = float(y_sample_actual.loc[real_idx])
        row_dict["PredictedPrice"] = float(y_sample_pred[idx])
        row_dict["Latitude"] = float(row["Latitude"])
        row_dict["Longitude"] = float(row["Longitude"])
        sample_rows.append(row_dict)
        
    sample_data_summary = {
        "statistics": stats,
        "sample": sample_rows
    }
    
    sample_path = "dataset_sample.json"
    with open(sample_path, "w") as f:
        json.dump(sample_data_summary, f, indent=4)
    print(f"Dataset sample saved to {sample_path}")
    print("Machine learning pipeline completed successfully!")

if __name__ == "__main__":
    train_and_evaluate()
