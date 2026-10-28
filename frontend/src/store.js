import { useSyncExternalStore } from 'react';

const SESSION_KEY = 'inguard_session_v1';
const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
const emptyDB = () => ({ users: [], patients: [], requests: [], resets: {} });
let cache = emptyDB();
const listeners = new Set();

const emit = () => listeners.forEach((listener) => listener());
const subscribe = (callback) => {
  listeners.add(callback);
  return () => listeners.delete(callback);
};

export const useDB = () => useSyncExternalStore(subscribe, () => cache);

function sessionToken() {
  const session = loadSession();
  return session?.token || '';
}

async function api(path, { method = 'GET', body, token = sessionToken() } = {}) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new Error(`No se pudo conectar con el backend (${API_BASE}). Verificá que esté iniciado y que VITE_API_URL sea correcto.`);
  }

  const text = await response.text();
  let result = null;
  if (text) {
    try {
      result = JSON.parse(text);
    } catch {
      throw new Error(`El backend respondió con un formato inválido (HTTP ${response.status}).`);
    }
  }
  if (!response.ok) {
    const detail = result?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => `${item.campo}: ${item.mensaje}`).join(' · ')
      : detail || `Error del servidor (HTTP ${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return result;
}

export async function refreshDB(token = sessionToken()) {
  const snapshot = await api('/app/snapshot', { token });
  cache = {
    users: snapshot.users || [],
    patients: snapshot.patients || [],
    requests: snapshot.requests || [],
    resets: {},
  };
  emit();
  return cache;
}

async function refreshAfter(path, options) {
  const result = await api(path, options);
  await refreshDB();
  return result;
}

/* ---------- Sesión por pestaña ---------- */
export const loadSession = () => {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
};

export const saveSession = (session) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
export const clearSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  cache = emptyDB();
  emit();
};

/* ---------- Utilidades compartidas ---------- */
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
export const todayKey = () => new Date().toLocaleDateString('en-CA');
export const doseKey = (medId, time) => `${todayKey()}|${medId}|${time}`;
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() || '').join('') || '?';
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/* ---------- Acceso ---------- */
export async function registerCaregiver({ name, email, password }) {
  const result = await api('/app/auth/registro', {
    method: 'POST',
    token: '',
    body: { nombre: name.trim(), email: email.trim().toLowerCase(), password, paciente_ejemplo: true },
  });
  return { id: result.id, token: result.token };
}

export async function loginCaregiver({ email, password }) {
  const result = await api('/app/auth/login', {
    method: 'POST',
    token: '',
    body: { email: email.trim().toLowerCase(), password },
  });
  return { id: result.id, token: result.token };
}

export async function requestReset(email) {
  const result = await api('/app/auth/recuperar', {
    method: 'POST',
    token: '',
    body: { email: email.trim().toLowerCase() },
  });
  return result.codigo || '';
}

export async function confirmReset({ email, code, password }) {
  await api('/app/auth/restablecer', {
    method: 'POST',
    token: '',
    body: { email: email.trim().toLowerCase(), codigo: code.trim(), password },
  });
}

/* ---------- Pacientes y datos del cuidador ---------- */
export async function addPatient(_caregiverId, data) {
  const result = await api('/app/pacientes', { method: 'POST', body: data });
  await refreshDB();
  return result.id;
}

export const updatePatient = (id, patch) => refreshAfter(`/app/pacientes/${encodeURIComponent(id)}`, {
  method: 'PUT',
  body: patch,
});

export async function addCondition(patientId, name) {
  const patient = cache.patients.find((item) => item.id === patientId);
  if (!patient) throw new Error('No encontramos al paciente.');
  const condition = name.trim();
  if (!condition) throw new Error('Ingresá un diagnóstico o enfermedad.');
  if (patient.conditions.some((item) => item.toLocaleLowerCase() === condition.toLocaleLowerCase())) {
    throw new Error('Ese diagnóstico ya está registrado.');
  }
  await updatePatient(patientId, { conditions: [...patient.conditions, condition] });
}

export async function removeCondition(patientId, condition) {
  const patient = cache.patients.find((item) => item.id === patientId);
  if (!patient) throw new Error('No encontramos al paciente.');
  await updatePatient(patientId, { conditions: patient.conditions.filter((item) => item !== condition) });
}

export const removePatient = (id) => refreshAfter(`/app/pacientes/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const regenCode = (id) => refreshAfter(`/app/pacientes/${encodeURIComponent(id)}/regenerar-codigo`, { method: 'POST' });

export const addMedicine = (patientId, medicine) => refreshAfter(
  `/app/pacientes/${encodeURIComponent(patientId)}/medicamentos`,
  { method: 'POST', body: { id: uid(), ...medicine } },
);

export const removeMedicine = (patientId, medicineId) => refreshAfter(
  `/app/pacientes/${encodeURIComponent(patientId)}/medicamentos/${encodeURIComponent(medicineId)}`,
  { method: 'DELETE' },
);

export const addContact = (patientId, contact) => refreshAfter(
  `/app/pacientes/${encodeURIComponent(patientId)}/contactos`,
  { method: 'POST', body: { id: uid(), ...contact } },
);

export const removeContact = (patientId, contactId) => refreshAfter(
  `/app/pacientes/${encodeURIComponent(patientId)}/contactos/${encodeURIComponent(contactId)}`,
  { method: 'DELETE' },
);

/* ---------- Tomas y alarmas ---------- */
export const setDose = (patientId, key, taken) => refreshAfter(
  `/app/pacientes/${encodeURIComponent(patientId)}/tomas`,
  { method: 'PUT', body: { clave: key, tomada: taken } },
);

export const triggerTest = (patientId) => refreshAfter(
  `/app/pacientes/${encodeURIComponent(patientId)}/pruebas`,
  { method: 'POST', body: { id: uid(), ts: Date.now() } },
);

export const finishTest = (patientId, testId) => refreshAfter(
  `/app/pacientes/${encodeURIComponent(patientId)}/pruebas/${encodeURIComponent(testId)}`,
  { method: 'PUT' },
);

/* ---------- Solicitudes de acceso por código ---------- */
export async function requestLink({ code, name }) {
  const result = await api('/app/solicitudes', {
    method: 'POST',
    token: '',
    body: { codigo: code.trim(), nombre: name.trim() || 'Dispositivo' },
  });
  return { id: result.id, token: result.token };
}

export const respondRequest = (id, accept) => refreshAfter(
  `/app/solicitudes/${encodeURIComponent(id)}/respuesta`,
  { method: 'POST', body: { aceptar: accept } },
);

export async function unlinkRequest(id) {
  const session = loadSession();
  await api(`/app/solicitudes/${encodeURIComponent(id)}`, { method: 'DELETE' });
  if (session?.role !== 'patient') await refreshDB();
}
