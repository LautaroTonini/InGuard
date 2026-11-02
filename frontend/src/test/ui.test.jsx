import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormModal, Logo, PasswordField, Switch } from '../ui.jsx';

describe('Logo', () => {
  it('muestra la marca y el eslogan', () => {
    render(<Logo />);
    expect(screen.getByAltText('InGuard')).toBeInTheDocument();
    expect(screen.getByText('InGuard')).toBeInTheDocument();
    expect(screen.getByText('CUIDADO CONECTADO')).toBeInTheDocument();
  });
});

describe('Switch', () => {
  it('refleja el estado y avisa los cambios', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    const { rerender } = render(<Switch checked={false} onChange={onChange} label="Tomé la pastilla" />);

    const control = screen.getByRole('switch', { name: 'Tomé la pastilla' });
    expect(control).toHaveAttribute('aria-checked', 'false');

    await user.click(control);
    expect(onChange).toHaveBeenCalledWith(true);

    rerender(<Switch checked onChange={onChange} label="Tomé la pastilla" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });
});

describe('PasswordField', () => {
  it('alterna entre ocultar y mostrar la contraseña', async () => {
    const user = userEvent.setup();
    render(<PasswordField label="Contraseña" defaultValue="secreto" />);

    const input = screen.getByLabelText('Contraseña');
    expect(input).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(input).toHaveAttribute('type', 'text');

    await user.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(input).toHaveAttribute('type', 'password');
  });
});

describe('FormModal', () => {
  const fields = [
    { name: 'name', label: 'Nombre', required: true, full: true },
    { name: 'phone', label: 'Teléfono' },
  ];

  it('envía los valores del formulario y cierra al guardar', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(<FormModal title="Agregar contacto" fields={fields} onSubmit={onSubmit} onClose={onClose} />);

    await user.type(screen.getByLabelText('Nombre'), 'María');
    await user.type(screen.getByLabelText('Teléfono'), '123456');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSubmit).toHaveBeenCalledWith({ name: 'María', phone: '123456' });
    expect(onClose).toHaveBeenCalled();
  });

  it('precarga valores iniciales y muestra errores sin cerrar', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockRejectedValue(new Error('No se pudo guardar'));

    render(<FormModal
      title="Editar"
      fields={fields}
      initial={{ name: 'Elena' }}
      submitLabel="Actualizar"
      onSubmit={onSubmit}
      onClose={onClose}
    />);

    expect(screen.getByLabelText('Nombre')).toHaveValue('Elena');
    await user.click(screen.getByRole('button', { name: 'Actualizar' }));

    expect(await screen.findByText('No se pudo guardar')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cierra con el botón Cancelar y al hacer clic fuera del modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<FormModal title="Modal" fields={fields} onSubmit={vi.fn()} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(container.querySelector('.modal-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
