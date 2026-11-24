import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    db_file = tmp_path_factory.mktemp("libra_test_db") / "test_libra.db"
    db_url = f"sqlite:///{db_file}"

    prev_env = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = db_url

    import src.database.session as db_session
    import src.api.app as api_app

    orig_db_url = db_session.DB_URL
    orig_engine = db_session.engine
    orig_session_local = db_session.SessionLocal
    orig_app_engine = api_app.engine

    test_engine = create_engine(db_url, connect_args={"check_same_thread": False, "timeout": 30}, echo=False)

    @event.listens_for(test_engine, "connect")
    def _configure_sqlite(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("PRAGMA journal_mode = WAL;")
        cursor.execute("PRAGMA synchronous = NORMAL;")
        cursor.close()

    test_session_local = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    db_session.DB_URL = db_url
    db_session.engine = test_engine
    db_session.SessionLocal = test_session_local
    api_app.engine = test_engine

    try:
        db_session.init_db(seed_cohort=True)
        with TestClient(api_app.app) as test_client:
            yield test_client
    finally:
        test_engine.dispose()
        db_session.DB_URL = orig_db_url
        db_session.engine = orig_engine
        db_session.SessionLocal = orig_session_local
        api_app.engine = orig_app_engine
        if prev_env is None:
            os.environ.pop("DATABASE_URL", None)
        else:
            os.environ["DATABASE_URL"] = prev_env

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

    sample = next(p for p in patients if p["code"] == "s61520_22")
    for field in ("id", "code", "side", "weight", "height", "leg_length", "clinic_name",
                  "pcr", "tje", "status", "baseline_gps", "vr_gps", "delta_amin_sagh",
                  "has_vr", "has_verbal"):
        assert field in sample
    assert sample["status"] in ["green", "yellow", "red"]
    assert sample["has_vr"] is True
    assert sample["has_verbal"] is True

def test_patient_analysis(client):
    response = client.get("/api/v1/patients/s61520_22/analysis")
    assert response.status_code == 200
    data = response.json()
    
    assert "summary" in data
    assert "cdss_risk" in data
    assert "modalities" in data
    assert "icf" in data
    assert "ml" in data
    
    # Check modalities comparison
    mod = data["modalities"]
    assert mod["best_method"] in ["VR", "Verbal", "Baseline"]
    assert "verdict_ru" in mod
    assert "verdict_kz" in mod
    
    # Check clinical metrics
    cdss = data["cdss_risk"]
    assert "status" in cdss
    assert "pcr" in cdss
    assert "tje" in cdss
    assert cdss["status"] in ["green", "yellow", "red"]
    assert cdss["tje"] == pytest.approx(mod["tje_vr"], abs=1e-6)

    # Check pctmZeroStSagH exposure (None when NaN in dataset, finite float when present)
    summary = data["summary"]
    for key in ("baseline_pctm_zero", "vr_pctm_zero", "verbal_pctm_zero", "delta_pctm_zero"):
        assert key in summary
    assert summary["baseline_pctm_zero"] is None

    # Check model_reliable flag on responder_prediction
    resp_pred = data["ml"]["responder_prediction"]
    assert "loo_balanced_accuracy" in resp_pred
    assert "loo_roc_auc" in resp_pred
    assert "model_reliable" in resp_pred
    assert isinstance(resp_pred["model_reliable"], bool)

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
    assert "three_class" in data
    assert "balanced_accuracy" in data["three_class"]
    assert "f1_macro" in data["three_class"]
    assert data["three_class"]["classes"] == ["Baseline", "Verbal", "VR"]
    assert "pca_validation" in data
    assert data["pca_validation"]["n_splits"] == 5
    assert "vr_responder" in data
    assert data["vr_responder"]["roc_auc"] >= 0.60

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
    from src.database.session import SessionLocal
    from src.database.models import Patient
    with SessionLocal() as db:
        db.query(Patient).filter(Patient.code == "s99999_test").delete()
        db.commit()

    # Test European CSV format with ; separator and , decimal
    csv_content = "subject;side;weight;height;leg_length;GPS_a;aMinSagH;GVS_aSagP\ns99999_test;LEFT;46,5;1,42;0,73;11,2;-4,5;3,8\n".encode("utf-8")
    response = client.post(
        "/api/v1/patients/upload",
        files={"file": ("test_patient.csv", csv_content, "text/csv")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["code"] == "s99999_test"
    assert "s99999_test" in data["message_ru"]

    # Verify that the newly uploaded patient can be analyzed without 500 error
    res_analysis = client.get("/api/v1/patients/s99999_test/analysis")
    assert res_analysis.status_code == 200
    an_data = res_analysis.json()
    assert an_data["summary"]["subject"] == "s99999_test"
    assert "responder_prediction" in an_data["ml"]

def test_patient_biomechanical_diff(client):
    response = client.get("/api/v1/patients/s61520_1/diff?session_a=Baseline&session_b=VR")
    assert response.status_code == 200
    data = response.json()
    assert data["patient"] == "s61520_1"
    assert "delta_gps" in data
    assert "delta_gdi" in data
    assert "delta_tje" in data
    assert "delta_pcr" in data
    assert "status" in data
    assert data["status"] in ["improved", "stable", "regressed"]
    assert "verdict_ru" in data
    assert "verdict_kz" in data

def test_create_parent_report(client):
    response_ru = client.post("/api/v1/patients/s61520_1/report?lang=ru&audience=parent")
    assert response_ru.status_code == 200
    data_ru = response_ru.json()
    assert data_ru["audience"] == "parent"
    assert "ПАСПОРТ ПОХОДКИ" in data_ru["narrative"] or "РЕКОМЕНДАЦИИ" in data_ru["narrative"]

    response_kz = client.post("/api/v1/patients/s61520_1/report?lang=kz&audience=parent")
    assert response_kz.status_code == 200
    data_kz = response_kz.json()
    assert "ЖҮРІС ТӨЛҚҰЖАТЫ" in data_kz["narrative"] or "КЕҢЕС" in data_kz["narrative"]

def test_xai_feature_attributions(client):
    res = client.get("/api/v1/patients/s61520_1/analysis")
    assert res.status_code == 200
    ml_data = res.json()["ml"]["responder_prediction"]
    assert "feature_attributions" in ml_data
    attrs = ml_data["feature_attributions"]
    assert len(attrs) > 0
    assert "feature" in attrs[0]
    assert "attribution" in attrs[0]
    assert "direction" in attrs[0]

    assert "pca_stability" in res.json()["ml"]

    # Verify that kinematics curves render without error
    res_kin = client.get("/api/v1/patients/s99999_test/kinematics")
    assert res_kin.status_code == 200
    assert "joints" in res_kin.json()

def test_diff_reversed_sessions(client):
    # session_a=VR, session_b=Baseline
    res = client.get("/api/v1/patients/s61520_1/diff?session_a=VR&session_b=Baseline")
    assert res.status_code == 200
    data = res.json()
    assert data["session_a"] == "VR"
    assert data["session_b"] == "Baseline"
    assert "VR" in data["session_a_label"]
    assert "Baseline" in data["session_b_label"]
    assert "delta_gps" in data

def test_diff_missing_condition_returns_404(client):
    from src.database.session import SessionLocal
    from src.database.models import Patient
    with SessionLocal() as db:
        db.query(Patient).filter(Patient.code == "s_only_base").delete()
        db.commit()

    # Upload a patient with only baseline
    csv_content = "subject;side;weight;height;leg_length;GPS_a;aMinSagH;GVS_aSagP\ns_only_base;RIGHT;40,0;1,35;0,70;9,5;-3,0;2,0\n".encode("utf-8")
    up_res = client.post("/api/v1/patients/upload", files={"file": ("s_only_base.csv", csv_content, "text/csv")})
    assert up_res.status_code == 200
    # Requesting Verbal when patient has no verbal session should return 404 rather than 500
    res = client.get("/api/v1/patients/s_only_base/diff?session_a=Baseline&session_b=Verbal")
    assert res.status_code == 404
    assert "Verbal" in res.json()["detail"]

def test_report_audience_persistence(client):
    res = client.post("/api/v1/patients/s61520_1/report?lang=ru&audience=parent")
    assert res.status_code == 200
    report_id = res.json()["report_id"]
    
    from src.database.session import SessionLocal
    from src.database.models import ClinicalReport
    with SessionLocal() as db:
        rep = db.query(ClinicalReport).filter(ClinicalReport.id == report_id).first()
        assert rep is not None
        assert rep.audience == "parent"


def test_multicondition_imu_csv_upload_upsert(client):
    base_csv = (
        "subject;side;gps;pelvis_gvs;hip_gvs;knee_gvs;ankle_gvs;hip_min_ext\n"
        "s_imu_multi;LEFT;11,0;14,0;15,0;12,0;5,0;12,0\n"
    ).encode("utf-8")
    res_base = client.post(
        "/api/v1/patients/upload",
        files={"file": ("imu_base.csv", base_csv, "text/csv")},
        data={"condition": "baseline"},
    )
    assert res_base.status_code == 200
    b_data = res_base.json()
    assert b_data["code"] == "s_imu_multi"
    assert b_data["condition"] == "Baseline"
    assert b_data["anthropometry_estimated"] is True

    vr_csv = (
        "pelvis_gvs;hip_gvs;knee_gvs;ankle_gvs;hip_min_ext;gps;weight_kg;height_m;leg_length_m\n"
        "14,2;13,0;12,1;5,1;8,0;9,6;41,0;1,37;0,70\n"
    ).encode("utf-8")
    res_vr = client.post(
        "/api/v1/patients/upload",
        files={"file": ("imu_vr.csv", vr_csv, "text/csv")},
        data={"condition": "vr", "subject_code": "s_imu_multi"},
    )
    assert res_vr.status_code == 200
    v_data = res_vr.json()
    assert v_data["code"] == "s_imu_multi"
    assert v_data["condition"] == "VR"
    assert v_data["anthropometry_estimated"] is False

    res_an = client.get("/api/v1/patients/s_imu_multi/analysis")
    assert res_an.status_code == 200
    an = res_an.json()
    assert an["summary"]["has_vr"] is True
    assert an["summary"]["delta_amin_sagh"] == pytest.approx(-4.0, abs=1e-4)
    assert an["cdss_risk"]["tje"] == pytest.approx(an["modalities"]["tje_vr"], abs=1e-6)


def test_ingest_template_endpoints(client):
    res_vicon = client.get("/api/v1/ingest/template?format=vicon")
    assert res_vicon.status_code == 200
    assert "text/csv" in res_vicon.headers["content-type"]
    assert "attachment" in res_vicon.headers["content-disposition"]
    assert "GPS_a;GVS_aSagP" in res_vicon.text

    res_imu = client.get("/api/v1/ingest/template?format=imu")
    assert res_imu.status_code == 200
    assert "text/csv" in res_imu.headers["content-type"]
    assert "pelvis_gvs;hip_gvs" in res_imu.text


def test_export_patient_fhir_bundle(client):
    res = client.get("/api/v1/patients/s61520_22/fhir")
    assert res.status_code == 200
    bundle = res.json()
    assert bundle["resourceType"] == "Bundle"
    assert bundle["type"] == "collection"
    resources = [e["resource"] for e in bundle["entry"]]
    types = [r["resourceType"] for r in resources]
    assert "Patient" in types
    assert "DiagnosticReport" in types
    assert types.count("Observation") == 6

    patient_res = next(r for r in resources if r["resourceType"] == "Patient")
    assert "name" not in patient_res
    assert patient_res["identifier"][0]["value"] == "s61520_22"

    obs_codes = [
        r["code"]["coding"][0]["code"]
        for r in resources
        if r["resourceType"] == "Observation"
    ]
    for expected in ("GPS_a", "TJE", "PCR", "aMinSagH", "b770", "d450"):
        assert expected in obs_codes

    report_res = next(r for r in resources if r["resourceType"] == "DiagnosticReport")
    assert "Rule 8.4" in report_res["conclusion"]
    assert "presentedForm" in report_res and len(report_res["presentedForm"]) == 2


def test_imu_pelvis_tilt_and_vr_before_baseline(client):
    # 1. Uploading VR before Baseline should still resolve without 404
    vr_first_csv = (
        "side;pelvis_gvs;hip_gvs;knee_gvs;ankle_gvs;hip_min_ext;gps;pelvis_tilt_mean\n"
        "left;12,0;11,0;10,0;5,0;-1,5;8,5;15,0\n"
    ).encode("utf-8")
    res_vr_first = client.post(
        "/api/v1/patients/upload",
        files={"file": ("vr_first.csv", vr_first_csv, "text/csv")},
        data={"condition": "VR", "subject_code": "s_vr_first"},
    )
    assert res_vr_first.status_code == 200
    assert client.get("/api/v1/patients/s_vr_first/analysis").status_code == 200
    assert client.get("/api/v1/patients/s_vr_first/fhir").status_code == 200

    # 2. Uploading Baseline afterwards with pelvis_tilt_mean should compute delta_pelvis_tilt & TJE
    base_csv = (
        "side;pelvis_gvs;hip_gvs;knee_gvs;ankle_gvs;hip_min_ext;gps;pelvis_tilt_mean\n"
        "left;9,0;10,0;10,0;5,0;1,5;8,0;11,0\n"
    ).encode("utf-8")
    res_base = client.post(
        "/api/v1/patients/upload",
        files={"file": ("base_second.csv", base_csv, "text/csv")},
        data={"condition": "Baseline", "subject_code": "s_vr_first"},
    )
    assert res_base.status_code == 200
    an = client.get("/api/v1/patients/s_vr_first/analysis").json()
    assert an["summary"]["side"] == "LEFT"
    assert an["summary"]["delta_pelvis_tilt"] == pytest.approx(4.0, abs=1e-2)
    # delta_hip = -1.5 - 1.5 = -3.0; TJE = -3.0 + 4.0 = +1.0
    assert an["cdss_risk"]["tje"] == pytest.approx(1.0, abs=1e-2)
    assert an["cdss_risk"]["tje"] == pytest.approx(an["modalities"]["tje_vr"], abs=1e-4)

    # 3. CSV with zero valid gait metrics must return 400
    empty_metrics_csv = "subject;side;weight\ns_bad_csv;RIGHT;40,0\n".encode("utf-8")
    res_bad = client.post(
        "/api/v1/patients/upload",
        files={"file": ("bad.csv", empty_metrics_csv, "text/csv")},
    )
    assert res_bad.status_code == 400


def test_51pt_kinematics_template_and_upload_persistence(client):
    res_tpl = client.get("/api/v1/ingest/template?format=kinematics")
    assert res_tpl.status_code == 200
    assert "aSagP_pct_GC_0" in res_tpl.text
    assert "aSagH_pct_GC_1000" in res_tpl.text

    res_up = client.post(
        "/api/v1/patients/upload",
        files={"file": ("kin_patient.csv", res_tpl.text.encode("utf-8"), "text/csv")},
        data={"condition": "Baseline", "subject_code": "s_kin_uploaded"},
    )
    assert res_up.status_code == 200
    up_data = res_up.json()
    assert up_data["has_kinematics"] is True

    res_kin = client.get("/api/v1/patients/s_kin_uploaded/kinematics")
    assert res_kin.status_code == 200
    kin_data = res_kin.json()
    assert kin_data["is_surrogate"] is False
    assert len(kin_data["joints"]["aSagH"]["baseline"]["mean"]) == 51

    res_an = client.get("/api/v1/patients/s_kin_uploaded/analysis")
    assert res_an.status_code == 200
    an_data = res_an.json()
    assert an_data["summary"]["baseline_gps"] > 0.0
    assert len(an_data["ml"]["pca_stability"]["cycles"]) == 1


def test_upload_rejects_pii_columns(client):
    pii_csv = "subject;iin;fio;GPS_a;aMinSagH\ns_pii_01;010101500001;Ivanov;8,0;2,0\n".encode("utf-8")
    res = client.post(
        "/api/v1/patients/upload",
        files={"file": ("pii.csv", pii_csv, "text/csv")},
    )
    assert res.status_code == 400
    assert "94-V" in res.json()["detail"]



