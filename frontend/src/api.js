import axios from "axios";
import { io } from "socket.io-client";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const PASSCODE_STORAGE_KEY = "sunbelt_demo_passcode";

export const getStoredPasscode = () => localStorage.getItem(PASSCODE_STORAGE_KEY) || "";
export const setStoredPasscode = (passcode) => localStorage.setItem(PASSCODE_STORAGE_KEY, passcode);
export const clearStoredPasscode = () => localStorage.removeItem(PASSCODE_STORAGE_KEY);

// localtunnel shows a "click to continue" interstitial to any request that
// looks browser-issued, which would return HTML instead of JSON to axios/
// socket.io calls. This header skips it. Harmless when not tunneled.
const TUNNEL_BYPASS_HEADERS = { "bypass-tunnel-reminder": "true" };

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: TUNNEL_BYPASS_HEADERS,
});

// Attach the shared demo passcode (if any) to every API call. Harmless no-op
// when DEMO_PASSCODE isn't configured on the backend.
api.interceptors.request.use((config) => {
  const passcode = getStoredPasscode();
  if (passcode) config.headers["X-Demo-Passcode"] = passcode;
  return config;
});

// Verifies a passcode against the backend before we store/use it.
export const verifyPasscode = (passcode) =>
  axios
    .post(`${API_BASE}/api/demo-auth`, { passcode }, { headers: TUNNEL_BYPASS_HEADERS })
    .then(() => true)
    .catch(() => false);

export const socket = io(API_BASE, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  extraHeaders: TUNNEL_BYPASS_HEADERS,
});

// Connects the socket with the current passcode attached to the handshake.
// Call this once the passcode gate has passed.
export const connectSocket = () => {
  socket.auth = { passcode: getStoredPasscode() };
  socket.connect();
};

// ---- Technicians ----
export const createOrGetTechnician = (name) =>
  api.post("/technicians", { name }).then((r) => r.data);

export const listTechnicians = () => api.get("/technicians").then((r) => r.data);

// ---- Conversations ----
export const listConversations = (status) =>
  api.get("/conversations", { params: status ? { status } : {} }).then((r) => r.data);

export const createConversation = (payload) =>
  api.post("/conversations", payload).then((r) => r.data);

export const getConversation = (id) =>
  api.get(`/conversations/${id}`).then((r) => r.data);

export const updateConversation = (id, payload) =>
  api.patch(`/conversations/${id}`, payload).then((r) => r.data);

// ---- Messages ----
export const postMessage = (conversationId, payload) =>
  api.post(`/conversations/${conversationId}/messages`, payload).then((r) => r.data);

// ---- Photos ----
export const uploadPhoto = (file, technicianId, question) => {
  const formData = new FormData();
  formData.append("photo", file);
  if (technicianId) formData.append("technician_id", technicianId);
  if (question) formData.append("question", question);
  return api
    .post("/photos/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    .then((r) => r.data);
};

// Query param (not a header) because this URL is used directly in <img src>.
export const photoFileUrl = (photoId) => {
  const passcode = getStoredPasscode();
  const suffix = passcode ? `?passcode=${encodeURIComponent(passcode)}` : "";
  return `${API_BASE}/api/photos/${photoId}/file${suffix}`;
};

// ---- Diagnostic Logs ----
export const listDiagnosticLogs = (filters = {}) =>
  api.get("/diagnostic-logs", { params: filters }).then((r) => r.data);

// ---- Search (across every technician's logged sessions) ----
export const searchAll = (params = {}) =>
  api.get("/search", { params }).then((r) => r.data);

export const getCategories = () =>
  api.get("/categories").then((r) => r.data);
