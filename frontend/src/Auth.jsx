import React, { useState } from 'react';
import { ArrowLeft, Check, HeartHandshake, KeyRound, Mail, UserRound, Smartphone } from 'lucide-react';
import { Logo, Field, PasswordField } from './ui.jsx';
import { unlockAudio } from './alarm.js';
import { confirmReset, loginCaregiver, registerCaregiver, requestLink, requestReset } from './store.js';

function CaregiverAccess({ onSession }) {
  const [mode, setMode] = useState('login'); // login | register | recover
  const [step, setStep] = useState(1);       // recover: 1 = correo, 2 = código + nueva clave
  const [f, setF] = useState({ name: '', email: '', password: '', confirm: '', code: '' });
  const [demoCode, setDemoCode] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const go = (m) => { setMode(m); setStep(1); setError(''); setOk(''); setDemoCode(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setOk(''); setBusy(true);
    unlockAudio();
    try {
      if (mode === 'login') {
        const u = await loginCaregiver(f);
        onSession({ role: 'caregiver', userId: u.id, token: u.token });
      } else if (mode === 'register') {
        if (f.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
        if (f.password !== f.confirm) throw new Error('Las contraseñas no coinciden.');
        const u = await registerCaregiver(f);
        onSession({ role: 'caregiver', userId: u.id, token: u.token });
      } else if (step === 1) {
        setDemoCode(requestReset(f.email));
        setStep(2);
      } else {
        if (f.password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
        if (f.password !== f.confirm) throw new Error('Las contraseñas no coinciden.');
        await confirmReset(f);
        go('login');
        setOk('Contraseña actualizada. Ya podés iniciar sesión.');
        setF({ ...f, password: '', confirm: '', code: '' });
      }
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  const titles = {
    login: ['Iniciar sesión', 'Gestioná el cuidado de tus pacientes desde un solo lugar.'],
    register: ['Crear cuenta de cuidador', 'Registrate para vincular y acompañar a tus pacientes.'],
    recover: ['Recuperar contraseña', step === 1 ? 'Ingresá tu correo y te damos un código para restablecerla.' : 'Ingresá el código y elegí tu nueva contraseña.'],
  }[mode];

  return <form onSubmit={submit} className="auth-form">
    {mode === 'recover' && <button type="button" className="back-link" onClick={() => go('login')}><ArrowLeft size={14}/> Volver al inicio de sesión</button>}
    <h1>{titles[0]}</h1>
    <p className="auth-sub">{titles[1]}</p>

    {ok && <div className="form-ok"><Check size={15}/> {ok}</div>}

    {mode === 'register' && <Field label="Nombre completo" icon={UserRound} required value={f.name} onChange={set('name')} placeholder="Ej: María Martínez" autoComplete="name"/>}
    {(mode !== 'recover' || step === 1) && <Field label="Correo electrónico" icon={Mail} type="email" required value={f.email} onChange={set('email')} placeholder="tucorreo@ejemplo.com" autoComplete="email"/>}

    {mode === 'recover' && step === 2 && <>
      <div className="demo-code"><KeyRound size={16}/><div><small>Código de recuperación (demo, no hay servidor de correo)</small><strong>{demoCode}</strong></div></div>
      <Field label="Código de 6 dígitos" icon={KeyRound} required value={f.code} onChange={set('code')} placeholder="123456" inputMode="numeric" maxLength={6}/>
    </>}

    {(mode !== 'recover' || step === 2) && <PasswordField label={mode === 'login' ? 'Contraseña' : 'Nueva contraseña'} required value={f.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>}
    {(mode === 'register' || (mode === 'recover' && step === 2)) && <PasswordField label="Repetir contraseña" required value={f.confirm} onChange={set('confirm')} placeholder="Repetí la contraseña" autoComplete="new-password"/>}

    {mode === 'login' && <button type="button" className="text-link auth-forgot" onClick={() => go('recover')}>¿Olvidaste tu contraseña?</button>}
    {error && <div className="form-error">{error}</div>}

    <button type="submit" className="primary-button auth-submit" disabled={busy}>
      {busy ? 'Un momento…' : mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear cuenta' : step === 1 ? 'Enviar código' : 'Restablecer contraseña'}
    </button>

    {mode === 'login' && <p className="auth-switch">¿No tenés cuenta? <button type="button" onClick={() => go('register')}>Registrate</button></p>}
    {mode === 'register' && <p className="auth-switch">¿Ya tenés cuenta? <button type="button" onClick={() => go('login')}>Iniciá sesión</button></p>}
  </form>;
}

function PatientAccess({ onSession }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    unlockAudio();
    try {
      const request = await requestLink({ code, name });
      onSession({ role: 'patient', requestId: request.id, token: request.token });
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  return <form onSubmit={submit} className="auth-form">
    <h1>Ingresar con código</h1>
    <p className="auth-sub">Pedile a tu cuidador el código de tu perfil. Él tiene que aceptar tu ingreso para que puedas ver tu información.</p>
    <Field label="Código de acceso" icon={KeyRound} required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ABC-123" maxLength={7} className="code-input" autoComplete="off"/>
    <Field label="Nombre del dispositivo (opcional)" icon={Smartphone} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Celular de Elena"/>
    {error && <div className="form-error">{error}</div>}
    <button type="submit" className="primary-button auth-submit" disabled={busy}>{busy ? 'Enviando…' : 'Solicitar acceso'}</button>
  </form>;
}

export default function AuthScreen({ onSession }) {
  const [tab, setTab] = useState('caregiver');
  return <div className="auth-shell">
    <div className="auth-card">
      <Logo/>
      <div className="role-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'caregiver'} className={tab === 'caregiver' ? 'active' : ''} onClick={() => setTab('caregiver')}><HeartHandshake size={16}/> Soy cuidador</button>
        <button role="tab" aria-selected={tab === 'patient'} className={tab === 'patient' ? 'active' : ''} onClick={() => setTab('patient')}><UserRound size={16}/> Soy paciente</button>
      </div>
      {tab === 'caregiver' ? <CaregiverAccess onSession={onSession}/> : <PatientAccess onSession={onSession}/>}
    </div>
    <p className="auth-foot">© 2026 InGuard · Cuidar también es estar conectado.</p>
    <div className="demo-note">PROTOTIPO ACADÉMICO · DATOS FICTICIOS</div>
  </div>;
}
