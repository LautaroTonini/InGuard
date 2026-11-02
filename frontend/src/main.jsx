import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowLeft, Hourglass, ShieldX } from 'lucide-react';
import './styles.css';
import AuthScreen from './Auth.jsx';
import Workspace from './Workspace.jsx';
import { Logo } from './ui.jsx';
import { clearSession, loadSession, refreshDB, saveSession, unlinkRequest, useDB } from './store.js';

function PatientWaiting({ request, patient, onCancel, syncError, onRetry }) {
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
      {syncError && <div className="form-error">{syncError}<button className="text-link" onClick={onRetry}>Reintentar</button></div>}
      {!rejected && <div className="waiting-dots"><span/><span/><span/></div>}
      <button className="secondary-button auth-submit" onClick={onCancel}><ArrowLeft size={15}/> {rejected ? 'Volver' : 'Cancelar solicitud'}</button>
    </div>
  </div>;
}

function App() {
  const db = useDB();
  const [session, setSession] = useState(loadSession);
  const [dbReady, setDBReady] = useState(false);
  const [syncError, setSyncError] = useState('');
  const login = (nextSession) => { saveSession(nextSession); setDBReady(false); setSyncError(''); setSession(nextSession); };
  const logout = () => { clearSession(); setSession(null); setDBReady(true); setSyncError(''); };
  const retrySnapshot = async () => {
    try {
      await refreshDB(session?.token);
      setDBReady(true);
      setSyncError('');
    } catch (error) {
      if (error.status === 401) {
        logout();
        return;
      }
      setDBReady(true);
      setSyncError(error.message);
      throw error;
    }
  };

  useEffect(() => {
    if (!session?.token) {
      setDBReady(true);
      return undefined;
    }

    let active = true;
    const refresh = async () => {
      try {
        await refreshDB(session.token);
        if (active) {
          setDBReady(true);
          setSyncError('');
        }
      } catch (error) {
        if (active) {
          if (error.status === 401) {
            logout();
            return;
          }
          setDBReady(true);
          setSyncError(error.message);
        }
      }
    };

    refresh();
    const interval = window.setInterval(refresh, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [session?.token]);

  const user = session?.role === 'caregiver' ? db.users.find((u) => u.id === session.userId) : null;
  const request = session?.role === 'patient' ? db.requests.find((r) => r.id === session.requestId) : null;
  const valid = !!(user || request);

  useEffect(() => {
    if (session?.token && dbReady && !syncError && !valid) logout();
  }, [session, dbReady, syncError, valid]);

  if (!session || !session.token) return <AuthScreen onSession={login}/>;
  if (!dbReady) return <div className="auth-shell"><div className="auth-card waiting-card"><Logo/><h1>Conectando con InGuard</h1><p className="auth-sub">Cargando tus datos del servidor…</p></div></div>;
  if (syncError && !valid) return <div className="auth-shell"><div className="auth-card waiting-card"><Logo/><h1>No se pudo conectar</h1><p className="auth-sub">{syncError}</p><button className="primary-button auth-submit" onClick={() => retrySnapshot().catch(() => {})}>Reintentar</button><button className="secondary-button auth-submit" onClick={logout}>Cerrar sesión</button></div></div>;
  if (!valid) return <div className="auth-shell"><div className="auth-card waiting-card"><Logo/><h1>Sesión inválida</h1><p className="auth-sub">La sesión ya no existe en el servidor. Iniciá sesión nuevamente.</p><button className="primary-button auth-submit" onClick={logout}>Volver al inicio</button></div></div>;
  if (user) return <Workspace role="caregiver" db={db} user={user} onLogout={logout} syncError={syncError} onRetry={retrySnapshot}/>;

  const patient = db.patients.find((p) => p.id === request.patientId);
  if (request.status !== 'accepted' || !patient) {
    const cancel = async () => {
      try {
        await unlinkRequest(request.id);
        logout();
      } catch (error) {
        setSyncError(error.message);
      }
    };
    return <PatientWaiting request={request} patient={patient} onCancel={cancel} syncError={syncError} onRetry={() => retrySnapshot().catch(() => {})}/>;
  }
  return <Workspace role="patient" db={db} request={request} onLogout={logout} syncError={syncError} onRetry={retrySnapshot}/>;
}

createRoot(document.getElementById('root')).render(<App/>);
