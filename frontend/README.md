# InGuard — Sprint 2 (React)

Prototipo frontend de **InGuard**: cuidado conectado entre cuidadores y pacientes.

## Ejecutar
```bash
npm install
npm run dev
```
Abrí la URL de Vite (normalmente `http://localhost:5173`). Build de producción: `npm run build && npm run preview`.

## Qué incluye
**Acceso**
- Inicio de sesión, registro y recuperación de contraseña para cuidadores.
- Ingreso del paciente por **código** (ej. `ABC-123`) que el cuidador debe **aceptar**.

**Vista cuidador** (gestiona todo)
- Pestaña **Mis pacientes**: elegir a quién gestionar, agregar/eliminar pacientes, ver y regenerar el código de cada uno, aceptar o rechazar solicitudes, desvincular dispositivos.
- Editar datos del paciente, medicación (con horarios), contactos y diagnósticos.
- Marcar tomas, **probar alarma** y recibir las alarmas de todos sus pacientes.

**Vista paciente** (solo lectura)
- Ve datos importantes, medicación, historial y contactos.
- Lo único que puede hacer es **informar con un interruptor si tomó la pastilla**.

**Alarmas**
- Suenan en el paciente y en el cuidador a la hora de cada toma, hasta que se marque como tomada (se sincroniza en vivo). Se puede silenciar 5 minutos.

## Cómo probar la conexión cuidador ↔ paciente
1. Abrí la app en una pestaña y registrate como cuidador (se crea un paciente de ejemplo con su código).
2. Abrí **otra pestaña** → “Soy paciente” → ingresá el código. Queda en espera.
3. En la pestaña del cuidador aparece la solicitud en **Mis pacientes** → Aceptar.
4. En Medicación tocá **Probar alarma**: suena en ambas pestañas.

## Alcance de la demo
- Los datos se guardan en `localStorage` y se sincronizan entre pestañas del **mismo navegador**. Para conectar dispositivos distintos hace falta un backend (Firebase, Supabase o Node + WebSocket): todo el acceso a datos está aislado en `src/store.js`, así que solo hay que reemplazar ese archivo.
- La recuperación de contraseña muestra el código en pantalla porque no hay servidor de correo.
- Las contraseñas se guardan con hash SHA-256 solo para la demo; en producción corresponde un hash con sal en el servidor.
- Las alarmas suenan con la pestaña abierta y después de haber interactuado con la página (restricción de los navegadores). Para avisos con la app cerrada se necesitan notificaciones push.
- Datos y teléfonos ficticios. No usar para decisiones médicas reales.

## Estructura
```text
├── index.html
├── package.json
└── src/
    ├── main.jsx       # enrutado por sesión (cuidador / paciente / espera de aprobación)
    ├── Auth.jsx       # login, registro, recuperar contraseña, ingreso por código
    ├── Workspace.jsx  # panel de cuidador y de paciente + overlay de alarma
    ├── store.js       # datos, sesión y sincronización (reemplazable por backend)
    ├── alarm.js       # lógica y sonido de alarmas
    ├── ui.jsx         # Logo, Switch, campos y modal de formularios
    └── styles.css     # estilos originales + nuevos
```
