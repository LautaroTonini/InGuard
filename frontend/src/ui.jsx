import React, { useState } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import logo from './assets/logo.png';

export function Logo() {
  return <div className="brand">
    <img className="brand-mark" src={logo} alt="InGuard"/>
    <div><span className="brand-name">InGuard</span><span className="brand-tag">CUIDADO CONECTADO</span></div>
  </div>;
}

export function Switch({ checked, onChange, label }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label}
    className={`switch ${checked ? 'on' : ''}`} onClick={() => onChange(!checked)}><span/></button>;
}

export function Field({ label, icon: Icon, full, ...props }) {
  return <label className={`field ${full ? 'full' : ''}`}>
    <span>{label}</span>
    <div className="field-box">{Icon && <Icon size={16}/>}<input {...props}/></div>
  </label>;
}

export function PasswordField({ label, ...props }) {
  const [show, setShow] = useState(false);
  return <label className="field">
    <span>{label}</span>
    <div className="field-box">
      <input {...props} type={show ? 'text' : 'password'}/>
      <button type="button" className="eye" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
        {show ? <EyeOff size={16}/> : <Eye size={16}/>}
      </button>
    </div>
  </label>;
}

/* Modal con formulario genérico. fields: [{name,label,placeholder,required,full,type}] */
export function FormModal({ title, subtitle, fields, initial = {}, submitLabel = 'Guardar', onSubmit, onClose }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? ''])));
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    try { onSubmit(values); onClose(); } catch (err) { setError(err.message); }
  };
  return <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head">
        <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
        <button type="button" className="mobile-close always" onClick={onClose} aria-label="Cerrar"><X size={20}/></button>
      </div>
      <div className="form-grid">
        {fields.map((f) => <Field key={f.name} label={f.label} full={f.full} type={f.type || 'text'} required={f.required}
          placeholder={f.placeholder} value={values[f.name]} onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}/>)}
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
        <button type="submit" className="primary-button">{submitLabel}</button>
      </div>
    </form>
  </div>;
}
