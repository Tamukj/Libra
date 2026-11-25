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
                  "has_vr", "has_verbal", "visit_count", "latest_visit_key",
                  "latest_visit_label", "latest_visit_date",
                  "anthropometry_estimated", "side_estimated"):
        assert field in sample
    assert sample["status"] in ["green", "yellow", "red"]
    assert sample["has_vr"] is True
    assert sample["has_verbal"] is True
    assert sample["visit_count"] >= 1
    assert sample["latest_visit_key"] == "visit-1"
    assert sample["anthropometry_estimated"] is False
    assert sample["side_estimated"] is False

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

def test_cohort_analytics(client):
    response = client.get("/api/v1/analytics/cohort")
    assert response.status_code == 200
    data = response.json()

    assert data["total_patients"] >= 29
    assert data["cycles"]["total"] >= 2606
    cdss = data["cdss_distribution"]
    assert cdss["green"] + cdss["yellow"] + cdss["red"] == data["total_patients"]
    assert data["source"]["doi"] == "10.48804/JUNNWW"

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
    assert data["vr_responder"]["roc_auc"] >= 0.55

def test_create_clinical_report(client):
    response_ru = client.post("/api/v1/patients/s61520_22/report?lang=ru")
    assert response_ru.status_code == 200
    data_ru = response_ru.json()
    assert data_ru["patient"] == "s61520_22"
    assert "МКФ" in data_ru["narrative"] or "b770" in data_ru["narrative"]
    assert data_ru["icf_d450"] == "d450.3"
    assert "d450.3" in data_ru["narrative"]

    response_kz = client.post("/api/v1/patients/s61520_22/report?lang=kz")
    assert response_kz.status_code == 200
    data_kz = response_kz.json()
    assert "жамбас" in data_kz["narrative"].lower()
    assert "d450.3" in data_kz["narrative"]

def _cleanup_patients(*codes: str) -> None:
    from src.database.session import SessionLocal
    from src.database.models import Patient

    with SessionLocal() as db:
        for patient in db.query(Patient).filter(Patient.code.in_(list(codes))).all():
            db.delete(patient)
        db.commit()


def test_upload_patient_csv(client):
    _cleanup_patients("s99999_test")

    # Test European CSV format with ; separator and , decimal
    csv_content = "subject;side;weight;height;leg_length;GPS_a;aMinSagH;GVS_aSagP\ns99999_test;LEFT;46,5;1,42;0,73;11,2;-4,5;3,8\n".encode("utf-8")
    try:
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
        assert an_data["summary"]["vr_gps"] is None
        assert "responder_prediction" in an_data["ml"]
    finally:
        _cleanup_patients("s99999_test")

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

    # Discrete-only patient returns explicit has_curves=False instead of surrogate cohort curves
    _cleanup_patients("s_xai_disc")
    try:
        csv_content = "subject;side;weight;height;leg_length;GPS_a;aMinSagH;GVS_aSagP\ns_xai_disc;LEFT;46,5;1,42;0,73;11,2;-4,5;3,8\n".encode("utf-8")
        assert client.post("/api/v1/patients/upload", files={"file": ("xai.csv", csv_content, "text/csv")}).status_code == 200
        res_kin = client.get("/api/v1/patients/s_xai_disc/kinematics")
        assert res_kin.status_code == 200
        assert res_kin.json()["has_curves"] is False
    finally:
        _cleanup_patients("s_xai_disc")

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
    _cleanup_patients("s_only_base")

    # Upload a patient with only baseline
    try:
        csv_content = "subject;side;weight;height;leg_length;GPS_a;aMinSagH;GVS_aSagP\ns_only_base;RIGHT;40,0;1,35;0,70;9,5;-3,0;2,0\n".encode("utf-8")
        up_res = client.post("/api/v1/patients/upload", files={"file": ("s_only_base.csv", csv_content, "text/csv")})
        assert up_res.status_code == 200
        # Requesting Verbal when patient has no verbal session should return 404 rather than 500
        res = client.get("/api/v1/patients/s_only_base/diff?session_a=Baseline&session_b=Verbal")
        assert res.status_code == 404
        assert "Verbal" in res.json()["detail"]
    finally:
        _cleanup_patients("s_only_base")

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
    _cleanup_patients("s_imu_multi")
    try:
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
    finally:
        _cleanup_patients("s_imu_multi")


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


