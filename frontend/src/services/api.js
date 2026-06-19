import axios from 'axios';
import { supabase } from '../supabaseClient';

// Hardcoded to bypass Vercel ENV issues
const API_BASE = 'https://talentlens-jhic.onrender.com';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 120000, // 2 min timeout
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

/**
 * Submit resumes for analysis against a job description.
 * @param {string} jobDescription
 * @param {string} jobTitle
 * @param {File[]} resumeFiles
 * @param {function} onProgress - optional progress callback
 * @returns {Promise<object>} Analysis results
 */
export async function analyzeResumes(jobDescription, jobTitle, resumeFiles, onProgress) {
  const formData = new FormData();
  formData.append('job_description', jobDescription);
  if (jobTitle) formData.append('job_title', jobTitle);
  resumeFiles.forEach((file) => formData.append('resumes', file));

  const response = await api.post('/api/analyze', formData, {
    onUploadProgress: onProgress,
  });
  return response.data;
}

/** List all past analysis sessions. */
export async function getSessions() {
  const response = await api.get('/api/sessions');
  return response.data;
}

/** Get full results for a session. */
export async function getSession(sessionId) {
  const response = await api.get(`/api/session/${sessionId}`);
  return response.data;
}

/** Delete a session. */
export async function deleteSession(sessionId) {
  const response = await api.delete(`/api/session/${sessionId}`);
  return response.data;
}

/** Get CSV export URL. */
export function getExportUrl(sessionId) {
  return `${API_BASE}/api/export/${sessionId}`;
}

/** Health check. */
export async function healthCheck() {
  const response = await api.get('/health');
  return response.data;
}

export async function generateShortlistEmail(sessionId, topN) {
  const response = await api.post(`/api/sessions/${sessionId}/shortlist-email`, { top_n: topN });
  return response.data;
}

export async function analyzeJD(payload) {
  const response = await api.post('/api/jd/analyze', payload);
  return response.data;
}

export async function updateCandidateNotes(candidateId, notes) {
  const response = await api.patch(`/api/candidates/${candidateId}/notes`, { notes });
  return response.data;
}

export async function generateInterviewQuestions(candidateId) {
  const response = await api.get(`/api/candidates/${candidateId}/questions`);
  return response.data;
}

export default {
  analyzeResumes,
  getSessions,
  getSession,
  deleteSession,
  getExportUrl,
  healthCheck,
  generateShortlistEmail,
  analyzeJD,
  updateCandidateNotes,
  generateInterviewQuestions,
};
