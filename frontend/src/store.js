import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------
   Capa de datos de InGuard (prototipo).
   - Todo se guarda en localStorage y se sincroniza en vivo entre pestañas
     del mismo navegador (evento "storage").
   - Todas las funciones de abajo son el "contrato" con el backend: para
     conectar un servidor real (Firebase, Supabase, Node + WebSocket)
     alcanza con reemplazar la implementación de este archivo.
------------------------------------------------------------------- */

const KEY = 'inguard_db_v1';
const SESSION_KEY = 'inguard_session_v1';

const emptyDB = () => ({ users: [], patients: [], requests: [], resets: {} });
let raw = null;
let cache = emptyDB();
const listeners = new Set();

function read() {
  const r = localStorage.getItem(KEY);
  if (r !== raw) {
    raw = r;
    try { cache = r ? JSON.parse(r) : emptyDB(); } catch { cache = emptyDB(); }
  }
  return cache;
}
const emit = () => listeners.forEach((l) => l());
const subscribe = (cb) => { listeners.add(cb); return () => listeners.delete(cb); };
window.addEventListener('storage', (e) => { if (e.key === KEY) emit(); });

export const useDB = () => useSyncExternalStore(subscribe, read);

export function mutate(fn) {
  const db = structuredClone(read());
  const result = fn(db); // si lanza un error, no se guarda nada
  raw = JSON.stringify(db);
  cache = db;
  localStorage.setItem(KEY, raw);
  emit();
  return result;
}

/* ---------- Sesión (por pestaña, así podés abrir cuidador y paciente a la vez) ---------- */
export const loadSession = () => {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
};
export const saveSession = (s) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
export const clearSession = () => sessionStorage.removeItem(SESSION_KEY);

/* ---------- Utilidades ---------- */
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
export const todayKey = () => new Date().toLocaleDateString('en-CA'); // AAAA-MM-DD
export const doseKey = (medId, time) => `${todayKey()}|${medId}|${time}`;
export const initials = (name = '') => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('') || '?';
const todayLabel = () => new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
const COLORS = ['blue', 'violet', 'orange'];
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

async function hash(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('inguard:' + s));
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('');
}

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const normCode = (c = '') => c.toUpperCase().replace(/[^A-Z0-9]/g, '');
function genCode(db) {
  let code;
  do {
    const r = Array.from({ length: 6 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');
    code = `${r.slice(0, 3)}-${r.slice(3)}`;
  } while (db.patients.some((p) => p.code === code));
  return code;
}

function makePatient(db, caregiverId, data = {}) {
  return {
    id: uid(), caregiverId, code: genCode(db),
    name: '', age: '', dni: '', blood: '', height: '', weight: '',
    allergies: [], conditions: [], contacts: [], medicines: [],
    doses: {}, tests: [], updated: todayLabel(),
    ...data,
  };
}

const samplePatient = () => ({
  name: 'Elena Martínez', age: 74, dni: '18.452.763', blood: 'O+', height: '1,62 m', weight: '67 kg',
  allergies: ['Penicilina'], conditions: ['Hipertensión arterial', 'Diabetes tipo 2'],
  contacts: [
    { id: uid(), name: 'María Martínez', relation: 'Hija · Contacto principal', phone: '+54 261 555-0142' },
    { id: uid(), name: 'Dr. Pablo Gómez', relation: 'Médico de cabecera', phone: '+54 261 555-0188' },
  ],
  medicines: [
    { id: uid(), name: 'Losartán', dose: '50 mg', frequency: 'Cada 24 horas', times: ['08:00'], color: 'blue' },
    { id: uid(), name: 'Metformina', dose: '850 mg', frequency: 'Cada 12 horas', times: ['08:00', '20:00'], color: 'violet' },
    { id: uid(), name: 'Aspirina', dose: '100 mg', frequency: 'Una vez al día', times: ['13:00'], color: 'orange' },
  ],
});

/* ---------- Cuenta del cuidador ---------- */
export async function registerCaregiver({ name, email, password }) {
  const em = email.trim().toLowerCase();
  const passHash = await hash(password);
  return mutate((db) => {
    if (db.users.some((u) => u.email === em)) throw new Error('Ya existe una cuenta con ese correo.');
    const user = { id: uid(), role: 'caregiver', name: name.trim(), email: em, passHash };
    db.users.push(user);
    db.patients.push(makePatient(db, user.id, samplePatient())); // paciente de ejemplo (se puede eliminar)
    return { id: user.id };
  });
}

export async function loginCaregiver({ email, password }) {
  const em = email.trim().toLowerCase();
  const passHash = await hash(password);
  const user = read().users.find((u) => u.email === em && u.passHash === passHash);
  if (!user) throw new Error('Correo o contraseña incorrectos.');
  return { id: user.id };
}

/* Recuperar contraseña: sin servidor de correo, el código se muestra en pantalla (demo). */
export function requestReset(email) {
  const em = email.trim().toLowerCase();
  return mutate((db) => {
    if (!db.users.some((u) => u.email === em)) throw new Error('No encontramos una cuenta con ese correo.');
    const code = String(Math.floor(100000 + Math.random() * 900000));
    db.resets[em] = { code, exp: Date.now() + 10 * 60000 };
    return code;
  });
}

export async function confirmReset({ email, code, password }) {
  const em = email.trim().toLowerCase();
  const passHash = await hash(password);
  return mutate((db) => {
    const r = db.resets[em];
    if (!r || r.code !== code.trim()) throw new Error('El código no es correcto.');
    if (Date.now() > r.exp) throw new Error('El código venció. Pedí uno nuevo.');
    const user = db.users.find((u) => u.email === em);
    if (!user) throw new Error('Cuenta inexistente.');
    user.passHash = passHash;
    delete db.resets[em];
  });
}

/* ---------- Pacientes (solo cuidador) ---------- */
export const addPatient = (caregiverId, data) => mutate((db) => {
  const p = makePatient(db, caregiverId, data);
  db.patients.push(p);
  return p.id;
});

export const updatePatient = (id, patch) => mutate((db) => {
  const p = db.patients.find((x) => x.id === id);
  if (p) Object.assign(p, patch, { updated: todayLabel() });
});

export const addCondition = (patientId, name) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) throw new Error('No encontramos al paciente.');
  const condition = name.trim();
  if (!condition) throw new Error('Ingresá un diagnóstico o enfermedad.');
  if (p.conditions.some((x) => x.toLocaleLowerCase() === condition.toLocaleLowerCase())) {
    throw new Error('Ese diagnóstico ya está registrado.');
  }
  p.conditions.push(condition);
  p.updated = todayLabel();
});

