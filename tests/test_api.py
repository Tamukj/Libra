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




