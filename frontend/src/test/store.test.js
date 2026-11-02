import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  clearSession,
  doseKey,
  initials,
  loadSession,
  loginCaregiver,
  refreshDB,
  registerCaregiver,
  requestLink,
  requestReset,
  saveSession,
  TIME_RE,
  todayKey,
  useDB,
} from '../store.js';

const jsonResponse = (body, { ok = true, status = 200 } = {}) => ({
  ok,
  status,
  text: async () => (body === undefined ? '' : JSON.stringify(body)),
});

describe('utilidades de store', () => {
  it('genera iniciales a partir del nombre', () => {
    expect(initials('María Martínez')).toBe('MM');
    expect(initials('ana')).toBe('A');
    expect(initials('  Juan   Pérez  ')).toBe('JP');
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });

  it('valida horarios en formato HH:MM de 24 horas', () => {
    expect(TIME_RE.test('00:00')).toBe(true);
    expect(TIME_RE.test('08:30')).toBe(true);
    expect(TIME_RE.test('23:59')).toBe(true);
    expect(TIME_RE.test('24:00')).toBe(false);
    expect(TIME_RE.test('9:30')).toBe(false);
    expect(TIME_RE.test('12:60')).toBe(false);
    expect(TIME_RE.test('mediodía')).toBe(false);
  });

  it('arma la clave diaria de una toma', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(doseKey('med-1', '08:00')).toBe(`${todayKey()}|med-1|08:00`);
  });
});

describe('sesión por pestaña', () => {
  beforeEach(() => clearSession());

  it('guarda, lee y borra la sesión', () => {
    saveSession({ role: 'caregiver', userId: 'u1', token: 'tok' });
    expect(loadSession()).toEqual({ role: 'caregiver', userId: 'u1', token: 'tok' });

    clearSession();
    expect(loadSession()).toBeNull();
  });

  it('devuelve null si el contenido guardado no es JSON válido', () => {
    sessionStorage.setItem('inguard_session_v1', 'no-es-json');
    expect(loadSession()).toBeNull();
  });
});

describe('cliente API', () => {
  beforeEach(() => clearSession());

  it('refreshDB carga el snapshot y lo expone mediante useDB', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      users: [{ id: 'u1', name: 'Ana' }],
      patients: [{ id: 'p1', name: 'Elena' }],
      requests: [{ id: 'r1' }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await refreshDB('tok-123');

    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:5000/app/snapshot',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer tok-123' }),
      }),
    );

    const { result } = renderHook(() => useDB());
    expect(result.current.users).toHaveLength(1);
    expect(result.current.patients).toHaveLength(1);
    expect(result.current.requests).toHaveLength(1);
  });

  it('registerCaregiver normaliza el correo y devuelve id y token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u1', token: 'tok' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await registerCaregiver({ name: ' Ana ', email: ' ANA@MAIL.COM ', password: 'secreto' });

    expect(result).toEqual({ id: 'u1', token: 'tok' });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toMatchObject({
      nombre: 'Ana',
      email: 'ana@mail.com',
      password: 'secreto',
      paciente_ejemplo: true,
    });
  });

  it('loginCaregiver normaliza el correo', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'u1', token: 'tok' }));
    vi.stubGlobal('fetch', fetchMock);

    await loginCaregiver({ email: ' ANA@MAIL.COM ', password: 'secreto' });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ email: 'ana@mail.com', password: 'secreto' });
  });

  it('requestReset devuelve el código de recuperación', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ codigo: '123456' })));

    await expect(requestReset(' ANA@MAIL.COM ')).resolves.toBe('123456');
  });

  it('requestLink usa "Dispositivo" cuando no se envía nombre', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'r1', token: 'tok' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestLink({ code: ' ABC-123 ', name: '' })).resolves.toEqual({ id: 'r1', token: 'tok' });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toEqual({ codigo: 'ABC-123', nombre: 'Dispositivo' });
  });

  it('traduce los errores de validación del backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(
      { detail: [{ campo: 'email', mensaje: 'Correo inválido' }] },
      { ok: false, status: 422 },
    )));

    await expect(loginCaregiver({ email: 'x@y.com', password: '123456' }))
      .rejects.toMatchObject({ message: 'email: Correo inválido', status: 422 });
  });

  it('informa cuando no puede conectarse con el backend', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(refreshDB('tok')).rejects.toThrow(/No se pudo conectar con el backend/);
  });

  it('rechaza respuestas con JSON inválido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html>no json</html>',
    }));

    await expect(refreshDB('tok')).rejects.toThrow(/formato inválido/);
  });
});
