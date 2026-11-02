# Pruebas del frontend InGuard (React)

## Herramientas utilizadas
- [Vitest](https://vitest.dev/) 5.0.5 como runner de pruebas.
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) 16.3.3 para renderizar componentes y simular interacciones.
- [@testing-library/user-event](https://testing-library.com/docs/user-event/intro/) 14.6.8 para simular acciones del usuario.
- [jsdom](https://github.com/jsdom/jsdom) 30.1.3 para el entorno DOM.
- [@testing-library/jest-dom](https://github.com/testing-library/jest-dom) con Vitest para aserciones.
- [@vitest/coverage-v8](https://vitest.dev/guide/coverage) para el reporte de cobertura.

Configuración en [`vite.config.js`](./vite.config.js) con `environment: 'jsdom'`, `globals: true` y setup en [`src/test/setup.js`](./src/test/setup.js) (limpieza con `cleanup`, vaciado de `sessionStorage`/`localStorage` y restauración de mocks).

## Scripts
```bash
npm test           # Ejecuta todas las pruebas una vez
npm run test:watch # Modo observador
npm run test:ui    # Interfaz gráfica de Vitest
npm run test:coverage # Pruebas con reporte de cobertura
```

## Cobertura (vitest run --coverage)
| Archivo | % Sentencias | % Ramas | % Funciones | % Líneas | Líneas sin cubrir |
| --- | --- | --- | --- | --- | --- |
| `src/Auth.jsx` | 87,67 | 93,84 | 75,00 | 88,33 | Flujos secundarios de recuperación/validación |
| `src/Workspace.jsx` | 57,00 | 58,27 | 47,15 | 58,08 | Secciones y acciones secundarias del panel |
| `src/alarm.js` | 72,22 | 85,29 | 80,00 | 75,00 | Generación de tonos Web Audio |
| `src/store.js` | 63,24 | 55,10 | 45,45 | 74,41 | Acciones mutadoras con `refreshAfter` y utilidades |
| `src/ui.jsx` | 100,00 | 96,15 | 100,00 | 100,00 | Sin líneas críticas sin cubrir |
| **Total** | **67,37** | **67,50** | **53,88** | **71,88** | — |

## Casos probados

### `src/test/store.test.js` (12 pruebas)
**Utilidades**
- `initials()` genera iniciales correctas (nombres compuestos, espacios, vacío).
- `TIME_RE` valida formato `HH:MM` en 24 horas y rechaza formatos inválidos.
- `todayKey()` devuelve fecha en formato `YYYY-MM-DD` y `doseKey()` construye la clave correcta.

**Sesión por pestaña (`sessionStorage`)**
- `saveSession`/`loadSession` guardan y leen la sesión.
- `clearSession` elimina la sesión y resetea el cache.
- `loadSession()` devuelve `null` ante JSON inválido.

**Cliente API**
- `refreshDB()` obtiene el snapshot, actualiza el cache y `useDB()` lo expone.
- `registerCaregiver()` normaliza correo a minúsculas, envía `paciente_ejemplo: true` y devuelve `id`/`token`.
- `loginCaregiver()` normaliza el correo.
- `requestReset()` devuelve el `codigo` de recuperación.
- `requestLink()` usa `"Dispositivo"` como nombre por defecto.
- Traducción de errores del backend (`detail` con `campo`/`mensaje`) al mensaje unificado.
- Error cuando no hay conexión con el backend.
- Error ante respuesta con JSON inválido.

### `src/test/ui.test.jsx` (8 pruebas)
**`Logo`**
- Renderiza imagen `alt="InGuard"`, marca y eslogan.

**`Switch`**
- Refleja `aria-checked`, llama a `onChange` con el valor invertido y se actualiza al cambiar `checked`.

**`PasswordField`**
- Alterna entre `type="password"` y `type="text"`, actualizando el `aria-label` del botón.

**`FormModal`**
- Envía valores, cierra con `onClose` al éxito.
- Precarga `initial`, muestra error sin cerrar ante fallo en `onSubmit`.
- Cierra con botón `Cancelar` y al hacer clic fuera del modal (`onMouseDown` en backdrop).

### `src/test/alarm.test.js` (11 pruebas)
**`useAlarms(patients)`**
- Activa toma dentro de los 60 minutos posteriores al horario programado.
- No activa tomas ya marcadas como tomadas (`doses[key]`).
- No activa tomas fuera de la ventana de 60 minutos.
- No activa tomas cuya hora aún no ha llegado.
- Ignora horarios con formato inválido (`TIME_RE`).
- `silence(id)` silencia la alarma por 5 minutos.
- Activa alarmas de prueba pendientes y recientes, descartando las finalizadas o antiguas (>120s).

**Sonido**
- `unlockAudio()`, `beep()` y `ring()` no lanzan errores cuando Web Audio/Vibration no están disponibles.

### `src/test/Auth.test.jsx` (6 pruebas)
- Inicio de sesión como cuidador y llamada a `loginCaregiver()`.
- Muestra error del backend al fallar el login.
- Validación de contraseñas coincidentes al registrarse.
- Validación de longitud mínima (6 caracteres) al registrarse.
- Recuperación de contraseña en dos pasos: solicitud de código, muestra código demo, restablecimiento y mensaje de éxito.
- Ingreso como paciente: pasa a pestaña "Soy paciente", convierte código a mayúsculas y llama a `requestLink()`.

### `src/test/Workspace.test.jsx` (6 pruebas)
**Cuidador**
- Muestra "Personas a cargo", código del paciente, solicitudes pendientes y permite aceptar solicitudes.
- Navega a "Datos importantes", verifica información (alergias, diagnósticos, tel. emergencias), abre informe de salud y prueba el botón demo.
- Marca una toma como realizada desde "Datos importantes" llamando a `setDose()`.
- Desde "Medicación" permite probar alarma con `triggerTest()`.
- Muestra advertencia de sincronización y ejecuta `onRetry()`.

**Paciente**
- Vista de solo lectura: sin botones de gestión (`Mis pacientes`, `Editar`), sin `Probar alarma`/`Agregar`.
- Permite marcar tomas llamando a `setDose()`.
- Muestra aviso sobre que solo el cuidador gestiona medicamentos.

## Hallazgo corregido
Durante las pruebas de recuperación de contraseña se detectó que `Auth.jsx` llamaba a `setDemoCode(requestReset(...))` sin `await`, por lo que React intentaba renderizar una `Promise` y la pantalla de recuperación fallaba. Se corrigió a `setDemoCode(await requestReset(...))` en `src/Auth.jsx`, y el caso quedó cubierto por la prueba "recorre la recuperación de contraseña en dos pasos".

## Fuera de alcance
- Se mockean `store.js` y `alarm.js` en las pruebas de componentes para no depender del backend ni de APIs de audio del navegador.
- No se prueba `main.jsx` (bootstrap/`createRoot`) ni el envío real de red; la integración con Flask/MongoDB se valida en el backend.
- No se simula Web Audio real: solo se verifica que las funciones no fallen cuando la API no está disponible.

## Resultado de la ejecución
```
Test Files  5 passed (5)
Tests        39 passed (39)
```
