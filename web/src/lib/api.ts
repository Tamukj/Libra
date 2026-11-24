import {
  Patient,
  PatientAnalysis,
  KinematicsResponse,
  RegionalStats,
  MLMetrics,
  GaitDiffResponse,
  CsvUploadResponse
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export function getApiBase(): string {
  return API_BASE;
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {})
    }
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`API error [${res.status}] ${res.statusText}: ${errorBody}`);
  }

  return res.json();
}

export async function getPatients(): Promise<Patient[]> {
  return fetchJson<Patient[]>("/api/v1/patients");
}

export async function getPatientAnalysis(code: string): Promise<PatientAnalysis> {
  return fetchJson<PatientAnalysis>(`/api/v1/patients/${encodeURIComponent(code)}/analysis`);
}

export async function getPatientKinematics(code: string): Promise<KinematicsResponse> {
  return fetchJson<KinematicsResponse>(`/api/v1/patients/${encodeURIComponent(code)}/kinematics`);
}

export async function getRegionalStats(): Promise<RegionalStats> {
  return fetchJson<RegionalStats>("/api/v1/statistics/regional");
}

export async function getMLMetrics(): Promise<MLMetrics> {
  return fetchJson<MLMetrics>("/api/v1/ml/metrics");
}

export async function createReport(
  code: string,
  lang: "ru" | "kz" | "en",
  audience: "doctor" | "parent" = "doctor"
) {
  const url = `${API_BASE}/api/v1/patients/${encodeURIComponent(code)}/report?lang=${lang}&audience=${audience}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`Report error [${res.status}] ${res.statusText}: ${errorBody}`);
  }
  return res.json();
}

export async function getPatientDiff(
  code: string,
  sessionA: string = "Baseline",
  sessionB: string = "VR"
): Promise<GaitDiffResponse> {
  const endpoint = `/api/v1/patients/${encodeURIComponent(code)}/diff?session_a=${encodeURIComponent(sessionA)}&session_b=${encodeURIComponent(sessionB)}`;
  return fetchJson<GaitDiffResponse>(endpoint);
}

export async function uploadPatientCSV(
  file: File,
  condition?: "Baseline" | "Verbal" | "VR",
  subjectCode?: string
): Promise<CsvUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (condition) {
    formData.append("condition", condition);
  }
  if (subjectCode && subjectCode.trim()) {
    formData.append("subject_code", subjectCode.trim());
  }
  const url = `${API_BASE}/api/v1/patients/upload`;
  const res = await fetch(url, { method: "POST", body: formData });
  if (res.ok) return await res.json();
  const errText = await res.text().catch(() => "");
  throw new Error(`Upload failed [${res.status}]: ${errText}`);
}

export function getCsvTemplateUrl(format: "vicon" | "imu" | "kinematics"): string {
  return `${API_BASE}/api/v1/ingest/template?format=${format}`;
}

export function getFhirBundleUrl(code: string): string {
  return `${API_BASE}/api/v1/patients/${encodeURIComponent(code)}/fhir`;
}

export async function downloadFhirBundle(code: string): Promise<void> {
  const url = getFhirBundleUrl(code);
  const res = await fetch(url);
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`FHIR export failed [${res.status}]: ${errText}`);
  }
  const bundle = await res.json();
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/fhir+json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `libra-fhir-${code}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