export const removeCondition = (patientId, condition) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) throw new Error('No encontramos al paciente.');
  p.conditions = p.conditions.filter((x) => x !== condition);
  p.updated = todayLabel();
});

export const removePatient = (id) => mutate((db) => {
  db.patients = db.patients.filter((p) => p.id !== id);
  db.requests = db.requests.filter((r) => r.patientId !== id);
});

export const regenCode = (id) => mutate((db) => {
  const p = db.patients.find((x) => x.id === id);
  if (p) p.code = genCode(db);
});

export const addMedicine = (patientId, med) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) return;
  p.medicines.push({ id: uid(), color: COLORS[p.medicines.length % COLORS.length], ...med });
  p.updated = todayLabel();
});

export const removeMedicine = (patientId, medId) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) return;
  p.medicines = p.medicines.filter((m) => m.id !== medId);
  p.updated = todayLabel();
});

export const addContact = (patientId, contact) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) return;
  p.contacts.push({ id: uid(), ...contact });
  p.updated = todayLabel();
});

export const removeContact = (patientId, contactId) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) return;
  p.contacts = p.contacts.filter((c) => c.id !== contactId);
  p.updated = todayLabel();
});

/* ---------- Tomas (paciente y cuidador) ---------- */
export const setDose = (patientId, key, taken) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) return;
  if (taken) p.doses[key] = new Date().toISOString(); else delete p.doses[key];
});

/* Alarma de prueba: suena en todos los dispositivos conectados al paciente. */
export const triggerTest = (patientId) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  if (!p) return;
  p.tests = [...(p.tests || []).slice(-4), { id: uid(), ts: Date.now(), done: false }];
});
export const finishTest = (patientId, testId) => mutate((db) => {
  const p = db.patients.find((x) => x.id === patientId);
  const t = p?.tests?.find((x) => x.id === testId);
  if (t) t.done = true;
});

/* ---------- Vinculación del paciente por código ---------- */
export function requestLink({ code, name }) {
  const wanted = normCode(code);
  return mutate((db) => {
    const p = db.patients.find((x) => normCode(x.code) === wanted);
    if (!wanted || !p) throw new Error('Ese código no existe. Revisalo con tu cuidador.');
    const req = { id: uid(), patientId: p.id, deviceName: name.trim() || 'Dispositivo', status: 'pending', createdAt: Date.now() };
    db.requests.push(req);
    return req.id;
  });
}

export const respondRequest = (id, accept) => mutate((db) => {
  const r = db.requests.find((x) => x.id === id);
  if (r) r.status = accept ? 'accepted' : 'rejected';
});

export const unlinkRequest = (id) => mutate((db) => {
  db.requests = db.requests.filter((r) => r.id !== id);
});
