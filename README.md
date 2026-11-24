# Libra

Clinical biomechanics and decision support system for pediatric cerebral palsy rehabilitation.

Developed for AI-Sana Shakarim Solveathon: AI & Medicine 2026, Semey, Abai Region.

Libra processes 3D gait data, detects compensatory pelvic tilt during virtual reality motor therapy, isolates true hip joint extension, and generates clinical documentation aligned with World Health Organization International Classification of Functioning codes (ICF b770 and d450).

---

## Clinical statechart

```mermaid
stateDiagram-v2
    [*] --> Ingestion

    state Ingestion {
        [*] --> SelectPatient
        [*] --> UploadCustomCSV
        SelectPatient --> ParseData
        UploadCustomCSV --> ValidateFormat
        ValidateFormat --> ParseData
    }

    Ingestion --> BiomechanicsEngine : Cleaned kinematic arrays and discrete metrics

    state BiomechanicsEngine {
        [*] --> ComputeBakerScores : GVS and GPS
        ComputeBakerScores --> ComputeTrueJointExtension : TJE formula
        ComputeTrueJointExtension --> ComputeCompensationRatio : PCR formula
        ComputeCompensationRatio --> ClassifyWHOICF : b770 and d450 codes
    }

    BiomechanicsEngine --> DecisionSupport : Biomechanical feature vectors

    state DecisionSupport {
        [*] --> GroupKFoldClassifier : Leak-free condition prediction
        [*] --> PCAStabilityGuard : Q-statistic reconstruction error
        GroupKFoldClassifier --> ModalityVerdict : Compare Baseline, Verbal, VR
        PCAStabilityGuard --> ModalityVerdict
        ModalityVerdict --> TrafficLightStatus : Green, Yellow, Red
    }

    DecisionSupport --> OutputDelivery : Clinical evaluation

    state OutputDelivery {
        [*] --> InteractiveDashboard : 51-point curves, radar, regional stats
        [*] --> MedicalNarrative : Doctor protocol and parent summary in KZ, RU, EN
        InteractiveDashboard --> ExportProtocol : Damumed integration
        MedicalNarrative --> ExportProtocol
    }

    OutputDelivery --> [*]
```

---

## Quick start

### Prerequisites

- Linux or macOS with Python 3.10 or newer and Node.js 18 or newer
- Or Docker and Docker Compose

### Option A: Local startup in one command

Run the startup script from the repository root:

```bash
./run_local.sh
```

The script starts the FastAPI backend on port 8000 and the Next.js frontend on port 3000.

- Web interface: http://127.0.0.1:3000
- REST API documentation (OpenAPI Swagger): http://127.0.0.1:8000/docs
- Health check: http://127.0.0.1:8000/health

To stop both services, press `Ctrl+C`.

### Option B: Docker Compose startup

To run the containerized production stack with Caddy, FastAPI, and PostgreSQL:

```bash
docker compose up -d --build
```

Access the interface at http://localhost.

---

## Test suite execution

To run all 29 automated tests verifying parsers, biomechanical formulas, leak-free machine learning, and API contracts:

```bash
python3 -m pytest tests/ -v
```

All 29 tests must pass without errors.

---

## Step-by-step jury evaluation guide

Follow these 9 steps to test the application:

1. **Open the application:** Navigate to http://127.0.0.1:3000 in your browser.
2. **Review the cohort:** Use the patient selector in the upper toolbar. The cohort contains all 29 participants from the hackathon dataset.
3. **Inspect high-risk compensation (Patient `s61520_1`):** Select patient `s61520_1`. Observe that the Clinical Decision Support indicator turns Red. The patient displays a Pathological Compensation Ratio of 1.21. While raw hip extension appears improved by 2.87 degrees, the child achieved this through an anterior pelvic tilt deviation of 5.55 degrees, creating risk of lumbar hyperlordosis.
4. **Inspect true therapeutic response (Patient `s61520_13`):** Select patient `s61520_13`. Observe the Green indicator. The patient achieved true joint extension with a Pathological Compensation Ratio under 0.40 without dangerous pelvic tilt.
5. **Compare modalities:** Scroll to the "Selection of rehabilitation tactics" card. The card compares Baseline, Verbal, and VR conditions, stating whether verbal feedback or VR feedback provides the safer outcome for the active patient.
6. **Switch language:** Click the language button in the top navigation bar to toggle between Kazakh (`ҚАЗ`), Russian (`РУС`), and English (`ENG`). Notice that medical terminology updates across the entire interface.
7. **View regional open data:** Click "Regional data" in the navigation bar. The modal displays epidemiology statistics for Kazakhstan and the Abai Region sourced from `stat.gov.kz` and `data.egov.kz`, showing 2,840 children with disabilities in the region and 0 dedicated 3D gait laboratories in Semey.
8. **Generate clinical report:** Click "Generate report" in the upper right corner. Review the standardized clinical protocol containing WHO ICF codes `b770` and `d450`, metric deltas, and doctor recommendations ready for export to electronic medical record systems like Damumed.
9. **Test custom CSV upload:** Click "Upload CSV" in the top bar. Select or drag any table adhering to the discrete parameter format. The engine validates column headers, parses decimal commas, and displays the analyzed patient card.

