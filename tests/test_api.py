import pytest
from fastapi.testclient import TestClient

from src.api.app import app
from src.database.session import init_db

@pytest.fixture(scope="module")
def client():
    # Initialize SQLite database and seed cohort
    init_db(seed_cohort=True)
    with TestClient(app) as test_client:
        yield test_client

def test_healthcheck(client):
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["database"] == "connected"

def test_list_patients(client):
    response = client.get("/api/v1/patients")
    assert response.status_code == 200
    patients = response.json()
    assert len(patients) == 29
    assert any(p["code"] == "s61520_22" for p in patients)

def test_patient_analysis(client):
    response = client.get("/api/v1/patients/s61520_22/analysis")
    assert response.status_code == 200
    data = response.json()
    
    assert "summary" in data
    assert "cdss_risk" in data
    assert "icf" in data
    assert "ml" in data
    
    # Check clinical metrics
    cdss = data["cdss_risk"]
    assert "status" in cdss
    assert "pcr" in cdss
    assert "tje" in cdss
    assert cdss["status"] in ["green", "yellow", "red"]

def test_patient_kinematics(client):
    response = client.get("/api/v1/patients/s61520_22/kinematics")
    assert response.status_code == 200
    data = response.json()
    
    assert data["subject"] == "s61520_22"
    assert "joints" in data
    joints = data["joints"]
    assert "aSagH" in joints # Hip
    assert "aSagP" in joints # Pelvis
    assert "aSagK" in joints # Knee
    assert "aSagA" in joints # Ankle
    
    # 51 points per joint
    assert len(joints["aSagH"]["time_percent"]) == 51
    assert len(joints["aSagH"]["baseline"]["mean"]) == 51
    assert len(joints["aSagH"]["norm_td"]["mean"]) == 51

def test_regional_statistics(client):
    response = client.get("/api/v1/statistics/regional")
    assert response.status_code == 200
    data = response.json()
    
    assert "country" in data
    assert "region_abai" in data
    assert data["country"]["children_with_cp"] > 20000
    assert data["region_abai"]["children_disability"] > 2500

def test_ml_metrics(client):
    response = client.get("/api/v1/ml/metrics")
    assert response.status_code == 200
    data = response.json()
    
    assert "balanced_accuracy" in data
    assert "roc_auc" in data
    assert "feature_importances" in data
    assert data["n_subjects"] == 29

def test_create_clinical_report(client):
    response_ru = client.post("/api/v1/patients/s61520_22/report?lang=ru")
    assert response_ru.status_code == 200
    data_ru = response_ru.json()
    assert data_ru["patient"] == "s61520_22"
    assert "МКФ" in data_ru["narrative"] or "b770" in data_ru["narrative"]
    
    response_kz = client.post("/api/v1/patients/s61520_22/report?lang=kz")
    assert response_kz.status_code == 200
    data_kz = response_kz.json()
    assert "жамбас" in data_kz["narrative"].lower()

def test_upload_patient_csv(client):
    csv_content = b"subject,weight,height,leg_length,aMinSagH,GVS_aSagP\ns99999_test,45.0,1.40,0.72,12.5,14.2\n"
    response = client.post(
        "/api/v1/patients/upload",
        files={"file": ("test_patient.csv", csv_content, "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["code"] == "s99999_test"
    assert "s99999_test" in data["message_ru"]

