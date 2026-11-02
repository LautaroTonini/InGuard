import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workspace from '../Workspace.jsx';
import { doseKey, respondRequest, setDose, triggerTest } from '../store.js';

vi.mock('../store.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    setDose: vi.fn(),
    triggerTest: vi.fn(),
    finishTest: vi.fn(),
    respondRequest: vi.fn(),
  };
});

vi.mock('../alarm.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, ring: vi.fn(), unlockAudio: vi.fn() };
});

const user = { id: 'c1', name: 'Ana Cuidadora', email: 'ana@mail.com' };

const basePatient = {
  id: 'p1',
  caregiverId: 'c1',
  name: 'Elena Pérez',
  age: 72,
  dni: '12345678',
  blood: 'O+',
  height: '1,60 m',
  weight: '60 kg',
  allergies: ['Penicilina'],
  conditions: ['Hipertensión', 'Diabetes'],
  medicines: [{
    id: 'm1',
    name: 'Enalapril',
    dose: '10 mg',
    frequency: 'Cada 12 horas',
    times: ['08:00', '20:00'],
    color: 'violet',
  }],
  contacts: [{ id: 'k1', name: 'María Pérez', relation: 'Hija', phone: '11 5555 1234' }],
  doses: {},
  tests: [],
  updated: 'hoy',
  code: 'ABC-123',
};

const caregiverDB = (overrides = {}) => ({
  users: [user],
  patients: [{ ...basePatient, ...overrides }],
  requests: [],
  resets: {},
});

const renderCaregiver = (db = caregiverDB()) => {
  const onLogout = vi.fn();
  const onRetry = vi.fn();
  render(<Workspace role="caregiver" db={db} user={user} onLogout={onLogout} syncError="" onRetry={onRetry} />);
  return { userEvent: userEvent.setup(), onLogout, onRetry };
};

describe('Workspace del cuidador', () => {
  beforeEach(() => {
    setDose.mockResolvedValue(undefined);
    triggerTest.mockResolvedValue(undefined);
    respondRequest.mockResolvedValue(undefined);
  });

  it('muestra las personas a cargo y permite aceptar una solicitud', async () => {
    const db = caregiverDB();
    db.requests = [{ id: 'r1', patientId: 'p1', deviceName: 'Celular de Elena', status: 'pending' }];
    const { userEvent: userSession } = renderCaregiver(db);

    expect(screen.getByRole('heading', { name: 'Personas a cargo' })).toBeInTheDocument();
    expect(screen.getAllByText('Elena Pérez').length).toBeGreaterThan(0);
    expect(screen.getByText('ABC-123')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solicitudes de acceso' })).toBeInTheDocument();

    await userSession.click(screen.getByRole('button', { name: /Aceptar/ }));

    await waitFor(() => expect(respondRequest).toHaveBeenCalledWith('r1', true));
  });

  it('muestra los datos importantes y abre el informe de salud', async () => {
    const { userEvent: userSession } = renderCaregiver();

    await userSession.click(screen.getByRole('button', { name: 'Datos importantes' }));

    expect(screen.getByRole('heading', { name: 'Datos importantes' })).toBeInTheDocument();
    expect(screen.getByText('Penicilina')).toBeInTheDocument();
    expect(screen.getByText('Hipertensión')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Llamar emergencias/ })).toHaveAttribute('href', 'tel:107');

    await userSession.click(screen.getByRole('button', { name: 'Generar informe' }));

    const dialog = screen.getByRole('dialog', { name: 'Informe de salud' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Elena Pérez')).toBeInTheDocument();

    await userSession.click(screen.getByRole('button', { name: 'Enviar a emergencias (demo)' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Modo demostración');
  });

  it('marca una toma como realizada', async () => {
    const { userEvent: userSession } = renderCaregiver();

    await userSession.click(screen.getByRole('button', { name: 'Datos importantes' }));
    await userSession.click(screen.getByRole('switch', { name: 'Tomé Enalapril de las 08:00' }));

    await waitFor(() => expect(setDose).toHaveBeenCalledWith('p1', doseKey('m1', '08:00'), true));
  });

  it('permite probar la alarma desde la sección de medicación', async () => {
    const { userEvent: userSession } = renderCaregiver();

    await userSession.click(screen.getByRole('button', { name: 'Medicación' }));

    expect(screen.getByRole('heading', { name: 'Tratamiento actual' })).toBeInTheDocument();
    await userSession.click(screen.getByRole('button', { name: 'Probar alarma' }));

    await waitFor(() => expect(triggerTest).toHaveBeenCalledWith('p1'));
  });

  it('muestra una advertencia de sincronización y permite reintentar', async () => {
    const onRetry = vi.fn();
    render(<Workspace role="caregiver" db={caregiverDB()} user={user} onLogout={vi.fn()} syncError="Sin conexión" onRetry={onRetry} />);

    expect(screen.getByRole('status')).toHaveTextContent('No se pudo sincronizar: Sin conexión');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe('Workspace del paciente', () => {
  const request = { id: 'r1', patientId: 'p1', deviceName: 'Celular de Elena', status: 'accepted' };

  beforeEach(() => {
    setDose.mockResolvedValue(undefined);
    triggerTest.mockResolvedValue(undefined);
  });

  it('es de solo lectura para medicamentos y permite marcar tomas', async () => {
    const userSession = userEvent.setup();
    render(<Workspace role="patient" db={caregiverDB()} request={request} onLogout={vi.fn()} syncError="" onRetry={vi.fn()} />);

    expect(screen.getByText('PANEL DEL PACIENTE')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mis pacientes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Editar$/ })).not.toBeInTheDocument();

    await userSession.click(screen.getByRole('switch', { name: 'Tomé Enalapril de las 08:00' }));
    await waitFor(() => expect(setDose).toHaveBeenCalledWith('p1', doseKey('m1', '08:00'), true));

    await userSession.click(screen.getByRole('button', { name: 'Medicación' }));
    expect(screen.getByRole('heading', { name: 'Tratamiento actual' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Probar alarma' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Agregar' })).not.toBeInTheDocument();
    expect(screen.getByText(/Solo tu cuidador puede cambiar los medicamentos/)).toBeInTheDocument();
  });
});