---

## Biomechanical formulas

### 1. Baker Gait Variable Score (GVS) and Gait Profile Score (GPS)

GVS measures the root mean square deviation of a patient's kinematic curve from the normative mean of typically developing children across 51 points of the gait cycle:

$$GVS_v = \sqrt{ \frac{1}{51} \sum_{t=0}^{50} \left( \theta_{patient, v}(t) - \bar{\theta}_{TD, v}(t) \right)^2 }$$

GPS is the overall index combining all joint variable scores:

$$GPS = \sqrt{ \frac{1}{N_v} \sum_{v=1}^{N_v} GVS_v^2 }$$

### 2. True Joint Extension (TJE)

Children with cerebral palsy often simulate hip extension by tilting the pelvis anteriorly. True Joint Extension isolates true anatomical joint extension:

$$TJE = \Delta aMinSagH + \alpha \cdot \Delta PelvicTilt$$

A negative delta indicates improved anatomical extension.

### 3. Pathological Compensation Ratio (PCR)

PCR quantifies the ratio of kinematic degradation in adjacent segments (pelvis, knee, ankle) relative to hip extension gain:

$$PCR = \frac{0.5 \cdot \max(0, \Delta GVS_P) + 0.3 \cdot \max(0, \Delta GVS_K) + 0.2 \cdot \max(0, \Delta GVS_A)}{|\Delta aMinSagH|}$$

- **Green ($PCR < 0.4$):** True responder. Pure joint improvement.
- **Yellow ($0.4 \le PCR \le 0.8$):** Moderate adaptation. Requires therapist monitoring.
- **Red ($PCR > 0.8$):** Pathological compensation. The engine advises lowering VR target angle by 30 percent.

### 4. WHO ICF classification mapping

- **ICF code b770 (Gait pattern functions):** Mapped from GPS:
  - `b770.0` (No impairment): GPS < 5.5 deg
  - `b770.1` (Mild impairment): 5.5 to 7.5 deg
  - `b770.2` (Moderate impairment): 7.5 to 11.0 deg
  - `b770.3` (Severe impairment): 11.0 to 15.0 deg
  - `b770.4` (Complete impairment): GPS >= 15.0 deg
- **ICF code d450 (Walking stability):** Mapped from gait cycle anomaly rate detected by the kinematic PCA model.

---

## Machine learning protocol

The machine learning pipeline follows three rules:

1. **Strict subject isolation:** Evaluated through `GroupKFold(n_splits=5)` grouped by `subject`. Cycles of the same patient never appear in both training and test sets.
2. **Leak-free preprocessing:** Imputation and scaling occur inside each cross-validation fold.
3. **Realistic clinical metrics:** Balanced Accuracy is 73.0 percent and ROC-AUC is 0.76.
4. **Kinematic PCA stability detector:** Analyzes Squared Prediction Error on 51-point curves. Cycles exceeding the 95th percentile threshold are flagged as unstable steps.

---

## REST API reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check verifying database and engine readiness |
| `GET` | `/api/v1/patients` | List of all 29 cohort patients with metadata |
| `GET` | `/api/v1/patients/{code}/summary` | Baseline, Verbal, VR metrics, deltas, TJE, and PCR |
| `GET` | `/api/v1/patients/{code}/kinematics` | 51-point kinematic curves for pelvis, hip, knee, and ankle |
| `GET` | `/api/v1/patients/{code}/report` | Structured medical narrative with ICF codes in KZ, RU, and EN |
| `GET` | `/api/v1/ml/metrics` | GroupKFold cross-validation results and feature importances |
| `GET` | `/api/v1/open-data/regional` | Healthcare statistics for Kazakhstan and the Abai Region |
| `POST`| `/api/v1/ingest/discrete` | Upload and validation of custom CSV files |

---

## Compliance with hackathon rules

| Requirement | Implementation in Libra |
| :--- | :--- |
| **CSV parsing** | Handles semicolon delimiters, decimal commas, missing NaN values, and patient identifiers. |
| **Modality comparison** | Compares Baseline, Verbal, and VR across discrete metrics and 51-point kinematic curves. |
| **Machine learning** | GroupKFold cross-validation grouped by subject, feature importances, and PCA anomaly detection. |
| **Clinical presentation** | Doctor card, CDSS safety indicator, radar chart, and exportable report with ICF b770 and d450 codes. |
| **Multilingual support (Rule 9.3)** | Complete localization in Kazakh, Russian, and English. |
| **Open data (Rule 9.3)** | Integrated datasets from stat.gov.kz and data.egov.kz covering Kazakhstan and Semey. |
| **Safety and ethics (Rule 8.4)** | Operates strictly as a decision support tool without autonomous prescribing. Includes emergency disclaimers (103) and data protection compliance (Law of RK No. 94-V). |
