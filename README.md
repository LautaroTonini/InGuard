# InGuard

Aplicación web fullstack de **cuidado conectado** orientada al área de enfermería / acompañamiento de pacientes: gestión de pacientes, medicamentos, alarmas de medicación, contactos de emergencia y sincronización offline-first.

**Stack:** React (frontend) · Flask + MongoDB (backend) · JWT · bcrypt · Swagger · pytest

---


## Descripción de la necesidad y de la solución

### Necesidad del área

En el ámbito del cuidado (enfermería domiciliaria, acompañamiento familiar o servicios de soporte), es frecuente la necesidad de:

- Organizar medicamentos y horarios de toma.
- Disponer de alarmas y recordatorios.
- Tener contactos de emergencia accesibles.
- Compartir información del paciente entre quien cuida y el propio paciente.
- Seguir operando con conectividad intermitente.

El personal y los cuidadores requieren **organización del trabajo** y **acceso a la información según el rol**, sin reemplazar el criterio clínico ni utilizarse para diagnósticos.

### Solución propuesta

**InGuard** ofrece:

| Módulo | Función |
|--------|---------|
| Usuarios y roles | Registro/login de **paciente** y **cuidador**, con permisos diferenciados |
| Vinculación | El paciente tiene un código; el cuidador se vincula de forma controlada |
| Medicamentos | Alta, edición y listado por paciente |
| Alarmas | Recordatorios de toma asociados a cada medicamento (con patrón Observer) |
| Contactos de emergencia | Gestión y consulta (incluye endpoint público de emergencia) |
| Sincronización | BD local + nube opcional (offline-first, last-write-wins) |
| Seguridad | JWT, bcrypt, límite de intentos de login, CORS restrictivo, validación Pydantic |
| API documentada | Swagger en `/docs` |

> El sistema **no** reemplaza el criterio del personal de salud ni se utiliza para realizar diagnósticos.

---

## Cómo configurar y ejecutar

### Requisitos

- Python 3.10+
- Node.js 18+ / npm
- MongoDB local **o** URI de MongoDB Atlas

### Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Crear `backend/.env` (recomendado):

```env
JWT_SECRET=un-secreto-largo-y-aleatorio
MONGO_LOCAL_URI=mongodb://localhost:27017
MONGO_LOCAL_DB=inguard_local
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
LOGIN_MAX_INTENTOS=5
LOGIN_VENTANA_MIN=15
LOGIN_BLOQUEO_MIN=15
```

```powershell
python run.py
```

- API: `http://localhost:5000`
- Swagger: `http://localhost:5000/docs`

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Abrir `http://localhost:5173`. Si la API está en otra URL:

```env
# frontend/.env.local
VITE_API_URL=http://localhost:5000
```

### Scripts de inicialización de la base de datos

Al arrancar la API (`create_app` → `crear_indices`) se crean automáticamente los índices necesarios (email/DNI únicos parciales, `paciente_id`, `sync_pendiente`, `login_attempts`, etc.).

Opcional, para verificar conexión e índices:

```powershell
cd backend
python check_db.py
```

No se requiere un script de seed obligatorio: los usuarios y datos de prueba se crean por la API (`POST /auth/registro`) con datos ficticios.

