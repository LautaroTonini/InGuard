import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Hourglass, ShieldX } from 'lucide-react';
import './styles.css';
import AuthScreen from './Auth.jsx';
import Workspace from './Workspace.jsx';
import { Logo } from './ui.jsx';
import { clearSession, loadSession, saveSession, unlinkRequest, useDB } from './store.js';

function PatientWaiting({ request, patient, onCancel }) {
  const rejected = request.status === 'rejected';
  return <div className="auth-shell">
    <div className="auth-card waiting-card">
      <Logo/>
      <div className={`waiting-icon ${rejected ? 'bad' : ''}`}>{rejected ? <ShieldX size={30}/> : <Hourglass size={30}/>}</div>
      <h1>{rejected ? 'Solicitud rechazada' : 'Esperando aprobación'}</h1>
      <p className="auth-sub">
        {rejected
          ? 'Tu cuidador no aceptó esta solicitud. Verificá el código con él e intentá de nuevo.'
          : `Tu cuidador tiene que aceptar tu ingreso para que puedas ver el perfil de ${patient?.name || 'tu cuenta'}. Esta pantalla se actualiza sola.`}
      </p>
      {!rejected && <div className="waiting-dots"><span/><span/><span/></div>}
      <button className="secondary-button auth-submit" onClick={onCancel}><ArrowLeft size={15}/> {rejected ? 'Volver' : 'Cancelar solicitud'}</button>
    </div>
  </div>;
}

function App() {
  const db = useDB();
  const [session, setSession] = useState(loadSession);
  const login = (s) => { saveSession(s); setSession(s); };
  const logout = () => { clearSession(); setSession(null); };

  const user = session?.role === 'caregiver' ? db.users.find((u) => u.id === session.userId) : null;
  const request = session?.role === 'patient' ? db.requests.find((r) => r.id === session.requestId) : null;
  const valid = !!(user || request);

  // Si la cuenta o el vínculo ya no existen (p. ej. el cuidador desvinculó el dispositivo), se cierra la sesión.
  useEffect(() => { if (session && !valid) logout(); }, [session, valid]);

  if (!session || !valid) return <AuthScreen onSession={login}/>;
  if (user) return <Workspace role="caregiver" db={db} user={user} onLogout={logout}/>;

  const patient = db.patients.find((p) => p.id === request.patientId);
  if (request.status !== 'accepted' || !patient) {
    const cancel = () => { unlinkRequest(request.id); logout(); };
    return <PatientWaiting request={request} patient={patient} onCancel={cancel}/>;
  }
  return <Workspace role="patient" db={db} request={request} onLogout={logout}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