def test_export_patient_pdf_report(client):
    for lang in ("ru", "kz"):
        res = client.get(f"/api/v1/patients/s61520_22/report.pdf?lang={lang}&audience=doctor")
        assert res.status_code == 200
        assert "application/pdf" in res.headers["content-type"]
        assert res.content.startswith(b"%PDF-")
        assert len(res.content) > 5000

    res_parent = client.get("/api/v1/patients/s61520_1/report.pdf?lang=ru&audience=parent")
    assert res_parent.status_code == 200
    assert res_parent.content.startswith(b"%PDF-")


def test_imu_pelvis_tilt_and_vr_before_baseline(client):
    _cleanup_patients("s_vr_first")
    try:
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
        assert client.get("/api/v1/patients/s_vr_first/report.pdf?lang=ru").status_code == 200

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
    finally:
        _cleanup_patients("s_vr_first")


def test_51pt_kinematics_template_and_upload_persistence(client):
    _cleanup_patients("s_kin_uploaded")
    try:
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
        assert kin_data["available_conditions"] == ["Baseline"]
        assert len(kin_data["joints"]["aSagH"]["baseline"]["mean"]) == 51
        assert kin_data["joints"]["aSagH"]["vr"] is None
        assert kin_data["joints"]["aSagH"]["verbal"] is None

        res_an = client.get("/api/v1/patients/s_kin_uploaded/analysis")
        assert res_an.status_code == 200
        an_data = res_an.json()
        assert an_data["summary"]["baseline_gps"] > 0.0
        assert len(an_data["ml"]["pca_stability"]["cycles"]) == 1
    finally:
        _cleanup_patients("s_kin_uploaded")


def test_upload_rejects_pii_columns(client):
    pii_csv = "subject;iin;fio;GPS_a;aMinSagH\ns_pii_01;010101500001;Ivanov;8,0;2,0\n".encode("utf-8")
    res = client.post(
        "/api/v1/patients/upload",
        files={"file": ("pii.csv", pii_csv, "text/csv")},
    )
    assert res.status_code == 400
    assert "94-V" in res.json()["detail"]


