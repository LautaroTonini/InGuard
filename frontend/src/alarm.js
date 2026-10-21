import { useEffect, useState } from 'react';
import { doseKey, TIME_RE } from './store.js';

/* ---------- Sonido (Web Audio) ---------- */
let ctx = null;

export function unlockAudio() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
  } catch { /* sin audio disponible */ }
}

export function beep(freq = 880) {
  if (!ctx || ctx.state !== 'running') return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.4);
}

export function ring() {
  beep(880);
  setTimeout(() => beep(1175), 260);
  if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
}

/* ---------- Alarmas activas ----------
   Una toma suena desde su horario hasta 60 min después, mientras nadie la
   marque como tomada. Como el estado de "tomada" se sincroniza, en cuanto el
   paciente la marca deja de sonar también en el dispositivo del cuidador. */
export function useAlarms(patients) {
  const [now, setNow] = useState(Date.now());
  const [silenced, setSilenced] = useState({});

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const active = [];
  for (const p of patients) {
    for (const m of p.medicines) {
      for (const time of m.times) {
        if (!TIME_RE.test(time)) continue;
        const key = doseKey(m.id, time);
        if (p.doses[key]) continue;
        const [h, mi] = time.split(':').map(Number);
        const due = new Date();
        due.setHours(h, mi, 0, 0);
        const diff = now - due.getTime();
        const id = `${p.id}|${key}`;
        if (diff >= 0 && diff < 60 * 60000 && (silenced[id] || 0) <= now) {
          active.push({ id, patient: p, med: m, time, doseKey: key });
        }
      }
    }
    for (const te of p.tests || []) {
      const id = `${p.id}|test|${te.id}`;
      if (!te.done && now - te.ts < 120000 && (silenced[id] || 0) <= now) {
        active.push({ id, patient: p, med: { name: 'Alarma de prueba', dose: '' }, time: 'ahora', testId: te.id });
      }
    }
  }

  const silence = (id, mins = 5) => setSilenced((s) => ({ ...s, [id]: Date.now() + mins * 60000 }));
  return { active, silence };
}
