import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthScreen from '../Auth.jsx';
import {
  confirmReset,
  loginCaregiver,
  registerCaregiver,
  requestLink,
  requestReset,
} from '../store.js';

vi.mock('../store.js', () => ({
  loginCaregiver: vi.fn(),
  registerCaregiver: vi.fn(),
  requestReset: vi.fn(),
  confirmReset: vi.fn(),
  requestLink: vi.fn(),
}));

vi.mock('../alarm.js', () => ({ unlockAudio: vi.fn() }));

const setup = () => {
  const onSession = vi.fn();
  render(<AuthScreen onSession={onSession} />);
  return { user: userEvent.setup(), onSession };
};

describe('AuthScreen', () => {
  beforeEach(() => {
    loginCaregiver.mockResolvedValue({ id: 'u1', token: 'tok' });
    registerCaregiver.mockResolvedValue({ id: 'u2', token: 'tok2' });
    requestReset.mockResolvedValue('123456');
    confirmReset.mockResolvedValue(undefined);
    requestLink.mockResolvedValue({ id: 'r1', token: 'tok3' });
  });

  it('permite iniciar sesión como cuidador', async () => {
    const { user, onSession } = setup();

    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'secreto');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(onSession).toHaveBeenCalledWith({ role: 'caregiver', userId: 'u1', token: 'tok' }));
    expect(loginCaregiver).toHaveBeenCalledWith(expect.objectContaining({ email: 'ana@mail.com' }));
  });

  it('muestra el error del backend al fallar el login', async () => {
    loginCaregiver.mockRejectedValueOnce(new Error('Credenciales inválidas'));
    const { user, onSession } = setup();

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
    expect(onSession).not.toHaveBeenCalled();
  });

  it('valida que las contraseñas coincidan al registrarse', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Registrate' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana Cuidadora');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'secreto1');
    await user.type(screen.getByLabelText('Repetir contraseña'), 'secreto2');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
    expect(registerCaregiver).not.toHaveBeenCalled();
  });

  it('exige una contraseña de al menos seis caracteres', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Registrate' }));
    await user.type(screen.getByLabelText('Nombre completo'), 'Ana');
    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@mail.com');
    await user.type(screen.getByLabelText('Nueva contraseña'), '123');
    await user.type(screen.getByLabelText('Repetir contraseña'), '123');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('La contraseña debe tener al menos 6 caracteres.')).toBeInTheDocument();
    expect(registerCaregiver).not.toHaveBeenCalled();
  });

  it('recorre la recuperación de contraseña en dos pasos', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: /Olvidaste tu contraseña/ }));
    expect(screen.getByRole('heading', { name: 'Recuperar contraseña' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Correo electrónico'), 'ana@mail.com');
    await user.click(screen.getByRole('button', { name: 'Enviar código' }));

    expect(await screen.findByText('123456')).toBeInTheDocument();
    expect(requestReset).toHaveBeenCalledWith('ana@mail.com');

    await user.type(screen.getByLabelText('Código de 6 dígitos'), '123456');
    await user.type(screen.getByLabelText('Nueva contraseña'), 'nueva123');
    await user.type(screen.getByLabelText('Repetir contraseña'), 'nueva123');
    await user.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    expect(await screen.findByText('Contraseña actualizada. Ya podés iniciar sesión.')).toBeInTheDocument();
    expect(confirmReset).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ana@mail.com',
      code: '123456',
      password: 'nueva123',
    }));
  });

  it('permite ingresar como paciente con el código en mayúsculas', async () => {
    const { user, onSession } = setup();

    await user.click(screen.getByRole('tab', { name: 'Soy paciente' }));
    expect(screen.getByRole('heading', { name: 'Ingresar con código' })).toBeInTheDocument();

    const codeInput = screen.getByLabelText('Código de acceso');
    await user.type(codeInput, 'abc-123');
    expect(codeInput).toHaveValue('ABC-123');

    await user.click(screen.getByRole('button', { name: 'Solicitar acceso' }));

    await waitFor(() => expect(onSession).toHaveBeenCalledWith({ role: 'patient', requestId: 'r1', token: 'tok3' }));
    expect(requestLink).toHaveBeenCalledWith({ code: 'ABC-123', name: '' });
  });
});