### Pruebas del backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest
```

Incluye pruebas unitarias (seguridad, permisos, Observer) y end-to-end (auth, fuerza bruta, roles, alarmas).

---

## Organización del sistema (módulos / “microservicios”)

La solución es un **monolito modular** (un proceso Flask + un frontend React). La separación de responsabilidades es por capas y módulos, no por procesos independientes desplegados.

| Componente | Responsabilidad |
|------------|-----------------|
| **Frontend (React)** | UI responsive, login, vistas por rol, consumo de la API |
| **API Flask** | Autenticación, autorización, reglas de negocio, validación |
| **Capa models / Repository** | Acceso a MongoDB, borrado lógico, flags de sync |
| **Sync service** | Sincronización local ↔ nube (hilo en segundo plano o `POST /sync`) |
| **Observers de alarmas** | Reacción a alta/edición/baja de alarmas (logging, extensión a notificaciones) |
| **MongoDB local** | Fuente principal de lectura/escritura |
| **MongoDB nube (opcional)** | Respaldo y continuidad entre dispositivos |

### Estructura del backend

```
backend/app/
  models/          # Repository (ModeloBase + entidades)
  controllers/     # Lógica de negocio
  routes/          # Blueprints HTTP
  observers/       # Patrón Observer (alarmas)
  services/        # Sincronización
  security.py      # bcrypt + JWT
  rate_limit.py    # Protección fuerza bruta
  permisos.py      # Autorización por paciente/rol
  schemas.py       # Validación Pydantic
  config.py        # Variables de entorno
