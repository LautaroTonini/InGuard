# InGuard — Sprint 2 (React)

Prototipo frontend de **InGuard**: cuidado conectado entre cuidadores y pacientes.

## Ejecutar
```bash
npm install
```

Configurar la URL del backend en `frontend/.env.local` si no está en `http://localhost:5000`:
```env
VITE_API_URL=http://localhost:5000
```

Iniciar el backend según las instrucciones de `../backend/README.md`. Después:
```bash
npm run dev
```
Abrí la URL de Vite (normalmente `http://localhost:5173`). Build de producción: `npm run build && npm run preview`.

## Qué incluye
**Acceso**
- Inicio de sesión, registro y recuperación de contraseña para cuidadores.
- Ingreso del paciente por **código** (ej. `ABC-123`) que el cuidador debe **aceptar**.

**Vista cuidador** (gestiona todo)
- Pestaña **Mis pacientes**: elegir a quién gestionar, agregar/eliminar pacientes, ver y regenerar el código de cada uno, aceptar o rechazar solicitudes, desvincular dispositivos.
- Editar datos del paciente, medicación (con horarios), contactos e historial de diagnósticos; agregar o quitar diagnósticos.
- Marcar tomas, **probar alarma** y recibir las alarmas de todos sus pacientes.
- Generar un informe de salud imprimible o guardarlo como PDF desde el navegador.

**Vista paciente** (solo lectura)
- Ve desde el celular datos importantes, medicación, historial y contactos; puede ajustar el tamaño del texto.
- Lo único que puede hacer es **informar con un interruptor si tomó la pastilla**.

**Alarmas**
- Suenan en el paciente y en el cuidador a la hora de cada toma, hasta que se marque como tomada (se sincroniza en vivo). Se puede silenciar 5 minutos.
- Los botones de llamada abren el marcador del dispositivo con el número del contacto o emergencias.

## Cómo probar la conexión cuidador ↔ paciente
1. Abrí la app en una pestaña y registrate como cuidador (se crea un paciente de ejemplo con su código).
2. Abrí **otra pestaña** → “Soy paciente” → ingresá el código. Queda en espera.
3. En la pestaña del cuidador aparece la solicitud en **Mis pacientes** → Aceptar.
4. En Medicación tocá **Probar alarma**: suena en ambas pestañas.

## Alcance de la demo
- La autenticación y los datos se consultan y guardan mediante la API Flask del proyecto (`/app/*`), con token por sesión. La URL se configura con `VITE_API_URL`; el backend requiere MongoDB. El panel actualiza su snapshot cada 5 segundos para reflejar cambios entre dispositivos.
- El botón de envío del informe a emergencias sigue en modo demostración: no se transmiten datos. El informe puede imprimirse o guardarse como PDF desde el navegador.
- La recuperación de contraseña muestra el código en pantalla cuando el backend está en modo demo (`RESET_DEMO=true`).
- Las contraseñas se validan y almacenan únicamente en el backend usando bcrypt.
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
    ├── store.js       # cliente API, sesión y snapshot del servidor
    ├── alarm.js       # lógica y sonido de alarmas
    ├── ui.jsx         # Logo, Switch, campos y modal de formularios
    └── styles.css     # estilos originales + nuevos
```
