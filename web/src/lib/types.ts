export interface Patient {
  id: number;
  code: string;
  side: "LEFT" | "RIGHT";
  weight: number;
  height: number;
  leg_length: number;
  clinic_name: string | null;
  pcr?: number | null;
  tje?: number | null;
  status?: "green" | "yellow" | "red" | "unassessed";
  baseline_gps?: number | null;
  vr_gps?: number | null;
  delta_amin_sagh?: number | null;
  has_vr?: boolean;
  has_verbal?: boolean;
}

export interface DiscreteSummary {
  subject: string;
  side: string;
  weight: number;
  height: number;
  leg_length: number;
  cycles_baseline: number;
  cycles_vr: number;
  cycles_verbal?: number;
  baseline_cycles?: number;
  vr_cycles?: number;
  verbal_cycles?: number;
  has_baseline?: boolean;
  has_vr?: boolean;
  has_verbal?: boolean;
  baseline_pelvis_tilt?: number | null;
  vr_pelvis_tilt?: number | null;
  verbal_pelvis_tilt?: number | null;
  delta_pelvis_tilt?: number | null;
  verbal_delta_pelvis_tilt?: number | null;
  baseline_hip_rom?: number | null;
  baseline_gps: number | null;
  baseline_amin_sagh: number | null;
  baseline_gvs_pelvis: number | null;
  baseline_gvs_hip: number | null;
  baseline_gvs_knee: number | null;
  baseline_gvs_ankle: number | null;
  baseline_pctm_zero?: number | null;
  vr_gps: number | null;
  vr_amin_sagh: number | null;
  vr_gvs_pelvis: number | null;
  vr_gvs_hip: number | null;
  vr_gvs_knee: number | null;
  vr_gvs_ankle: number | null;
  vr_pctm_zero?: number | null;
  verbal_gps?: number | null;
  verbal_amin_sagh?: number | null;
  verbal_gvs_pelvis?: number | null;
  verbal_gvs_hip?: number | null;
  verbal_gvs_knee?: number | null;
  verbal_gvs_ankle?: number | null;
  verbal_pctm_zero?: number | null;
  delta_gps: number | null;
  delta_amin_sagh: number | null;
  delta_gvs_pelvis: number | null;
  delta_gvs_hip: number | null;
  delta_gvs_knee: number | null;
  delta_gvs_ankle: number | null;
  delta_pctm_zero?: number | null;
  baseline_gdi?: number | null;
  vr_gdi?: number | null;
  verbal_gdi?: number | null;
  delta_gdi?: number | null;
}

export interface CdssRisk {
  status: "green" | "yellow" | "red" | "unassessed";
  pcr: number | null;
  tje: number | null;
  label_ru: string;
  label_kz: string;
  recommendation_ru: string;
  recommendation_kz: string;
}

export interface ModalitiesComparison {
  best_method: "VR" | "Verbal" | "Baseline";
  tje_vr: number | null;
  tje_verbal: number | null;
  pcr_vr: number | null;
  pcr_verbal: number | null;
  delta_hip_vr: number | null;
  delta_hip_verbal: number | null;
  delta_pelvis_vr: number | null;
  delta_pelvis_verbal: number | null;
  verdict_ru: string;
  verdict_kz: string;
}

export interface PatientAnalysis {
  summary: DiscreteSummary;
  cdss_risk: CdssRisk;
  cdss?: CdssRisk;
  modalities?: ModalitiesComparison;
  icf: {
    b770_baseline: string;
    b770_vr: string;
    d450: string;
  };
  ml: {
    vr_gait_signature_confidence: number;
    binary_roc_auc?: number;
    is_vr_discriminative: boolean;
    responder_prediction?: {
      responder_probability: number;
      is_predicted_responder: boolean;
      loo_balanced_accuracy?: number;
      loo_roc_auc?: number;
      model_reliable?: boolean;
      feature_attributions?: FeatureAttribution[];
      clinical_status_ru: string;
      clinical_status_kz: string;
      recommendation_ru: string;
      recommendation_kz: string;
    };
    pca_stability?: {
      has_curves?: boolean;
      anomaly_rate: number | null;
      n_anomalies: number;
      n_cycles: number;
      is_stable: boolean | null;
      cycles?: Array<{
        cycle_index: number;
        spe: number;
        threshold: number;
        is_anomaly: boolean;
      }>;
    };
  };
}

