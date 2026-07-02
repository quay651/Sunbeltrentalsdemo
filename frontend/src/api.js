import axios from "axios";
import { io } from "socket.io-client";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

export const api = axios.create({
  baseURL: `${API_BASE}/api`,
});

export const socket = io(API_BASE, {
  autoConnect: true,
  transports: ["websocket", "polling"],
});

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

export const photoFileUrl = (photoId) => `${API_BASE}/api/photos/${photoId}/file`;

// ---- Diagnostic Logs ----
export const listDiagnosticLogs = (filters = {}) =>
  api.get("/diagnostic-logs", { params: filters }).then((r) => r.data);

// ---- Search (across every technician's logged sessions) ----
export const searchAll = (params = {}) =>
  api.get("/search", { params }).then((r) => r.data);

export const getCategories = () =>
  api.get("/categories").then((r) => r.data);
