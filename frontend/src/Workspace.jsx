import React, { useEffect, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowUpRight, Bell, BellRing, CalendarDays, Check, ChevronDown,
  ClipboardList, Clock3, Copy, FileText, HeartPulse, Info, LogOut, Menu, Pencil, Phone, Pill,
  Plus, Printer, RefreshCw, Search, ShieldCheck, Smartphone, Trash2, UserRound, Users, UsersRound, X
} from 'lucide-react';
import { Logo, Switch, FormModal } from './ui.jsx';
import { ring, unlockAudio, useAlarms } from './alarm.js';
import {
  addCondition, addContact, addMedicine, addPatient, doseKey, finishTest, initials, regenCode,
  removeCondition, removeContact, removeMedicine, removePatient, respondRequest, setDose,
  triggerTest, unlinkRequest, updatePatient, TIME_RE
} from './store.js';

const list = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);
const phoneHref = (phone) => `tel:${String(phone || '').trim().replace(/[^\d+]/g, '')}`;

function HealthReport({ patient, doses, onClose }) {
  const [sendNotice, setSendNotice] = useState('');
  const generatedAt = new Intl.DateTimeFormat('es-AR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date());
  return <div className="modal-backdrop report-overlay" role="dialog" aria-modal="true" aria-labelledby="report-title">
    <section className="report-card">
      <div className="report-actions">
        <button className="secondary-button" onClick={onClose}><X size={15}/> Cerrar</button>
        <button className="primary-button" onClick={() => window.print()}><Printer size={15}/> Imprimir / Guardar PDF</button>
        <button className="secondary-button" onClick={() => setSendNotice('Modo demostración: no se enviaron datos. La integración con emergencias se conectará mediante el backend.')}>Enviar a emergencias (demo)</button>
      </div>
      {sendNotice && <p className="report-notice" role="status">{sendNotice}</p>}
      <article className="health-report">
        <header className="report-heading"><Logo/><span>Informe generado el {generatedAt}</span></header>
        <h1 id="report-title">Informe de salud</h1>
        <p className="report-subtitle">Resumen de la información registrada en InGuard. No reemplaza una historia clínica oficial.</p>

        <section className="report-section">
          <h2>Datos de la persona</h2>
          <div className="report-facts">
            <div><span>Nombre</span><strong>{patient.name || '—'}</strong></div>
            <div><span>Edad</span><strong>{patient.age ? `${patient.age} años` : '—'}</strong></div>
            <div><span>DNI</span><strong>{patient.dni || '—'}</strong></div>
            <div><span>Grupo sanguíneo</span><strong>{patient.blood || '—'}</strong></div>
            <div><span>Altura</span><strong>{patient.height || '—'}</strong></div>
            <div><span>Peso</span><strong>{patient.weight || '—'}</strong></div>
          </div>
        </section>

        <section className="report-section">
          <h2>Alergias</h2>
          <p>{patient.allergies.join(', ') || 'Sin alergias registradas.'}</p>
        </section>

        <section className="report-section">
          <h2>Diagnósticos y enfermedades</h2>
          {patient.conditions.length ? <ul>{patient.conditions.map((condition) => <li key={condition}>{condition}</li>)}</ul> : <p>Sin diagnósticos registrados.</p>}
        </section>

        <section className="report-section">
          <h2>Medicación actual</h2>
          {patient.medicines.length ? <ul>{patient.medicines.map((medicine) => <li key={medicine.id}>{medicine.name} — {medicine.dose}, {medicine.frequency}; horarios: {medicine.times.join(', ') || 'sin horario'}</li>)}</ul> : <p>Sin medicación registrada.</p>}
        </section>

        <section className="report-section">
          <h2>Tomas de hoy</h2>
          {doses.length ? <ul>{doses.map((dose) => <li key={dose.key}>{dose.time} — {dose.med.name}: {dose.taken ? 'tomada' : 'pendiente'}</li>)}</ul> : <p>No hay tomas programadas.</p>}
        </section>

        <section className="report-section">
          <h2>Contactos de emergencia</h2>
          {patient.contacts.length ? <ul>{patient.contacts.map((contact) => <li key={contact.id}>{contact.name} ({contact.relation}) — {contact.phone}</li>)}</ul> : <p>Sin contactos registrados.</p>}
        </section>
        <p className="report-disclaimer">Documento de demostración generado desde datos cargados por el usuario. Ante una emergencia, llamá al servicio local correspondiente.</p>
      </article>
    </section>
  </div>;
}

/* ---------- Overlay de alarma (suena en paciente y cuidador) ---------- */
function AlarmOverlay({ alarms, role, onSilence, onTake }) {
  const ringing = alarms.length > 0;
  useEffect(() => {
    if (!ringing) return undefined;
    ring();
    const t = setInterval(ring, 1700);
    return () => clearInterval(t);
  }, [ringing]);
  if (!ringing) return null;
  const a = alarms[0];
  const isPatient = role === 'patient';
  return <div className="modal-backdrop alarm-backdrop" role="alertdialog" aria-live="assertive">
    <div className="alarm-card">
      <div className="alarm-bell"><BellRing size={34}/></div>
      <span className="alarm-time">{a.time === 'ahora' ? 'Prueba' : `${a.time} hs`}</span>
      <h2>{isPatient ? 'Es hora de tu medicación' : `${a.patient.name} debe tomar su medicación`}</h2>
      <p className="alarm-med"><Pill size={18}/> {a.med.name} {a.med.dose && <span>{a.med.dose}</span>}</p>
      {alarms.length > 1 && <small className="alarm-more">Hay {alarms.length - 1} alarma{alarms.length > 2 ? 's' : ''} más pendiente{alarms.length > 2 ? 's' : ''}.</small>}
      <div className="alarm-actions">
        <button className="secondary-button" onClick={() => onSilence(a.id)}>{isPatient ? 'Recordarme en 5 min' : 'Silenciar 5 min'}</button>
        <button className="primary-button" onClick={() => onTake(a)}><Check size={16}/> {isPatient ? 'Ya la tomé' : 'Marcar como tomada'}</button>
      </div>
    </div>
  </div>;
}

/* ---------- Sección "Mis pacientes" (solo cuidador) ---------- */
function PatientsPanel({ patients, requests, selectedId, onSelect, onOpen, onAdd, toast, runAction }) {
  const pending = requests.filter((r) => r.status === 'pending');
  const copy = (code) => {
    navigator.clipboard?.writeText(code);
    toast(`Código ${code} copiado.`);
  };
  return <>
    {pending.length > 0 && <section className="detail-panel request-panel">
      <div className="panel-head"><div><h2>Solicitudes de acceso</h2><p>Pacientes que ingresaron un código y esperan tu aprobación.</p></div><span className="panel-count">{pending.length} pendiente{pending.length > 1 ? 's' : ''}</span></div>
      {pending.map((r) => {
        const p = patients.find((x) => x.id === r.patientId);
        return <div className="detail-row" key={r.id}>
          <div className="card-icon blue"><Smartphone size={18}/></div>
          <div className="detail-main"><strong>{r.deviceName}</strong><span>Quiere ver el perfil de {p?.name}</span></div>
          <button className="secondary-button" onClick={() => runAction(() => respondRequest(r.id, false), 'Solicitud rechazada.')}><X size={15}/> Rechazar</button>
          <button className="primary-button" onClick={() => runAction(() => respondRequest(r.id, true), `Acceso aceptado para ${r.deviceName}.`)}><Check size={15}/> Aceptar</button>
        </div>;
      })}
    </section>}

    <section className="detail-panel">
      <div className="panel-head"><div><h2>Personas a cargo</h2><p>Elegí a quién querés gestionar. Todo el panel se actualiza con el paciente seleccionado.</p></div><button className="primary-button" onClick={onAdd}><Plus size={16}/> Agregar paciente</button></div>
      {patients.length === 0 && <p className="empty-state">Todavía no tenés pacientes. Agregá el primero para generar su código de acceso.</p>}
      <div className="patients-grid">
        {patients.map((p) => {
          const devices = requests.filter((r) => r.patientId === p.id && r.status === 'accepted');
          const total = p.medicines.reduce((n, m) => n + m.times.length, 0);
          const taken = p.medicines.reduce((n, m) => n + m.times.filter((t) => p.doses[doseKey(m.id, t)]).length, 0);
          const selected = p.id === selectedId;
          return <article key={p.id} className={`patient-tile ${selected ? 'selected' : ''}`}>
            <div className="patient-tile-top">
              <div className="avatar contact-avatar large">{initials(p.name)}</div>
              <div className="patient-tile-name"><strong>{p.name}</strong><span>{p.age ? `${p.age} años` : 'Sin edad cargada'}</span></div>
              {selected && <span className="pill-status"><span/> Seleccionado</span>}
            </div>
            <div className="tile-stats">
              <div><small>Tomas de hoy</small><b>{taken}/{total}</b></div>
              <div><small>Dispositivos</small><b>{devices.length}</b></div>
            </div>
            <div className="code-box"><div><small>CÓDIGO DEL PACIENTE</small><strong>{p.code}</strong></div>
              <button className="call-small" onClick={() => copy(p.code)} aria-label="Copiar código"><Copy size={15}/></button>
              <button className="call-small" onClick={() => runAction(() => regenCode(p.id), 'Se generó un código nuevo.')} aria-label="Generar código nuevo"><RefreshCw size={15}/></button>
            </div>
            {devices.map((d) => <div className="device-row" key={d.id}><Smartphone size={15}/><span>{d.deviceName}</span><button onClick={() => runAction(() => unlinkRequest(d.id), 'Dispositivo desvinculado.')}>Desvincular</button></div>)}
            <div className="tile-actions">
              <button className="primary-button" onClick={() => { onSelect(p.id); onOpen(); }}>{selected ? 'Abrir panel' : 'Gestionar'} <ArrowUpRight size={14}/></button>
              <button className="secondary-button" onClick={() => { if (window.confirm(`¿Eliminar a ${p.name}? Se borran sus datos y vínculos.`)) runAction(() => removePatient(p.id), `${p.name} fue eliminado.`); }} aria-label={`Eliminar a ${p.name}`}><Trash2 size={15}/></button>
            </div>
          </article>;
        })}
      </div>
    </section>
  </>;
}

export default function Workspace({ role, db, user, request, onLogout, syncError, onRetry }) {
  const isCaregiver = role === 'caregiver';
  const myPatients = isCaregiver ? db.patients.filter((p) => p.caregiverId === user.id) : db.patients.filter((p) => p.id === request.patientId);
  const myRequests = db.requests.filter((r) => myPatients.some((p) => p.id === r.patientId));
  const pendingCount = isCaregiver ? myRequests.filter((r) => r.status === 'pending').length : 0;

  const [section, setSection] = useState(isCaregiver ? 'patients' : 'important');
  const [selectedId, setSelectedId] = useState(() => sessionStorage.getItem('inguard_selected') || '');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('inguard_font_size');
    return ['small', 'normal', 'large'].includes(saved) ? saved : 'normal';
  });

  const patient = myPatients.find((p) => p.id === selectedId) || myPatients[0];
  const select = (id) => { setSelectedId(id); sessionStorage.setItem('inguard_selected', id); };

  const toast = (msg) => { setNotice(msg); window.setTimeout(() => setNotice(''), 3000); };
  const runAction = async (action, successMessage) => {
    try {
      await action();
      if (successMessage) toast(successMessage);
    } catch (error) {
      toast(error.message || 'No se pudo completar la acción.');
    }
  };

  useEffect(() => {
    document.documentElement.dataset.fontSize = fontSize;
    localStorage.setItem('inguard_font_size', fontSize);
  }, [fontSize]);

  useEffect(() => {
    const f = () => unlockAudio();
    window.addEventListener('pointerdown', f);
    window.addEventListener('keydown', f);
    return () => { window.removeEventListener('pointerdown', f); window.removeEventListener('keydown', f); };
  }, []);

  const { active, silence } = useAlarms(myPatients);
  const takeFromAlarm = (a) => {
    runAction(
      () => a.testId ? finishTest(a.patient.id, a.testId) : setDose(a.patient.id, a.doseKey, true),
      'Acción registrada.',
    );
  };

  const nav = [
    ...(isCaregiver ? [{ id: 'patients', label: 'Mis pacientes', icon: UsersRound }] : []),
    { id: 'important', label: 'Datos importantes', icon: HeartPulse },
    { id: 'medication', label: 'Medicación', icon: Pill },
    { id: 'history', label: 'Historial médico', icon: ClipboardList },
    { id: 'contacts', label: 'Contactos de emergencia', icon: Users },
  ];
  const sectionLabel = nav.find((n) => n.id === section)?.label;
  const firstName = patient?.name.split(' ')[0] || '';

  const doses = patient ? patient.medicines.flatMap((m) => m.times.map((time) => ({ med: m, time, key: doseKey(m.id, time), taken: !!patient.doses[doseKey(m.id, time)] }))).sort((a, b) => a.time.localeCompare(b.time)) : [];
  const toggle = (d) => runAction(() => setDose(patient.id, d.key, !d.taken));
  const filteredConditions = patient ? patient.conditions.filter((x) => x.toLowerCase().includes(query.toLowerCase())) : [];

  const goTo = (id) => { setSection(id); setMobileMenu(false); };
  const needsPatient = section !== 'patients' && !patient;

  /* ---------- Formularios (solo cuidador) ---------- */
  const forms = {
    addPatient: { title: 'Agregar paciente', subtitle: 'Se genera un código para que pueda ingresar desde su dispositivo.', submitLabel: 'Crear paciente',
      fields: [{ name: 'name', label: 'Nombre completo', required: true, full: true }, { name: 'age', label: 'Edad', type: 'number' }, { name: 'dni', label: 'DNI' }, { name: 'blood', label: 'Grupo sanguíneo', placeholder: 'O+' }],
      onSubmit: async (v) => { const id = await addPatient(user.id, { name: v.name.trim(), age: v.age, dni: v.dni, blood: v.blood }); select(id); toast(`${v.name.trim()} fue agregado.`); } },
    editPatient: patient && { title: 'Editar datos del paciente', submitLabel: 'Guardar cambios',
      initial: { ...patient, allergies: patient.allergies.join(', '), conditions: patient.conditions.join(', ') },
      fields: [{ name: 'name', label: 'Nombre completo', required: true, full: true }, { name: 'age', label: 'Edad', type: 'number' }, { name: 'dni', label: 'DNI' }, { name: 'blood', label: 'Grupo sanguíneo' }, { name: 'height', label: 'Altura' }, { name: 'weight', label: 'Peso' },
        { name: 'allergies', label: 'Alergias (separadas por coma)', full: true }, { name: 'conditions', label: 'Enfermedades y diagnósticos (separados por coma)', full: true }],
      onSubmit: async (v) => { await updatePatient(patient.id, { name: v.name.trim(), age: v.age, dni: v.dni, blood: v.blood, height: v.height, weight: v.weight, allergies: list(v.allergies), conditions: list(v.conditions) }); toast('Datos actualizados.'); } },
    addCondition: patient && { title: 'Agregar diagnóstico o enfermedad', subtitle: `Se agregará al historial de ${patient.name}.`, submitLabel: 'Agregar al historial',
      fields: [{ name: 'condition', label: 'Diagnóstico o enfermedad', required: true, full: true, placeholder: 'Ej. Hipertensión arterial' }],
      onSubmit: async (v) => { await addCondition(patient.id, v.condition); toast('Diagnóstico agregado al historial.'); } },
    addMed: patient && { title: 'Agregar medicamento', subtitle: `Para ${patient.name}. La alarma va a sonar en todos los dispositivos conectados.`, submitLabel: 'Agregar',
      fields: [{ name: 'name', label: 'Medicamento', required: true, full: true }, { name: 'dose', label: 'Dosis', placeholder: '50 mg', required: true }, { name: 'frequency', label: 'Frecuencia', placeholder: 'Cada 12 horas' }, { name: 'times', label: 'Horarios (HH:MM, separados por coma)', placeholder: '08:00, 20:00', required: true, full: true }],
      onSubmit: (v) => {
        const times = list(v.times);
        if (!times.length || times.some((t) => !TIME_RE.test(t))) throw new Error('Los horarios deben tener formato HH:MM, por ejemplo 08:00, 20:00.');
        return addMedicine(patient.id, { name: v.name.trim(), dose: v.dose.trim(), frequency: v.frequency.trim() || 'Según indicación', times: [...new Set(times)].sort() })
          .then(() => toast(`${v.name.trim()} agregado.`));
      } },
    addContact: patient && { title: 'Agregar contacto', submitLabel: 'Agregar',
      fields: [{ name: 'name', label: 'Nombre', required: true, full: true }, { name: 'relation', label: 'Relación', placeholder: 'Hijo/a, médico…' }, { name: 'phone', label: 'Teléfono', required: true }],
      onSubmit: async (v) => { await addContact(patient.id, { name: v.name.trim(), relation: v.relation.trim() || 'Contacto', phone: v.phone.trim() }); toast('Contacto agregado.'); } },
  };

  const statusPill = (taken) => <span className={`dose-status ${taken ? 'done' : 'pending'}`}>{taken ? 'Tomado' : 'Pendiente'}</span>;

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
      <div className="sidebar-top"><Logo/><button className="mobile-close" onClick={() => setMobileMenu(false)} aria-label="Cerrar menú"><X size={20}/></button></div>
      {patient ? <button className="profile-mini" onClick={() => isCaregiver && goTo('patients')} style={{ cursor: isCaregiver ? 'pointer' : 'default', textAlign: 'left', font: 'inherit' }}>
        <div className="avatar patient-avatar">{initials(patient.name)}</div>
        <div className="profile-copy"><strong>{patient.name}</strong><span>{isCaregiver ? 'Paciente seleccionado' : `Paciente${patient.age ? ` · ${patient.age} años` : ''}`}</span></div>
        {isCaregiver && <ChevronDown size={16} className="muted"/>}
      </button> : <div className="profile-mini"><div className="profile-copy"><strong>Sin pacientes</strong><span>Agregá uno para empezar</span></div></div>}
      <div className="nav-caption">MENÚ PRINCIPAL</div>
      <nav className="nav-list">
        {nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${section === id ? 'active' : ''}`} onClick={() => goTo(id)}>
          <Icon size={19}/><span>{label}</span>
          {id === 'patients' && pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
          {id === 'important' && <span className="nav-dot"/>}
        </button>)}
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item logout" onClick={onLogout}><LogOut size={19}/><span>Cerrar sesión</span></button>
        <div className="help-card"><div className="help-icon"><ShieldCheck size={20}/></div><strong>¿Necesitás ayuda?</strong><p>Tu tranquilidad y la de tu familia es lo primero.</p><button onClick={() => toast('Centro de ayuda de demostración')}>Centro de ayuda <ArrowUpRight size={14}/></button></div>
        <div className="sidebar-foot"><span className="online-dot"/> Conectado · sincronizando <span className="version">v1.1</span></div>
      </div>
    </aside>

    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Menu size={22}/></button>
        <div className="breadcrumb">{isCaregiver ? 'Cuidador' : 'Paciente'} <span>/</span> <b>{sectionLabel}</b></div>
        <div className="top-actions">
          <div className="secure-label"><ShieldCheck size={16}/> Datos protegidos</div>
          <div className="font-size-control" role="group" aria-label="Tamaño del texto">
            <button onClick={() => setFontSize('small')} aria-label="Texto pequeño" aria-pressed={fontSize === 'small'}>A−</button>
            <button onClick={() => setFontSize('normal')} aria-label="Texto normal" aria-pressed={fontSize === 'normal'}>A</button>
            <button onClick={() => setFontSize('large')} aria-label="Texto grande" aria-pressed={fontSize === 'large'}>A+</button>
          </div>
          <button className="icon-button" onClick={() => pendingCount ? goTo('patients') : toast('No tenés notificaciones nuevas')} aria-label="Notificaciones"><Bell size={19}/>{pendingCount > 0 && <i/>}</button>
          <div className="user-avatar" title={isCaregiver ? user.name : request.deviceName}>{initials(isCaregiver ? user.name : (request.deviceName || patient?.name))}</div>
        </div>
      </header>

      <div className="content">
        <div className="welcome-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-line"/> {isCaregiver ? 'PANEL DEL CUIDADOR' : 'PANEL DEL PACIENTE'}</div>
            <h1>{section === 'important' ? 'Datos importantes' : sectionLabel}</h1>
            <p className="subtitle">
              {section === 'patients' ? `Hola, ${user.name.split(' ')[0]}. Elegí a quién querés gestionar.`
                : section === 'important' && patient ? `Toda la información esencial de ${firstName}, en un solo lugar.`
                : isCaregiver ? 'Consultá y gestioná la información del paciente.' : 'Consultá tu información. Tu cuidador la mantiene actualizada.'}
            </p>
          </div>
          {patient && section !== 'patients' && <button className="secondary-button report-open-button" onClick={() => setReportOpen(true)}><FileText size={15}/> Generar informe</button>}
          {patient && section !== 'patients' && <div className="updated"><CalendarDays size={16}/><span>Última actualización<br/><b>{patient.updated}</b></span></div>}
        </div>

        {syncError && <div className="sync-warning" role="status"><span>No se pudo sincronizar: {syncError}</span><button onClick={() => runAction(onRetry)}>Reintentar</button></div>}

        {section === 'patients' && isCaregiver && <PatientsPanel patients={myPatients} requests={myRequests} selectedId={patient?.id} onSelect={select} onOpen={() => goTo('important')} onAdd={() => setModal('addPatient')} toast={toast} runAction={runAction}/>}

        {needsPatient && <section className="detail-panel"><p className="empty-state">Primero agregá un paciente en “Mis pacientes”.</p><button className="primary-button" onClick={() => goTo('patients')}>Ir a Mis pacientes</button></section>}

        {patient && section === 'important' && <>
          <section className="emergency-banner">
            <div className="emergency-symbol"><AlertTriangle size={25}/></div>
            <div className="emergency-copy"><strong>Información para una emergencia</strong><span>Si {firstName} necesita asistencia, consultá estos datos antes de actuar.</span></div>
            <a className="emergency-call" href={phoneHref('107')}><Phone size={17}/> Llamar emergencias</a>
          </section>

          <section className="patient-card">
            <div className="patient-main">
              <div className="avatar big-avatar">{initials(patient.name)}<span className="status-check"><Check size={12}/></span></div>
              <div className="patient-details"><div className="patient-name-row"><h2>{patient.name}</h2><span className="pill-status"><span/> Perfil activo</span></div><p>Información médica de acceso rápido</p><div className="patient-meta"><span><UserRound size={15}/> {patient.age || '—'} años</span><span><ClipboardList size={15}/> DNI {patient.dni || '—'}</span></div></div>
            </div>
            {isCaregiver && <button className="secondary-button" onClick={() => setModal('editPatient')}><Pencil size={14}/> Editar</button>}
            <div className="blood-group"><span>GRUPO SANGUÍNEO</span><strong>{patient.blood || '—'}</strong><small>Factor sanguíneo</small></div>
          </section>

          <div className="section-heading"><div><h2>Resumen de salud</h2><p>Datos que pueden ser importantes en una atención médica.</p></div><span className="small-lock"><ShieldCheck size={15}/> Información confidencial</span></div>
          <div className="health-grid">
            <article className="info-card allergy-card"><div className="card-heading"><div className="card-icon red"><AlertTriangle size={19}/></div><div><h3>Alergias</h3><p>Reacciones conocidas</p></div><span className="count red-count">{patient.allergies.length}</span></div>
              {patient.allergies.length === 0 && <p className="empty-state">Sin alergias registradas.</p>}
              {patient.allergies.map((a) => <div className="tag-row" key={a}><span className="alert-dot"/><strong>{a}</strong><span className="tag-alert">Importante</span></div>)}<div className="card-note"><Info size={14}/> Verificar alergias antes de administrar medicación.</div>
            </article>
            <article className="info-card"><div className="card-heading"><div className="card-icon blue"><Activity size={19}/></div><div><h3>Enfermedades y diagnósticos</h3><p>Condiciones registradas</p></div><span className="count blue-count">{patient.conditions.length}</span></div>
              {patient.conditions.length === 0 && <p className="empty-state">Sin diagnósticos registrados.</p>}
              {patient.conditions.slice(0, showAll ? undefined : 2).map((c, i) => <div className="condition-row" key={c}><span className="condition-icon">{i === 0 ? <HeartPulse size={16}/> : <Activity size={16}/>}</span><span>{c}</span><Check size={16} className="condition-check"/></div>)}
              {patient.conditions.length > 2 && <button className="text-link" onClick={() => setShowAll(!showAll)}>{showAll ? 'Mostrar menos' : 'Ver diagnósticos'} <ArrowUpRight size={14}/></button>}
            </article>
            <article className="info-card medication-card"><div className="card-heading"><div className="card-icon violet"><Pill size={19}/></div><div><h3>Medicación actual</h3><p>Tratamiento registrado</p></div><span className="count violet-count">{patient.medicines.length}</span></div>
              {patient.medicines.length === 0 && <p className="empty-state">Sin medicación registrada.</p>}
              {patient.medicines.slice(0, 2).map((m) => <div className="medicine-mini" key={m.id}><div className={`medicine-symbol ${m.color}`}><Pill size={15}/></div><div className="medicine-mini-copy"><strong>{m.name}</strong><span>{m.dose} · {m.times.join(' · ')}</span></div><Clock3 size={15} className="muted"/></div>)}
              <button className="text-link" onClick={() => goTo('medication')}>Ver medicación completa <ArrowUpRight size={14}/></button>
            </article>
            <article className="info-card contacts-card"><div className="card-heading"><div className="card-icon green"><Users size={19}/></div><div><h3>Contactos de emergencia</h3><p>Personas a las que podés avisar</p></div></div>
              {patient.contacts.length === 0 && <p className="empty-state">Sin contactos registrados.</p>}
              {patient.contacts.slice(0, 2).map((c) => <div className="contact-mini" key={c.id}><div className="avatar contact-avatar">{initials(c.name)}</div><div className="contact-copy"><strong>{c.name}</strong><span>{c.relation}</span></div><a className="call-small" href={phoneHref(c.phone)} aria-label={`Llamar a ${c.name}`}><Phone size={15}/></a></div>)}
              <button className="text-link" onClick={() => goTo('contacts')}>Ver todos los contactos <ArrowUpRight size={14}/></button>
            </article>
          </div>

          <section className="bottom-grid">
            <article className="next-medication"><div className="bottom-title"><div><h3>Próximas tomas</h3><p>{isCaregiver ? 'Horarios de hoy y estado de cada toma' : 'Activá el interruptor cuando tomes cada pastilla'}</p></div><button className="round-arrow" onClick={() => goTo('medication')} aria-label="Ver medicación"><ArrowUpRight size={17}/></button></div>
              {doses.length === 0 && <p className="empty-state">No hay tomas programadas.</p>}
              {doses.map((d) => <div className="dose-row" key={d.key}><div className="dose-time"><Clock3 size={15}/><b>{d.time}</b></div><div className={`dose-line ${d.med.color}`}/><div className="dose-copy"><strong>{d.med.name} <span>{d.med.dose}</span></strong><small>{d.med.frequency}</small></div>{statusPill(d.taken)}<Switch checked={d.taken} onChange={() => toggle(d)} label={`Tomé ${d.med.name} de las ${d.time}`}/></div>)}
            </article>
            <article className="quick-access"><div className="bottom-title"><div><h3>Acceso rápido</h3><p>Acciones útiles ante una emergencia</p></div></div>
              <button className="quick-action" onClick={() => goTo('history')}><div className="quick-icon blue"><FileText size={18}/></div><span><strong>Consultar historial médico</strong><small>Diagnósticos y antecedentes</small></span><ArrowUpRight size={17}/></button>
              <button className="quick-action" onClick={() => goTo('contacts')}><div className="quick-icon green"><Phone size={18}/></div><span><strong>Llamar a un contacto</strong><small>Familiares y profesionales</small></span><ArrowUpRight size={17}/></button>
              <a className="quick-action" href={phoneHref('107')}><div className="quick-icon red"><HeartPulse size={18}/></div><span><strong>Emergencias médicas</strong><small>Servicio de asistencia · 107</small></span><ArrowUpRight size={17}/></a>
            </article>
          </section>
        </>}

        {patient && section === 'medication' && <section className="detail-panel">
          <div className="panel-head"><div><h2>Tratamiento actual</h2><p>Medicamentos y horarios registrados para {isCaregiver ? 'el paciente' : 'vos'}.</p></div>
            <div className="head-actions">
              {isCaregiver && <button className="secondary-button" onClick={() => runAction(() => triggerTest(patient.id), 'Alarma de prueba enviada a los dispositivos conectados.')}><BellRing size={15}/> Probar alarma</button>}
              {isCaregiver ? <button className="primary-button" onClick={() => setModal('addMed')}><Plus size={16}/> Agregar</button> : <span className="panel-count">{patient.medicines.length} medicamentos</span>}
            </div>
          </div>
          {patient.medicines.length === 0 && <p className="empty-state">No hay medicamentos cargados.</p>}
          {patient.medicines.map((m) => <div className="detail-row" key={m.id}>
            <div className={`medicine-symbol ${m.color}`}><Pill size={18}/></div>
            <div className="detail-main"><strong>{m.name}</strong><span>{m.dose} · {m.frequency}</span></div>
            <div className="detail-time"><Clock3 size={15}/>{m.times.join(' · ')}</div>
            {isCaregiver && <button className="secondary-button" onClick={() => { if (window.confirm(`¿Quitar ${m.name}?`)) runAction(() => removeMedicine(patient.id, m.id), `${m.name} fue quitado.`); }} aria-label={`Quitar ${m.name}`}><Trash2 size={15}/></button>}
          </div>)}

          <div className="history-block"><h3>Tomas de hoy</h3>
            {doses.length === 0 && <p className="empty-state">No hay tomas programadas.</p>}
            {doses.map((d) => <div className="detail-row" key={d.key}>
              <div className={`medicine-symbol ${d.med.color}`}><Pill size={18}/></div>
              <div className="detail-main"><strong>{d.med.name} <span className="dose-inline">{d.med.dose}</span></strong><span>{d.time} hs</span></div>
              {statusPill(d.taken)}
              <label className="switch-label"><Switch checked={d.taken} onChange={() => toggle(d)} label={`Tomé ${d.med.name} de las ${d.time}`}/><span>{d.taken ? 'Ya la tomé' : 'Marcar toma'}</span></label>
            </div>)}
          </div>
          <p className="disclaimer"><Info size={16}/> {isCaregiver ? 'Las alarmas suenan en tu dispositivo y en el del paciente hasta que la toma se marque como realizada.' : 'Solo tu cuidador puede cambiar los medicamentos. Vos solo informás si tomaste cada pastilla.'}</p>
        </section>}

        {patient && section === 'history' && <section className="detail-panel"><div className="panel-head"><div><h2>Historial médico</h2><p>Antecedentes y diagnósticos informados.</p></div>{isCaregiver && <div className="head-actions"><button className="secondary-button" onClick={() => setModal('editPatient')}><Pencil size={14}/> Editar historial</button><button className="primary-button" onClick={() => setModal('addCondition')}><Plus size={15}/> Agregar diagnóstico</button></div>}</div>
          <label className="search-box"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar diagnóstico..."/></label>
          <div className="history-block"><h3>Diagnósticos registrados</h3>{filteredConditions.length ? filteredConditions.map((c) => <div className="history-row" key={c}><div className="history-icon"><HeartPulse size={17}/></div><div><strong>{c}</strong><span>Registrado en la ficha del paciente</span></div><span className="history-active">Activo</span>{isCaregiver && <button className="call-small remove-condition" onClick={() => { if (window.confirm(`¿Quitar ${c} del historial de ${patient.name}?`)) runAction(() => removeCondition(patient.id, c), 'Diagnóstico quitado del historial.'); }} aria-label={`Quitar ${c} del historial`}><Trash2 size={15}/></button>}</div>) : <p className="empty-state">{query ? 'No se encontraron diagnósticos.' : 'No hay diagnósticos registrados.'}</p>}</div>
          <div className="history-block"><h3>Información adicional</h3><div className="fact-grid"><div><span>Grupo sanguíneo</span><strong>{patient.blood || '—'}</strong></div><div><span>Alergias registradas</span><strong>{patient.allergies.join(', ') || '—'}</strong></div><div><span>Altura</span><strong>{patient.height || '—'}</strong></div><div><span>Peso</span><strong>{patient.weight || '—'}</strong></div></div></div>
          <p className="disclaimer"><Info size={16}/> La información es ilustrativa y no reemplaza una historia clínica oficial.</p></section>}

        {patient && section === 'contacts' && <section className="detail-panel"><div className="panel-head"><div><h2>Contactos de emergencia</h2><p>Personas de referencia para asistir al paciente.</p></div><span className="panel-count">{patient.contacts.length} contactos</span></div>
          {patient.contacts.length === 0 && <p className="empty-state">No hay contactos cargados.</p>}
          {patient.contacts.map((c) => <div className="contact-detail" key={c.id}><div className="avatar contact-avatar large">{initials(c.name)}</div><div className="contact-detail-copy"><strong>{c.name}</strong><span>{c.relation}</span><small>{c.phone}</small></div><a className="primary-button" href={phoneHref(c.phone)}><Phone size={16}/> Llamar</a>{isCaregiver && <button className="secondary-button" onClick={() => runAction(() => removeContact(patient.id, c.id), 'Contacto eliminado.')} aria-label={`Quitar ${c.name}`}><Trash2 size={15}/></button>}</div>)}
          {isCaregiver && <button className="secondary-button add-contact" onClick={() => setModal('addContact')}><Plus size={16}/> Agregar contacto</button>}
          <p className="disclaimer"><Info size={16}/> Los números son ficticios y sirven solo para mostrar el funcionamiento de la interfaz.</p></section>}

        <footer className="footer"><Logo/><span>© 2026 InGuard · Cuidar también es estar conectado.</span><span className="footer-privacy"><ShieldCheck size={14}/> Privacidad y seguridad</span></footer>
      </div>
    </main>

    {modal && forms[modal] && <FormModal {...forms[modal]} onClose={() => setModal(null)}/>}
    {reportOpen && patient && <HealthReport patient={patient} doses={doses} onClose={() => setReportOpen(false)}/>}
    <AlarmOverlay alarms={active} role={role} onSilence={(id) => silence(id)} onTake={takeFromAlarm}/>
    {notice && <div className="toast"><Check size={17}/>{notice}<button onClick={() => setNotice('')} aria-label="Cerrar aviso"><X size={15}/></button></div>}
    <div className="demo-note">PROTOTIPO ACADÉMICO · DATOS FICTICIOS</div>
  </div>;
}
