# InGuard - Backend (Sprint 1)

Python + Flask + MongoDB, arquitectura MVC.

| Tarea Jira | Funcionalidad | Endpoints |
|---|---|---|
| SCRUM-42 | Gestionar medicamentos | `/pacientes/{id}/medicamentos`, `/medicamentos/{id}` |
| SCRUM-43 | Crear alarmas de medicacion | `/medicamentos/{id}/alarmas`, `/pacientes/{id}/alarmas`, `/alarmas/{id}` |
| SCRUM-39 | Ver datos importantes (pantalla de bloqueo) | `GET /emergencia/{paciente_id}` (sin login) |
| SCRUM-46 | Edicion de informacion del paciente | `GET/PUT /pacientes/{id}` |
| SCRUM-52 | Contactos de emergencia + llamarlos | `/pacientes/{id}/contactos`, `/contactos/{id}/llamar` |

Extra necesario: `/auth/registro|login|me`, `/cuidador/pacientes/...` (vincular), `/sync`.

## Cliente React
El frontend consume el contrato `/app/*`, expuesto por `app/routes/web_routes.py`:
- `POST /app/auth/registro|login|recuperar|restablecer`
- `GET /app/snapshot` (requiere token Bearer de cuidador o dispositivo)
- `POST /app/solicitudes`, `POST /app/solicitudes/{id}/respuesta`, `DELETE /app/solicitudes/{id}`
- `/app/pacientes` para crear, editar y eliminar pacientes, regenerar códigos, administrar medicación y contactos, registrar tomas y probar alarmas.

El frontend usa `http://localhost:5000` por defecto. Para cambiarlo, definir `VITE_API_URL` en `frontend/.env.local`. Configurar `CORS_ORIGINS` con el origen de Vite (por defecto `http://localhost:5173`) al desplegar.

## Estructura MVC
```
app/
  models/       -> acceso a datos (MongoDB)         [M]
  controllers/  -> logica de negocio y permisos     [C]
  routes/       -> endpoints HTTP (Blueprints)      [rutas]
  views.py      -> serializacion JSON de respuesta  [V]
  schemas.py    -> validacion de entradas (Pydantic)
  validation.py -> helper que valida el JSON del request
  dependencies.py -> decoradores @login_requerido / @cuidador_requerido
  errors.py     -> ApiError (errores JSON controlados)
  services/sync_service.py -> sincronizacion local <-> nube
```

## Correr
```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # editar JWT_SECRET y MONGO_CLOUD_URI
python run.py               # desarrollo (FLASK_DEBUG=1 para recarga automatica)
# produccion: gunicorn -w 1 --threads 4 "run:app"
```
Probar con Postman / Thunder Client / curl. Los endpoints protegidos necesitan el header
`Authorization: Bearer <access_token>` (se obtiene en `/auth/login`).
Errores siempre en JSON: `{"detail": ...}` (422 si falla la validacion, con el detalle por campo).

## Roles
- **paciente**: solo ve/edita sus propios datos. Al registrarse recibe un `codigo_vinculacion`.
- **cuidador**: tiene `pacientes_ids` (lista de id_paciente). Se vincula con
  `POST /cuidador/pacientes/vincular {paciente_id, codigo_vinculacion}`.

## MongoDB Atlas (BD principal)
1. Atlas > Database Access: crear un usuario con permiso *readWrite*.
2. Atlas > Network Access: agregar tu IP (o `0.0.0.0/0` solo para pruebas).
3. Atlas > Connect > Drivers: copiar la URI `mongodb+srv://...` y pegarla en `MONGO_LOCAL_URI` de `.env`.
4. `pip install -r requirements.txt` y `python check_db.py` (prueba la conexion y crea los indices).
5. `python run.py`. Los datos quedan en la base `MONGO_LOCAL_DB` (por defecto `inguard`).

## BD local + nube
- Toda lectura/escritura va a la BD **local** => la app funciona sin internet.
- Cada documento tiene `actualizado_en`, `sync_pendiente` y `eliminado` (borrado logico).
- Cada `SYNC_INTERVALO_SEG` (hilo en segundo plano) (o con `POST /sync`) se hace: subir pendientes -> bajar cambios de la nube.
- Conflictos: gana la modificacion mas reciente (last-write-wins).
- Si `MONGO_CLOUD_URI` esta vacio, funciona solo en local.
- Login en un equipo nuevo: si el usuario no esta en local, se busca en la nube.

## Flujo de prueba rapido
1. `POST /auth/registro` rol `paciente` -> guarda `id` y `codigo_vinculacion`
2. `POST /auth/registro` rol `cuidador`, luego `POST /auth/login`
3. `POST /cuidador/pacientes/vincular`
4. `POST /pacientes/{id}/medicamentos` -> `POST /medicamentos/{id}/alarmas`
5. `POST /pacientes/{id}/contactos`
6. `GET /emergencia/{id}` (sin token)