def test_multisubject_csv_upload_and_cohort_consistency(client):
    from src.database.session import SessionLocal
    from src.database.models import Patient
    with SessionLocal() as db:
        db.query(Patient).filter(Patient.code.in_(["s_multi_1", "s_multi_2"])).delete(synchronize_session=False)
        db.commit()

    multi_csv = (
        "subject;side;weight;height;LegLength;GPS_a;GVS_aSagP;GVS_aSagH;GVS_aSagK;GVS_aSagA;aMinSagH\n"
        "s_multi_1;LEFT;35,0;1,30;0,68;9,0;8,0;10,0;9,0;5,0;4,0\n"
        "s_multi_2;RIGHT;48,0;1,45;0,75;12,0;14,0;15,0;12,0;6,0;9,0\n"
    ).encode("utf-8")
    res = client.post(
        "/api/v1/patients/upload",
        files={"file": ("multi.csv", multi_csv, "text/csv")},
        data={"condition": "Baseline"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["patients_updated"] == 2
    assert set(data["codes"]) == {"s_multi_1", "s_multi_2"}

    an1 = client.get("/api/v1/patients/s_multi_1/analysis").json()
    an2 = client.get("/api/v1/patients/s_multi_2/analysis").json()
    assert an1["summary"]["baseline_gps"] == pytest.approx(9.0, abs=1e-3)
    assert an2["summary"]["baseline_gps"] == pytest.approx(12.0, abs=1e-3)

    # Verify red CDSS patients never contradict compare_modalities with best_method == VR
    pts = client.get("/api/v1/patients").json()
    for p in pts:
        if p["status"] == "red":
            an = client.get(f"/api/v1/patients/{p['code']}/analysis").json()
            assert an["modalities"]["best_method"] != "VR"

    # Cleanup synthetic test patients
    _cleanup_patients("s_multi_1", "s_multi_2")


def test_auth_strict_fail_closed_and_no_hardcoded_secret(client, monkeypatch):
    # When LIBRA_ALLOW_DEMO=0, GET & POST clinical endpoints require configured LIBRA_API_KEY
    monkeypatch.setenv("LIBRA_ALLOW_DEMO", "0")
    monkeypatch.delenv("LIBRA_API_KEY", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_LIBRA_API_KEY", raising=False)
    assert client.get("/api/v1/patients").status_code == 401
    assert client.get("/api/v1/patients/s61520_1/report.pdf").status_code == 401
    assert client.get("/api/v1/patients", headers={"X-API-Key": "libra-doctor-secret-key-2026"}).status_code == 401

    monkeypatch.setenv("LIBRA_API_KEY", "test-secret-xyz")
    assert client.get("/api/v1/patients", headers={"X-API-Key": "libra-doctor-secret-key-2026"}).status_code == 401
    assert client.get("/api/v1/patients", headers={"X-API-Key": "test-secret-xyz"}).status_code == 200


def test_security_pii_aliases_and_payload_limit(client):
    # PII column aliases and 12-digit IIN in subject
    for bad_csv in (
        "patient_name;GPS_a\nIvan;8.0\n",
        "dob;GPS_a\n2015-01-01;8.0\n",
        "subject;GPS_a\n090512501234;8.0\n",
    ):
        res = client.post("/api/v1/patients/upload", files={"file": ("pii.csv", bad_csv.encode("utf-8"), "text/csv")})
        assert res.status_code == 400

    # Oversized >10MB upload rejected with 413
    oversized = b"subject;GPS_a\n" + b"s_big;8.0\n" * (1_100_000)
    res_big = client.post("/api/v1/patients/upload", files={"file": ("big.csv", oversized, "text/csv")})
    assert res_big.status_code == 413


def test_multilingual_en_and_rule82_limitations(client):
    an_red = client.get("/api/v1/patients/s61520_1/analysis").json()
    assert an_red["cdss_risk"]["status"] == "red"
    assert "limitations" in an_red and "8.2" in an_red["limitations"]
    assert "103" in an_red["cdss_risk"]["recommendation_ru"]

    diff_en = client.get("/api/v1/patients/s61520_1/diff?session_a=Baseline&session_b=VR&lang=en")
    assert diff_en.status_code == 200 and "limitations" in diff_en.json()

    rep_en = client.post("/api/v1/patients/s61520_1/report?lang=en")
    assert rep_en.status_code == 200 and "CLINICAL" in rep_en.json()["narrative"]

    pdf_en = client.get("/api/v1/patients/s61520_1/report.pdf?lang=en")
    assert pdf_en.status_code == 200
    assert pdf_en.content.startswith(b"%PDF-")
    assert "libra-report-s61520_1-en.pdf" in pdf_en.headers.get("content-disposition", "")


def test_db_kinematics_precedence_and_atomic_concurrency(client):
    import threading
    from sqlalchemy import event

    # 1. s61520_22 has no mSagH and is_surrogate is False
    k22 = client.get("/api/v1/patients/s61520_22/kinematics").json()
    assert k22["is_surrogate"] is False and "mSagH" not in k22["joints"]

    # 2. Numeric & whitespace subject coalescing + atomic concurrent upsert (W4-02 / W4-03 / W1-07)
    _cleanup_patients("101", "s_race_conc")
    try:
        csv_101 = "subject;side;GPS_a;aMinSagH\n101.0;LEFT;9.0;2.0\n s_race_conc ;RIGHT;10.0;3.0\n".encode("utf-8")
        assert client.post("/api/v1/patients/upload", files={"file": ("n.csv", csv_101, "text/csv")}).status_code == 200
        assert client.get("/api/v1/patients/101/analysis").status_code == 200

        # Concurrent VR uploads for same code must succeed without IntegrityError
        barrier = threading.Barrier(2)
        statuses = []
        def _worker():
            c = "subject;side;GPS_a;aMinSagH\ns_race_conc;RIGHT;8.5;1.0\n".encode("utf-8")
            barrier.wait(timeout=5)
            r = client.post("/api/v1/patients/upload", files={"file": ("r.csv", c, "text/csv")}, data={"condition": "VR"})
            statuses.append(r.status_code)

        t1, t2 = threading.Thread(target=_worker), threading.Thread(target=_worker)
        t1.start(); t2.start(); t1.join(); t2.join()
        assert statuses == [200, 200]
    finally:
        _cleanup_patients("101", "s_race_conc")

    # 3. Query-count ceiling (O(1) eager loading instead of N+1)
    import src.database.session as db_session
    count = [0]
    def _cnt(conn, cur, stmt, params, ctx, many):
        if stmt.lstrip().upper().startswith("SELECT"):
            count[0] += 1
    event.listen(db_session.engine, "before_cursor_execute", _cnt)
    try:
        assert client.get("/api/v1/patients").status_code == 200
        assert count[0] <= 5
        count[0] = 0
        assert client.get("/api/v1/analytics/cohort").status_code == 200
        assert count[0] <= 5
    finally:
        event.remove(db_session.engine, "before_cursor_execute", _cnt)


def test_honest_anthropometry_and_side_defaults(client):
    _cleanup_patients("s_honest_1", "s_bad_anthro")
    try:
        # 1. Explicit <= 0 anthropometry must fail with 400
        bad_csv = "subject;side;weight;height;leg_length;GPS_a\ns_bad_anthro;LEFT;0;1,35;0,70;9,0\n".encode("utf-8")
        res_bad = client.post("/api/v1/patients/upload", files={"file": ("bad.csv", bad_csv, "text/csv")})
        assert res_bad.status_code == 400

        # 2. Missing weight/height/leg_length and missing side -> stored as None / UNSPECIFIED + flags True
        bare_csv = "subject;GPS_a;aMinSagH;GVS_aSagP\ns_honest_1;11,2;-4,5;3,8\n".encode("utf-8")
        res_up = client.post("/api/v1/patients/upload", files={"file": ("bare.csv", bare_csv, "text/csv")})
        assert res_up.status_code == 200
        up = res_up.json()
        assert up["anthropometry_estimated"] is True
        assert up["side_estimated"] is True

        pts = client.get("/api/v1/patients").json()
        p_row = next(p for p in pts if p["code"] == "s_honest_1")
        assert p_row["weight"] is None
        assert p_row["height"] is None
        assert p_row["leg_length"] is None
        assert p_row["side"] == "UNSPECIFIED"
        assert p_row["anthropometry_estimated"] is True
        assert p_row["side_estimated"] is True

        rep_ru = client.post("/api/v1/patients/s_honest_1/report?lang=ru").json()
        assert "Не указана" in rep_ru["narrative"]

        # 3. Upload real anthropometry + side -> updates DB and flips flags False
        full_csv = (
            "subject;side;weight;height;leg_length;GPS_a;aMinSagH;GVS_aSagP\n"
            "s_honest_1;LEFT;38,5;1,34;0,69;9,5;-5,5;4,0\n"
        ).encode("utf-8")
        res_full = client.post(
            "/api/v1/patients/upload",
            files={"file": ("full.csv", full_csv, "text/csv")},
            data={"condition": "VR"},
        )
        assert res_full.status_code == 200
        assert res_full.json()["anthropometry_estimated"] is False
        assert res_full.json()["side_estimated"] is False

        # 4. Follow-up upload omitting anthropometry & side MUST preserve existing DB values
        followup_csv = "subject;GPS_a;aMinSagH;GVS_aSagP\ns_honest_1;9,8;-5,0;4,1\n".encode("utf-8")
        res_follow = client.post(
            "/api/v1/patients/upload",
            files={"file": ("follow.csv", followup_csv, "text/csv")},
            data={"condition": "Baseline", "visit_key": "new", "visit_date": "2026-11-26"},
        )
        assert res_follow.status_code == 200
        assert res_follow.json()["anthropometry_estimated"] is False
        assert res_follow.json()["side_estimated"] is False

        pts_after = client.get("/api/v1/patients").json()
        p_after = next(p for p in pts_after if p["code"] == "s_honest_1")
        assert p_after["side"] == "LEFT"
        assert p_after["weight"] == pytest.approx(38.5, abs=1e-4)
        assert p_after["height"] == pytest.approx(1.34, abs=1e-4)
        assert p_after["leg_length"] == pytest.approx(0.69, abs=1e-4)
        assert p_after["anthropometry_estimated"] is False
        assert p_after["side_estimated"] is False
    finally:
        _cleanup_patients("s_honest_1", "s_bad_anthro")


def test_longitudinal_visits_lifecycle_and_endpoints(client):
    import subprocess
    import tempfile
    from src.database.session import SessionLocal
    from src.database.models import ClinicalReport

    _cleanup_patients("s_long_1")
    try:
        tpl_res = client.get("/api/v1/ingest/template?format=kinematics")
        assert tpl_res.status_code == 200
        tpl_lines = tpl_res.text.strip().splitlines()
        hdr = tpl_lines[0]
        vals = tpl_lines[1].split(";")

        # 1. Invalid visit_key / visit_date return 400
        bad_vk = client.post(
            "/api/v1/patients/upload",
            files={"file": ("v1.csv", (hdr + "\n" + ";".join(vals) + "\n").encode("utf-8"), "text/csv")},
            data={"subject_code": "s_long_1", "visit_key": "bad visit!"},
        )
        assert bad_vk.status_code == 400

        bad_vd = client.post(
            "/api/v1/patients/upload",
            files={"file": ("v1.csv", (hdr + "\n" + ";".join(vals) + "\n").encode("utf-8"), "text/csv")},
            data={"subject_code": "s_long_1", "visit_date": "2026-02-30"},
        )
        assert bad_vd.status_code == 400

        # 2. Visit 1: Baseline + VR (attaches to visit-1 automatically when visit_key omitted)
        v1_base_csv = (
            "subject;side;weight;height;LegLength;GPS_a;GVS_aSagP;GVS_aSagH;GVS_aSagK;GVS_aSagA;aMinSagH\n"
            "s_long_1;RIGHT;36,0;1,30;0,68;12,0;10,0;13,0;10,0;5,0;14,0\n"
        ).encode("utf-8")
        r1_b = client.post(
            "/api/v1/patients/upload",
            files={"file": ("v1_b.csv", v1_base_csv, "text/csv")},
            data={"condition": "Baseline", "visit_label": "Первичный курс", "visit_date": "2026-01-15"},
        )
        assert r1_b.status_code == 200
        d1_b = r1_b.json()
        assert d1_b["visit_key"] == "visit-1"
        assert d1_b["visit_label"] == "Первичный курс"
        assert d1_b["visit_date"] == "2026-01-15"
        assert d1_b["visit_created"] is True

        v1_vr_csv = (
            "subject;GPS_a;GVS_aSagP;GVS_aSagH;GVS_aSagK;GVS_aSagA;aMinSagH\n"
            "s_long_1;10,6;10,2;11,0;9,5;5,0;10,5\n"
        ).encode("utf-8")
        r1_vr = client.post(
            "/api/v1/patients/upload",
            files={"file": ("v1_vr.csv", v1_vr_csv, "text/csv")},
            data={"condition": "VR"},
        )
        assert r1_vr.status_code == 200
        d1_vr = r1_vr.json()
        assert d1_vr["visit_key"] == "visit-1"
        assert d1_vr["visit_created"] is False

        # 3. Visit 2: visit_key="new" with kinematics on Baseline + Verbal trial
        r2_b = client.post(
            "/api/v1/patients/upload",
            files={"file": ("v2_b.csv", (hdr + "\n" + ";".join(vals) + "\n").encode("utf-8"), "text/csv")},
            data={
                "condition": "Baseline",
                "subject_code": "s_long_1",
                "visit_key": "new",
                "visit_label": "Контроль через 3 мес",
                "visit_date": "2026-04-20",
            },
        )
        assert r2_b.status_code == 200
        d2_b = r2_b.json()
        assert d2_b["visit_key"] == "visit-2"
        assert d2_b["visit_label"] == "Контроль через 3 мес"
        assert d2_b["visit_date"] == "2026-04-20"
        assert d2_b["visit_created"] is True

        v2_vb_csv = (
            "subject;GPS_a;GVS_aSagP;GVS_aSagH;GVS_aSagK;GVS_aSagA;aMinSagH\n"
            "s_long_1;7,2;7,0;8,0;7,0;4,0;5,0\n"
        ).encode("utf-8")
        r2_vb = client.post(
            "/api/v1/patients/upload",
            files={"file": ("v2_vb.csv", v2_vb_csv, "text/csv")},
            data={"condition": "Verbal", "subject_code": "s_long_1"},
        )
        assert r2_vb.status_code == 200
        assert r2_vb.json()["visit_key"] == "visit-2"
        assert r2_vb.json()["visit_created"] is False

        # 4. GET /visits lists both visits chronologically without overwriting visit-1
        visits_res = client.get("/api/v1/patients/s_long_1/visits")
        assert visits_res.status_code == 200
        visits_payload = visits_res.json()
        assert visits_payload["code"] == "s_long_1"
        visits = visits_payload["visits"]
        assert len(visits) == 2
        assert visits[0]["visit_key"] == "visit-1"
        assert visits[0]["is_latest"] is False
        assert visits[0]["baseline_gps"] == pytest.approx(12.0, abs=1e-3)
        assert visits[0]["vr_gps"] == pytest.approx(10.6, abs=1e-3)
        assert visits[0]["conditions"] == ["Baseline", "VR"]
        assert visits[1]["visit_key"] == "visit-2"
        assert visits[1]["is_latest"] is True
        assert visits[1]["verbal_gps"] == pytest.approx(7.2, abs=1e-3)
        assert visits[1]["conditions"] == ["Baseline", "Verbal"]

        # 5. GET /analysis scoped to visit-1 vs visit-2 (default latest)
        an_v1 = client.get("/api/v1/patients/s_long_1/analysis?visit=visit-1").json()
        assert an_v1["active_visit"]["visit_key"] == "visit-1"
        assert len(an_v1["visits"]) == 2
        assert an_v1["summary"]["baseline_gps"] == pytest.approx(12.0, abs=1e-3)
        assert an_v1["summary"]["vr_gps"] == pytest.approx(10.6, abs=1e-3)
        assert an_v1["icf"]["b770_post"] == "b770.2"
        assert an_v1["icf"]["b770_post_condition"] == "VR"
        assert an_v1["ml"]["active_condition_evaluated"] == "VR"
        assert an_v1["ml"]["predicted_condition"] in ("VR", "Baseline")

        an_v2 = client.get("/api/v1/patients/s_long_1/analysis").json()
        assert an_v2["active_visit"]["visit_key"] == "visit-2"
        assert an_v2["summary"]["active_modality"] == "Verbal"
        assert an_v2["icf"]["b770_post"] == "b770.1"
        assert an_v2["icf"]["b770_post_condition"] == "Verbal"
        assert an_v2["ml"]["active_condition_evaluated"] == "Baseline"

        # 6. GET /kinematics scoped to visit-1 (no curves) vs visit-2 (has Baseline curves)
        kin_v1 = client.get("/api/v1/patients/s_long_1/kinematics?visit=visit-1").json()
        assert kin_v1["visit_key"] == "visit-1"
        assert kin_v1["has_curves"] is False

        kin_v2 = client.get("/api/v1/patients/s_long_1/kinematics?visit=visit-2").json()
        assert kin_v2["visit_key"] == "visit-2"
        assert kin_v2["has_curves"] is True
        assert kin_v2["available_conditions"] == ["Baseline"]

        # 7. GET /diff across visits preserves visit labels
        diff_res = client.get(
            "/api/v1/patients/s_long_1/diff?visit_a=visit-1&visit_b=visit-2&session_a=VR&session_b=Verbal"
        )
        assert diff_res.status_code == 200
        diff = diff_res.json()
        assert diff["visit_a"] == "visit-1"
        assert diff["visit_b"] == "visit-2"
        assert "Первичный курс" in diff["session_a_label"]
        assert "Контроль через 3 мес" in diff["session_b_label"]
        assert diff["delta_gps"] == pytest.approx(7.2 - 10.6, abs=1e-2)

        # 8. POST /report and GET /report.pdf scoped to visit-1
        rep_res = client.post("/api/v1/patients/s_long_1/report?visit=visit-1&lang=ru")
        assert rep_res.status_code == 200
        rep = rep_res.json()
        assert rep["visit_key"] == "visit-1"
        assert "Первичный курс" in rep["narrative"]
        assert "2026-01-15" in rep["narrative"]
        with SessionLocal() as db:
            db_rep = db.query(ClinicalReport).filter(ClinicalReport.id == rep["report_id"]).one()
            assert db_rep.visit_key == "visit-1"

        pdf_res = client.get("/api/v1/patients/s_long_1/report.pdf?visit=visit-1&lang=ru")
        assert pdf_res.status_code == 200
        with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
            f.write(pdf_res.content)
            f.flush()
            pdf_txt = subprocess.check_output(["pdftotext", f.name, "-"]).decode("utf-8", "replace")
            assert "Первичный курс" in pdf_txt
            assert "2026-01-15" in pdf_txt

        # 9. Unknown visit returns 404
        assert client.get("/api/v1/patients/s_long_1/analysis?visit=visit-999").status_code == 404
        assert client.get("/api/v1/patients/s_long_1/kinematics?visit=visit-999").status_code == 404
        assert client.get("/api/v1/patients/s_long_1/diff?visit=visit-999").status_code == 404
        assert client.post("/api/v1/patients/s_long_1/report?visit=visit-999").status_code == 404
        assert client.get("/api/v1/patients/s_long_1/report.pdf?visit=visit-999").status_code == 404
    finally:
        _cleanup_patients("s_long_1")


def test_sqlite_legacy_schema_migration(tmp_path):
    import sqlite3
    from sqlalchemy.orm import sessionmaker
    import src.database.session as db_session
    from src.database.models import Patient, GaitSession, ClinicalReport

    legacy_db = tmp_path / "legacy_libra.db"
    conn = sqlite3.connect(str(legacy_db))
    conn.executescript("""
        CREATE TABLE clinics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(255) NOT NULL,
            city VARCHAR(100) DEFAULT '',
            region VARCHAR(100) DEFAULT '',
            created_at DATETIME
        );
        CREATE TABLE patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code VARCHAR(64) NOT NULL UNIQUE,
            side VARCHAR(16) NOT NULL,
            weight FLOAT NOT NULL,
            height FLOAT NOT NULL,
            leg_length FLOAT NOT NULL,
            clinic_id INTEGER REFERENCES clinics(id),
            created_at DATETIME
        );
        CREATE TABLE gait_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            condition VARCHAR(32) NOT NULL,
            cycle_count INTEGER DEFAULT 0,
            avg_gps FLOAT,
            avg_amin_sagh FLOAT,
            avg_gvs_pelvis FLOAT,
            avg_gvs_hip FLOAT,
            avg_gvs_knee FLOAT,
            avg_gvs_ankle FLOAT,
            source VARCHAR(32) DEFAULT 'seeded',
            recorded_at DATETIME,
            CONSTRAINT uq_patient_condition UNIQUE (patient_id, condition)
        );
        CREATE TABLE clinical_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            icf_b770 VARCHAR(16) NOT NULL,
            icf_d450 VARCHAR(16) NOT NULL,
            tje FLOAT NOT NULL,
            pcr FLOAT NOT NULL,
            status VARCHAR(16) DEFAULT 'green',
            narrative_ru TEXT NOT NULL,
            narrative_kz TEXT NOT NULL,
            audience VARCHAR(16) DEFAULT 'doctor',
            created_at DATETIME
        );
        INSERT INTO clinics (id, name) VALUES (1, 'Legacy Clinic');
        INSERT INTO patients (id, code, side, weight, height, leg_length, clinic_id)
            VALUES (1, 's_seed_leg', 'RIGHT', 42.0, 1.38, 0.71, 1);
        INSERT INTO patients (id, code, side, weight, height, leg_length, clinic_id)
            VALUES (2, 's_up_leg', 'LEFT', 39.0, 1.32, 0.68, 1);
        INSERT INTO gait_sessions (id, patient_id, condition, cycle_count, avg_gps, source)
            VALUES (10, 1, 'Baseline', 15, 10.2, 'seeded');
        INSERT INTO gait_sessions (id, patient_id, condition, cycle_count, avg_gps, source)
            VALUES (11, 2, 'Baseline', 8, 11.4, 'uploaded');
        INSERT INTO clinical_reports (id, patient_id, icf_b770, icf_d450, tje, pcr, narrative_ru, narrative_kz)
            VALUES (5, 1, 'b770.2', 'd450.1', -2.0, 0.2, 'RU', 'KZ');
    """)
    conn.commit()
    conn.close()

    mig_url = f"sqlite:///{legacy_db}"
    mig_engine = create_engine(mig_url, connect_args={"check_same_thread": False, "timeout": 30}, echo=False)
    orig_url, orig_engine, orig_sl = db_session.DB_URL, db_session.engine, db_session.SessionLocal
    try:
        db_session.DB_URL = mig_url
        db_session.engine = mig_engine
        db_session.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=mig_engine)
        db_session.init_db(seed_cohort=False)

        with db_session.SessionLocal() as db:
            p_seed = db.query(Patient).filter(Patient.code == "s_seed_leg").one()
            p_up = db.query(Patient).filter(Patient.code == "s_up_leg").one()
            assert p_seed.anthropometry_estimated is False
            assert p_seed.side_estimated is False

            gs_seed = db.query(GaitSession).filter(GaitSession.patient_id == p_seed.id).one()
            gs_up = db.query(GaitSession).filter(GaitSession.patient_id == p_up.id).one()
            assert gs_seed.visit_key == "visit-1"
            assert gs_seed.visit_label == "Базовый курс (KU Leuven)"
            assert gs_seed.visit_date == ""
            assert gs_up.visit_key == "visit-1"
            assert gs_up.visit_label == "Визит 1"
            assert gs_up.visit_date == ""

            rep = db.query(ClinicalReport).filter(ClinicalReport.id == 5).one()
            assert rep.visit_key == "visit-1"

            # Verify uq_patient_condition was replaced with uq_patient_visit_condition
            db.add(GaitSession(
                patient_id=p_seed.id,
                visit_key="visit-2",
                visit_label="Визит 2",
                visit_date="2026-11-25",
                condition="Baseline",
                cycle_count=12,
                avg_gps=9.1,
                source="uploaded",
            ))
            # Verify nullable weight/height/leg_length on Patient
            db.add(Patient(
                code="s_nullable_after_mig",
                side="UNSPECIFIED",
                weight=None,
                height=None,
                leg_length=None,
                anthropometry_estimated=True,
                side_estimated=True,
            ))
            db.commit()
    finally:
        mig_engine.dispose()
        db_session.DB_URL = orig_url
        db_session.engine = orig_engine
        db_session.SessionLocal = orig_sl


def test_reassign_and_delete_patient_session(client):
    _cleanup_patients("s_fix_mode")
    try:
        base_csv = "subject;side;GPS_a;aMinSagH;GVS_aSagP\ns_fix_mode;RIGHT;9,0;8,0;6,0\n".encode("utf-8")
        vr_uploaded_as_verbal = "subject;side;GPS_a;aMinSagH;GVS_aSagP\ns_fix_mode;RIGHT;7,2;3,5;5,8\n".encode("utf-8")
        verbal_uploaded_as_vr = "subject;side;GPS_a;aMinSagH;GVS_aSagP\ns_fix_mode;RIGHT;8,5;6,0;6,1\n".encode("utf-8")

        assert client.post(
            "/api/v1/patients/upload",
            files={"file": ("b.csv", base_csv, "text/csv")},
            data={"condition": "Baseline", "visit_key": "new"},
        ).status_code == 200
        assert client.post(
            "/api/v1/patients/upload",
            files={"file": ("wrong_vb.csv", vr_uploaded_as_verbal, "text/csv")},
            data={"condition": "Verbal", "subject_code": "s_fix_mode", "visit_key": "visit-1"},
        ).status_code == 200

        # Move Verbal -> VR when VR slot is empty
        res_move = client.patch(
            "/api/v1/patients/s_fix_mode/sessions",
            json={"visit_key": "visit-1", "condition": "Verbal", "target_condition": "VR"},
        )
        assert res_move.status_code == 200
        assert res_move.json()["status"] == "moved"
        an1 = client.get("/api/v1/patients/s_fix_mode/analysis").json()
        assert an1["summary"]["has_vr"] is True
        assert an1["summary"]["has_verbal"] is False
        assert an1["summary"]["vr_gps"] == pytest.approx(7.2, abs=1e-3)

        # Upload Verbal and verify 409 without swap, then swap=true swaps VR <-> Verbal
        assert client.post(
            "/api/v1/patients/upload",
            files={"file": ("vb.csv", verbal_uploaded_as_vr, "text/csv")},
            data={"condition": "Verbal", "subject_code": "s_fix_mode", "visit_key": "visit-1"},
        ).status_code == 200
        res_conflict = client.patch(
            "/api/v1/patients/s_fix_mode/sessions",
            json={"visit_key": "visit-1", "condition": "VR", "target_condition": "Verbal", "swap": False},
        )
        assert res_conflict.status_code == 409

        res_swap = client.patch(
            "/api/v1/patients/s_fix_mode/sessions",
            json={"visit_key": "visit-1", "condition": "VR", "target_condition": "Verbal", "swap": True},
        )
        assert res_swap.status_code == 200
        assert res_swap.json()["swapped"] is True
        an2 = client.get("/api/v1/patients/s_fix_mode/analysis").json()
        assert an2["summary"]["vr_gps"] == pytest.approx(8.5, abs=1e-3)
        assert an2["summary"]["verbal_gps"] == pytest.approx(7.2, abs=1e-3)

        # Delete Verbal session
        res_del = client.delete("/api/v1/patients/s_fix_mode/sessions?visit_key=visit-1&condition=Verbal")
        assert res_del.status_code == 200
        assert res_del.json()["remaining_sessions"] == 2
    finally:
        _cleanup_patients("s_fix_mode")






