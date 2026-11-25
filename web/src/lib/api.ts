import {
  Patient,
  PatientAnalysis,
  KinematicsResponse,
  CohortAnalytics,
  MLMetrics,
  GaitDiffResponse,
  CsvUploadResponse,
  VisitSummary,
} from "./types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL !== undefined
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://127.0.0.1:8000";

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

function buildQuery(params: Record<string, string | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") {
      sp.set(k, v);
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
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

export async function getPatients(signal?: AbortSignal): Promise<Patient[]> {
  return fetchJson<Patient[]>("/api/v1/patients", { signal });
}

export async function getPatientVisits(
  code: string,
  signal?: AbortSignal
): Promise<{ code: string; visits: VisitSummary[] }> {
  return fetchJson<{ code: string; visits: VisitSummary[] }>(
    `/api/v1/patients/${encodeURIComponent(code)}/visits`,
    { signal }
  );
}

export async function getPatientAnalysis(
  code: string,
  visit?: string,
  signal?: AbortSignal
): Promise<PatientAnalysis> {
  const qs = buildQuery({ visit });
  return fetchJson<PatientAnalysis>(
    `/api/v1/patients/${encodeURIComponent(code)}/analysis${qs}`,
    { signal }
  );
}

export async function getPatientKinematics(
  code: string,
  visit?: string,
  signal?: AbortSignal
): Promise<KinematicsResponse> {
  const qs = buildQuery({ visit });
  return fetchJson<KinematicsResponse>(
    `/api/v1/patients/${encodeURIComponent(code)}/kinematics${qs}`,
    { signal }
  );
}

export async function getCohortAnalytics(signal?: AbortSignal): Promise<CohortAnalytics> {
  return fetchJson<CohortAnalytics>("/api/v1/analytics/cohort", { signal });
}

export async function getMLMetrics(signal?: AbortSignal): Promise<MLMetrics> {
  return fetchJson<MLMetrics>("/api/v1/ml/metrics", { signal });
}

export async function createReport(
  code: string,
  lang: "ru" | "kz" | "en",
  audience: "doctor" | "parent" = "doctor",
  visit?: string
) {
  const qs = buildQuery({ lang, audience, visit });
  const url = `${API_BASE}/api/v1/patients/${encodeURIComponent(code)}/report${qs}`;
  const res = await fetch(url, { method: "POST", headers: getAuthHeaders() });
  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errorBody || res.statusText}`);
  }
  return res.json();
}

export async function reassignPatientSession(
  code: string,
  payload: {
    visit_key: string;
    condition: "Baseline" | "Verbal" | "VR";
    target_condition: "Baseline" | "Verbal" | "VR";
    target_visit_key?: string;
    swap?: boolean;
  }
): Promise<{ status: string; code: string; visit_key: string; condition: string; swapped: boolean }> {
  return fetchJson(`/api/v1/patients/${encodeURIComponent(code)}/sessions`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deletePatientSession(
  code: string,
  visitKey: string,
  condition: "Baseline" | "Verbal" | "VR"
): Promise<{ status: string; code: string; visit_key: string; condition: string; remaining_sessions: number }> {
  const qs = buildQuery({ visit_key: visitKey, condition });
  return fetchJson(`/api/v1/patients/${encodeURIComponent(code)}/sessions${qs}`, {
    method: "DELETE",
  });
}

export async function getPatientDiff(
  code: string,
  sessionA: string = "Baseline",
  sessionB: string = "VR",
  lang: "ru" | "kz" | "en" = "ru",
  visitA?: string,
  visitB?: string,
  signal?: AbortSignal
): Promise<GaitDiffResponse> {
  const qs = buildQuery({
    session_a: sessionA,
    session_b: sessionB,
    lang,
    visit_a: visitA,
    visit_b: visitB,
  });
  return fetchJson<GaitDiffResponse>(
    `/api/v1/patients/${encodeURIComponent(code)}/diff${qs}`,
    { signal }
  );
}

export async function uploadPatientCSV(
  file: File,
  condition?: "Baseline" | "Verbal" | "VR",
  subjectCode?: string,
  visitOptions?: { visitKey?: string; visitLabel?: string; visitDate?: string }
): Promise<CsvUploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  if (condition) {
    formData.append("condition", condition);
  }
  if (subjectCode && subjectCode.trim()) {
    formData.append("subject_code", subjectCode.trim());
  }
  if (visitOptions?.visitKey && visitOptions.visitKey.trim()) {
    formData.append("visit_key", visitOptions.visitKey.trim());
  }
  if (visitOptions?.visitLabel && visitOptions.visitLabel.trim()) {
    formData.append("visit_label", visitOptions.visitLabel.trim());
  }
  if (visitOptions?.visitDate && visitOptions.visitDate.trim()) {
    formData.append("visit_date", visitOptions.visitDate.trim());
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

async function downloadAuthenticatedBlob(url: string, filename: string): Promise<void> {
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${errText || res.statusText}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function downloadCsvTemplate(format: "vicon" | "imu" | "kinematics"): Promise<void> {
  return downloadAuthenticatedBlob(
    `${API_BASE}/api/v1/ingest/template?format=${format}`,
    `libra_template_${format}.csv`
  );
}

export async function downloadReportPdf(
  code: string,
  lang: "ru" | "kz" | "en",
  audience: "doctor" | "parent" = "doctor",
  visit?: string
): Promise<void> {
  const qs = buildQuery({ lang, audience, visit });
  return downloadAuthenticatedBlob(
    `${API_BASE}/api/v1/patients/${encodeURIComponent(code)}/report.pdf${qs}`,
    `libra-report-${code}${visit ? `-${visit}` : ""}-${lang}.pdf`
  );
}
