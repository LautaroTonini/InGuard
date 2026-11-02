import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { beep, ring, unlockAudio, useAlarms } from '../alarm.js';
import { doseKey } from '../store.js';

const medicine = (times = ['10:00'], id = 'm1') => ({
  id,
  name: 'Enalapril',
  dose: '10 mg',
  frequency: 'Cada 12 horas',
  times,
  color: 'violet',
});

const patient = (overrides = {}) => ({
  id: 'p1',
  name: 'Elena',
  medicines: [medicine()],
  doses: {},
  tests: [],
  ...overrides,
});

describe('useAlarms', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 10, 30, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('activa una toma dentro de los 60 minutos posteriores al horario', () => {
    const { result } = renderHook(() => useAlarms([patient()]));

    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0]).toMatchObject({
      id: `p1|${doseKey('m1', '10:00')}`,
      time: '10:00',
      doseKey: doseKey('m1', '10:00'),
    });
    expect(result.current.active[0].med.name).toBe('Enalapril');
  });

  it('no activa tomas ya realizadas', () => {
    const p = patient({ doses: { [doseKey('m1', '10:00')]: true } });
    const { result } = renderHook(() => useAlarms([p]));

    expect(result.current.active).toHaveLength(0);
  });

  it('no activa tomas fuera de la ventana de 60 minutos', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 11, 1, 0));
    const { result } = renderHook(() => useAlarms([patient()]));

    expect(result.current.active).toHaveLength(0);
  });

  it('no activa tomas cuya hora todavía no llegó', () => {
    vi.setSystemTime(new Date(2026, 0, 15, 9, 30, 0));
    const { result } = renderHook(() => useAlarms([patient()]));

    expect(result.current.active).toHaveLength(0);
  });

  it('ignora horarios con formato inválido', () => {
    const { result } = renderHook(() => useAlarms([patient({ medicines: [medicine(['99:99'])] })]));

    expect(result.current.active).toHaveLength(0);
  });

  it('silencia una alarma durante cinco minutos', () => {
    const { result } = renderHook(() => useAlarms([patient()]));

    const id = result.current.active[0].id;
    act(() => result.current.silence(id));

    expect(result.current.active).toHaveLength(0);
  });

  it('activa las alarmas de prueba recientes y pendientes', () => {
    const p = patient({
      medicines: [],
      tests: [
        { id: 't1', ts: Date.now() - 10_000, done: false },
        { id: 't2', ts: Date.now() - 10_000, done: true },
        { id: 't3', ts: Date.now() - 3 * 60_000, done: false },
      ],
    });
    const { result } = renderHook(() => useAlarms([p]));

    expect(result.current.active).toHaveLength(1);
    expect(result.current.active[0]).toMatchObject({ testId: 't1', time: 'ahora' });
    expect(result.current.active[0].med.name).toBe('Alarma de prueba');
  });
});

describe('sonido de alarmas', () => {
  it('no falla cuando el navegador no tiene audio disponible', () => {
    expect(() => unlockAudio()).not.toThrow();
    expect(() => beep()).not.toThrow();
    expect(() => ring()).not.toThrow();
  });
});
