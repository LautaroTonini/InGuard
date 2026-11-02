# InGuard

Aplicación de cuidado conectado con frontend React, API Flask y MongoDB.

**Backend:** Flask + MongoDB (offline-first), JWT, bcrypt, protección contra fuerza bruta, patrones Factory / Repository / Observer, Swagger en `/docs` y pruebas con pytest.

## Cómo levantar la app (Windows)

Necesitás **Python**, **Node.js/npm** y MongoDB instalado y en ejecución, o una URI de MongoDB Atlas.

### 1. Configurar y levantar el backend

En una terminal PowerShell, desde la raíz del proyecto:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Creá `backend/.env` (opcional pero recomendado):

```env
JWT_SECRET=un-secreto-largo-y-aleatorio
MONGO_LOCAL_URI=mongodb://localhost:27017
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Luego iniciá el servidor:

```powershell
python run.py
```

La API queda en `http://localhost:5000`. Documentación Swagger: `http://localhost:5000/docs`.  
Dejá esta terminal abierta.

### 2. Levantar el frontend

Abrí **otra** terminal PowerShell desde la raíz del proyecto:

```powershell
cd frontend
npm install
npm run dev
```

Abrí la dirección que muestra Vite, normalmente `http://localhost:5173`.  
Si la API está en otra URL, creá `frontend/.env.local` con:

```env
VITE_API_URL=http://localhost:5000
```

El origen del navegador (normalmente `http://localhost:5173`) debe estar incluido en `CORS_ORIGINS` del backend. Podés copiar `frontend/.env.example` como `frontend/.env.local` y reiniciar Vite después de cambiar la URL.

### 3. Probar

- Registrate como paciente y como cuidador.
- Vinculá con el código de vinculación.
- Creá medicamentos y alarmas.
- Probá el límite de intentos de login (varios fallos → HTTP 429).

### 4. Tests del backend

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pytest
```

Para más detalles (patrones de diseño, seguridad, roles, Wireshark, estructura MVC):  
→ [README del backend](./backend/README.md)