export interface JointCurveSeries {
  mean: number[];
  std: number[];
}

export interface JointKinematics {
  name_ru: string;
  name_kz: string;
  unit: string;
  time_percent: number[];
  baseline: JointCurveSeries | null;
  vr: JointCurveSeries | null;
  verbal: JointCurveSeries | null;
  norm_td: JointCurveSeries;
}

export interface KinematicsResponse {
  subject: string;
  is_surrogate?: boolean;
  is_fallback?: boolean;
  has_curves?: boolean;
  available_conditions?: Array<"Baseline" | "Verbal" | "VR">;
  joints: {
    aSagP?: JointKinematics;
    aSagH?: JointKinematics;
    aSagK?: JointKinematics;
    aSagA?: JointKinematics;
    mSagH?: JointKinematics;
  };
}

export interface CohortAnalytics {
  source: {
    name: string;
    citation: string;
    doi: string;
    license: string;
  };
  total_patients: number;
  cycles: {
    baseline: number;
    verbal: number;
    vr: number;
    total: number;
  };
  cdss_distribution: {
    green: number;
    yellow: number;
    red: number;
  };
  best_method_distribution: {
    VR: number;
    Verbal: number;
    Baseline: number;
  };
  side_distribution: {
    LEFT: number;
    RIGHT: number;
  };
  averages: {
    baseline_gps: number | null;
    verbal_gps: number | null;
    vr_gps: number | null;
    delta_amin_sagh: number | null;
    tje_vr: number | null;
    pcr_vr: number | null;
  };
  anthropometrics: {
    weight_min: number | null;
    weight_max: number | null;
    height_min: number | null;
    height_max: number | null;
    leg_length_min: number | null;
    leg_length_max: number | null;
  };
}

export interface FeatureAttribution {
  feature: string;
  value: number;
  z_score: number;
  attribution: number;
  direction: "fosters_responder" | "increases_compensation_risk";
}

export interface GaitDiffResponse {
  patient: string;
  session_a: string;
  session_b: string;
  status: "improved" | "stable" | "regressed";
  session_a_label: string;
  session_b_label: string;
  gps_a: number;
  gps_b: number;
  delta_gps: number;
  gdi_a: number;
  gdi_b: number;
  delta_gdi: number;
  tje_a: number;
  tje_b: number;
  delta_tje: number;
  pcr_a: number;
  pcr_b: number;
  delta_pcr: number;
  icf_a: string;
  icf_b: string;
  icf_transition: string;
  icf_improved: boolean;
  verdict_ru: string;
  verdict_kz: string;
}

export interface ThreeClassMLMetrics {
  balanced_accuracy: number;
  roc_auc?: number;
  f1_macro: number;
  n_splits: number;
  n_cycles: number;
  n_subjects: number;
}

export interface PcaValidationMetrics {
  oof_baseline_anomaly_rate: number;
  vr_anomaly_rate: number;
  fold_rates: number[];
  n_splits: number;
  n_subjects: number;
  n_cycles: number;
  vr_n_cycles?: number;
}

export interface VrResponderMetrics {
  balanced_accuracy: number;
  roc_auc: number;
  n_subjects: number;
  n_responders: number;
  n_compensators: number;
  feature_mode?: string;
  note?: string;
  note_kz?: string;
}

export interface MLMetrics {
  balanced_accuracy: number;
  roc_auc: number;
  sensitivity: number;
  specificity: number;
  f1_macro: number;
  n_splits: number;
  n_cycles: number;
  n_subjects: number;
  feature_importances: Record<string, number>;
  three_class?: ThreeClassMLMetrics;
  pca_validation?: PcaValidationMetrics;
  vr_responder?: VrResponderMetrics;
}

export interface CsvUploadResponse {
  status: string;
  code: string;
  codes?: string[];
  patients_updated?: number;
  condition?: "Baseline" | "Verbal" | "VR";
  has_kinematics?: boolean;
  rows?: number;
  columns?: number;
  message_ru?: string;
  message_kz?: string;
}
