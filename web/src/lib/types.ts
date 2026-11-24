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
  status?: "green" | "yellow" | "red";
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
  baseline_pelvis_tilt?: number | null;
  vr_pelvis_tilt?: number | null;
  verbal_pelvis_tilt?: number | null;
  delta_pelvis_tilt?: number | null;
  baseline_gps: number;
  baseline_amin_sagh: number;
  baseline_gvs_pelvis: number;
  baseline_gvs_hip: number;
  baseline_gvs_knee: number;
  baseline_gvs_ankle: number;
  baseline_pctm_zero?: number | null;
  vr_gps: number;
  vr_amin_sagh: number;
  vr_gvs_pelvis: number;
  vr_gvs_hip: number;
  vr_gvs_knee: number;
  vr_gvs_ankle: number;
  vr_pctm_zero?: number | null;
  verbal_gps?: number | null;
  verbal_amin_sagh?: number;
  verbal_gvs_pelvis?: number;
  verbal_gvs_hip?: number;
  verbal_gvs_knee?: number;
  verbal_gvs_ankle?: number;
  verbal_pctm_zero?: number | null;
  delta_gps: number;
  delta_amin_sagh: number;
  delta_gvs_pelvis: number;
  delta_gvs_hip: number;
  delta_gvs_knee: number;
  delta_gvs_ankle: number;
  delta_pctm_zero?: number | null;
  baseline_gdi?: number;
  vr_gdi?: number;
  verbal_gdi?: number | null;
  delta_gdi?: number;
}

export interface CdssRisk {
  status: "green" | "yellow" | "red";
  pcr: number | null;
  tje: number | null;
  label_ru: string;
  label_kz: string;
  recommendation_ru: string;
  recommendation_kz: string;
}

export interface ModalitiesComparison {
  best_method: "VR" | "Verbal" | "Baseline";
  tje_vr: number;
  tje_verbal: number;
  pcr_vr: number;
  pcr_verbal: number;
  delta_hip_vr: number;
  delta_hip_verbal: number;
  delta_pelvis_vr: number;
  delta_pelvis_verbal: number;
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
      anomaly_rate: number;
      n_anomalies: number;
      n_cycles: number;
      is_stable: boolean;
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
  baseline: JointCurveSeries;
  vr: JointCurveSeries;
  verbal: JointCurveSeries;
  norm_td: JointCurveSeries;
}

export interface KinematicsResponse {
  subject: string;
  is_surrogate?: boolean;
  is_fallback?: boolean;
  joints: {
    aSagP: JointKinematics;
    aSagH: JointKinematics;
    aSagK: JointKinematics;
    aSagA: JointKinematics;
  };
}

export interface RegionalStats {
  country: {
    name_ru: string;
    name_kz: string;
    total_children_disability: number;
    children_with_cp: number;
    primary_disability_annual: number;
    neurological_ratio_pct: number;
    sources: string[];
  };
  region_abai: {
    name_ru: string;
    name_kz: string;
    children_disability: number;
    musculoskeletal_cp_children: number;
    rehab_centers: Array<{
      name: string;
      city: string;
      annual_capacity: number;
    }>;
    annual_coverage_pct: number;
    average_waiting_months: number;
    labs_3d_grail_count: number;
    economic_impact: {
      time_saved_per_patient_minutes: number;
      cost_reduction_pct: number;
      annual_queue_reduction_estimate_pct: number;
    };
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
}

export interface CsvUploadResponse {
  status: string;
  code: string;
  condition?: "Baseline" | "Verbal" | "VR";
  rows?: number;
  columns?: number;
  message_ru?: string;
  message_kz?: string;
}
