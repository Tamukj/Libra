import {
  Patient,
  PatientAnalysis,
  KinematicsResponse,
  CohortAnalytics,
  MLMetrics,
  GaitDiffResponse,
  CsvUploadResponse,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://127.0.0.1:8000";

export function getApiBase(): string {
  return API_BASE;
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const key = sessionStorage.getItem("libra_api_key");
    if (key && key.trim()) {
      return { "X-API-Key": key.trim() };
    }
  } catch {}
  return {};
}

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errorBody || res.statusText}`);
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

export async function getCohortAnalytics(): Promise<CohortAnalytics> {
  return fetchJson<CohortAnalytics>("/api/v1/analytics/cohort");
}

export async function getMLMetrics(): Promise<MLMetrics> {
  return fetchJson<MLMetrics>("/api/v1/ml/metrics");
}

export async function createReport(
  code: string,
  lang: "ru" | "kz",
  audience: "doctor" | "parent" = "doctor"
) {
  const url = `${API_BASE}/api/v1/patients/${encodeURIComponent(code)}/report?lang=${lang}&audience=${audience}`;
  const res = await fetch(url, { method: "POST", headers: getAuthHeaders() });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errorBody || res.statusText}`);
  }
  return res.json();
}

export async function getPatientDiff(
  code: string,
  sessionA: string = "Baseline",
  sessionB: string = "VR",
  lang: "ru" | "kz" = "ru"
): Promise<GaitDiffResponse> {
  const endpoint = `/api/v1/patients/${encodeURIComponent(code)}/diff?session_a=${encodeURIComponent(sessionA)}&session_b=${encodeURIComponent(sessionB)}&lang=${lang}`;
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
  const res = await fetch(url, {
    method: "POST",
    body: formData,
    headers: getAuthHeaders(),
  });
  if (res.ok) return await res.json();
  const errText = await res.text().catch(() => "");
  throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
}

export function getCsvTemplateUrl(format: "vicon" | "imu" | "kinematics"): string {
  return `${API_BASE}/api/v1/ingest/template?format=${format}`;
}

export function getReportPdfUrl(
  code: string,
  lang: "ru" | "kz",
  audience: "doctor" | "parent" = "doctor"
): string {
  return `${API_BASE}/api/v1/patients/${encodeURIComponent(code)}/report.pdf?lang=${lang}&audience=${audience}`;
}

export async function downloadReportPdf(
  code: string,
  lang: "ru" | "kz",
  audience: "doctor" | "parent" = "doctor"
): Promise<void> {
  const url = getReportPdfUrl(code, lang, audience);
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = `libra-report-${code}-${lang}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