```

---

##  Patrones de diseño implementados

### 1 Application Factory

- **Dónde:** `backend/app/__init__.py` → `create_app()`.
- **Problema que resuelve:** crear la aplicación Flask de forma centralizada (blueprints, CORS, Swagger, manejo de errores, hilo de sync) y facilitar tests con distinta configuración.
- **Por qué es adecuado:** patrón recomendado por Flask; desacopla el arranque del resto del código.

### 2 Repository

- **Dónde:** `backend/app/models/base.py` (`ModeloBase`) y modelos (`Usuario`, `Alarma`, `Medicamento`, etc.).
- **Problema que resuelve:** separar el acceso a MongoDB de la lógica de los controllers; unificar `actualizado_en`, `sync_pendiente` y borrado lógico.
- **Por qué es adecuado:** permite mockear la BD en pruebas y cambiar detalles de persistencia sin tocar la lógica de negocio.

### 3 Observer

- **Dónde:** `backend/app/observers/alarma_observer.py`; uso en `controllers/alarma_controller.py`.
- **Problema que resuelve:** al crear, actualizar o eliminar una alarma, varios componentes deben reaccionar (auditoría, posible sync/notificaciones) sin acoplar el controller a cada uno.
- **Por qué es adecuado:** principio abierto/cerrado; se pueden sumar observadores (push, métricas) sin modificar el flujo principal.
- **Sujeto:** `AlarmaSubject` · **Observadores:** `LoggingObserver`, `SyncObserver`.

---

## Roles, permisos y seguridad

### Roles

| Rol | Permisos principales |
|-----|----------------------|
| **paciente** | Solo sus propios datos; recibe `codigo_vinculacion` al registrarse |
| **cuidador** | Lista `pacientes_ids`; vincula pacientes; gestiona medicamentos, alarmas y contactos de sus pacientes |

La autorización se aplica **en el backend** (`permisos.verificar_acceso_paciente`, decoradores `login_requerido` / `cuidador_requerido`). Ocultar botones en el frontend no protege los endpoints.

### Mecanismos de seguridad

| Riesgo | Medida |
|--------|--------|
| **Fuerza bruta** | `rate_limit.py`: máximo de intentos fallidos por email, bloqueo temporal (HTTP 429), registro de intentos **sin** guardar contraseñas |
| **Inyección NoSQL** | Validación Pydantic de todo el body; consultas con PyMongo (sin concatenar input del usuario) |
| **Contraseñas** | Hash **bcrypt**; nunca se devuelven ni se loguean |
| **Tokens** | JWT con expiración (`JWT_EXPIRA_MIN`); secret solo por variable de entorno |
| **Datos sensibles** | Serialización que oculta `password_hash` y flags internos; acceso a paciente acotado por rol |
| **Configuración** | Secretos en `.env`; **CORS restrictivo** (orígenes explícitos, no `*` por defecto) |

Documentación interactiva de la API: **`/docs`** (Swagger / Flasgger).

--

### Escenario analizado

1. Inicio de sesión (`POST /auth/login`) con usuario de prueba.
2. Una solicitud autenticada (por ejemplo `GET /auth/me` o listado de medicamentos) con header `Authorization: Bearer ...`.

### Protocolos observados

- En desarrollo: HTTP sobre TCP (puerto 5000).
- En un despliegue real se debe usar **HTTPS/TLS** para cifrar credenciales y tokens en tránsito.

### Medidas para proteger credenciales y datos

- Contraseñas solo en el body del login (nunca en query string) y, en producción, solo sobre TLS.
- Token JWT en header `Authorization`, con vencimiento.
- No registrar en logs contraseñas, tokens ni datos clínicos innecesarios.
- Capturas adjuntas **sin** contraseñas, tokens completos ni datos reales de pacientes.

**Evidencias:** carpeta `docs/wireshark/` (o capturas en el repositorio / informe PDF del grupo).

--

## Análisis de tráfico con Wireshark

<img width="975" height="439" alt="WhatsApp Image 2026-11-02 at 00 19 38" src="https://github.com/user-attachments/assets/5f505bd4-7f65-484e-bd23-21f2df9421e5" />
<img width="680" height="528" alt="WhatsApp Image 2026-11-02 at 00 16 31" src="https://github.com/user-attachments/assets/30c348eb-6a0c-485d-a705-90e172a601d6" />

A partir de las capturas de tráfico de red y JSON del sistema InGuard (`/users/` y `/patients/`) y la estructura actual del proyecto en el `README.md`, se identificaron los siguientes puntos críticos, sus causas y las soluciones recomendadas para la documentación:

### 1. Exposición de Datos Sensibles en Texto Plano (HTTP sin TLS)

* **Error / Vulnerabilidad:** El tráfico capturado mediante Wireshark muestra que las peticiones de autenticación (`POST /auth/login`) y la consulta de colecciones (`/users/`, `/patients/`) viajan en texto plano a través del puerto HTTP (5000).


* **Por qué ocurre:** Durante el desarrollo local, Flask se ejecuta por defecto en HTTP plano sin un certificado SSL/TLS configurado.
* **Posible solución:**
* Implementar certificados SSL/TLS (HTTPS) en el servidor de producción mediante un proxy inverso (como Nginx o Caddy) o configurando Flask con un certificado autofirmado (o Let's Encrypt) para cifrar todo el tráfico de red.


* Asegurar que ningún token JWT o credencial viaje sin cifrar en entornos productivos.



### 2. Retorno de IDs Internos e Información Detallada del Usuario en Endpoints Públicos o de Listado

* **Error / Vulnerabilidad:** En las capturas de inspección de objetos JSON (`/users/` y `/patients/`), se observa la exposición completa de identificadores únicos (`id`, `1e9fcee8-881d-472a-ac86-101f831b077a`), correos electrónicos (`bizzottogregorio@gmail.com`), roles (`caregiver`), edades y condiciones médicas (`Penicilina`, `O+`) dentro de la misma respuesta de red.


* **Por qué ocurre:** Las respuestas de los controladores devuelven los diccionarios completos directamente desde la base de datos o modelos sin aplicar un filtro de serialización o DTO (Data Transfer Object) estricto.
* **Posible solución:**
* Aplicar esquemas de serialización robustos (utilizando Pydantic en las rutas) para filtrar los campos devueltos al cliente, exponiendo únicamente lo necesario según el rol autenticado y evitando enviar información innecesaria en las tramas de la API.





### 3. Falta de Ocultamiento de la Estructura de Base de Datos en los Payloads

* **Error / Vulnerabilidad:** Las tramas analizadas revelan rutas internas de almacenamiento y metadatos (`/users/[]/email`, `/patients/[]/allergies/`) que muestran directamente la arquitectura de los documentos de MongoDB.


* **Por qué ocurre:** El mapeo automático de los repositorios (`ModeloBase`) serializa los documentos NoSQL mapeando directamente los nombres de las claves de la base de datos hacia la respuesta JSON sin abstracción intermedia.
* **Posible solución:**
* Desacoplar los modelos de persistencia de los modelos de vista/respuesta de la API. Transformar los documentos de MongoDB en esquemas limpios orientados al cliente antes de enviarlos por la red.

--

## Integrantes del grupo y contribuciones

| Integrante | Área | Contribuciones principales |
|------------|------|----------------------------|
| **[Fabrizio Rossato]** | Backend |  Alarmas, patrón Observer, documentación de seguridad, modelos/Repository |
| **[Lautaro Tonini]** | Backend |API Flask,  tests backend, sincronización, Swagger, rate limit, tests backend|
| **[Adriano Oyola]** | Frontend | Login, rutas protegidas, layout responsive, integración con la API |
| **[Grego Bizzotto]** | Frontend | Vistas de pacientes/medicamentos/alarmas, componentes reutilizables, pruebas frontend |


---

## Flujo de prueba rápido

1. `POST /auth/registro` (rol `paciente`) → guardar `id` y `codigo_vinculacion`.
2. `POST /auth/registro` (rol `cuidador`) → `POST /auth/login`.
3. `POST /cuidador/pacientes/vincular` con `paciente_id` + código.
4. `POST /pacientes/{id}/medicamentos` → `POST /medicamentos/{id}/alarmas`.
5. `GET /emergencia/{id}` (sin token).
6. Varios logins fallidos seguidos → respuesta **429** (límite de intentos).

---
## Tecnologías utilizadas

### Backend
| Tecnología | Uso |
|------------|-----|
| **Python** | Lenguaje principal del servidor |
| **Flask** | Framework web / API REST |
| **MongoDB** + **PyMongo** | Base de datos NoSQL y driver |
| **Pydantic** | Validación de datos de entrada |
| **PyJWT** | Tokens JWT (header `Authorization: Bearer ...`) con vencimiento |
| **bcrypt** | Hash seguro de contraseñas |
| **Flasgger** | Documentación OpenAPI / Swagger (`/docs`) |
| **pytest** + **mongomock** | Pruebas unitarias y end-to-end |
| **python-dotenv** | Variables de entorno (`.env`) |
| **Gunicorn** | Servidor WSGI en producción (opcional) |

### Frontend
| Tecnología | Uso |
|------------|-----|
| **JavaScript** | Lenguaje del cliente |
| **React** | Biblioteca de interfaz de usuario |
| **Vite** | Herramienta de desarrollo y build |
| **React Router** | Rutas y secciones protegidas (si aplica en el proyecto) |
| **React Testing Library / Jest** | Pruebas del frontend (según consigna) |

### Herramientas de apoyo al desarrollo
| Herramienta | Uso |
|-------------|-----|
| **Git / GitHub** | Control de versiones y entrega del repositorio |
| **Postman / Thunder Client** | Pruebas manuales de la API |
| **Wireshark** | Análisis de tráfico de red (login y llamadas a la API) |
| **Grok (xAI)** | Asistencia en diseño, seguridad, patrones y documentación |
| **Claude (Anthropic)** | Asistencia en desarrollo y revisión de código |

### Seguridad y buenas prácticas asociadas
- Token JWT en header `Authorization`, con vencimiento configurable.
- Contraseñas solo con hash bcrypt; nunca en texto plano.
- No registrar en logs contraseñas, tokens ni datos clínicos innecesarios.
- Capturas de Wireshark **sin** contraseñas, tokens completos ni datos reales de pacientes.
- Secretos y CORS configurados por variables de entorno.

---


## Enlaces útiles

| Recurso | Ruta |
|---------|------|
| README detallado del backend | [backend/README.md](./backend/README.md) |
| Swagger | http://localhost:5000/docs |
| Variables de entorno de ejemplo | `backend/.env.example` |

---

**Fecha de entrega del TP:** 02/11/2026  
**Materia:** Programación II — Trabajo Práctico Integrador  
**Institución:** / IES 9-023
