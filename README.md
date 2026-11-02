# Pricing

Suscripciones, pagos con Stripe y contratos de SPACE del SaaS de reconocimiento facial del TFM. Node.js, Express y MongoDB.

- **Contrato:** [`openapi/pricing.yaml`](openapi/pricing.yaml), 9 operaciones. Es la fuente de verdad: si el código y el contrato discrepan, se corrige el código.
- **Estado:** 2 de las 9 implementadas: `createCheckoutSession` y el receptor de eventos de Stripe (`handleStripeWebhook`), que al confirmarse una compra deja la cuenta en el plan comprado en SPACE, y al darse de baja, en FREE (`src/services/space.service.js`).
- **SPACE:** la tarifa está en [`pricing/`](pricing/) (Pricing2Yaml, con la versión fijada en `pricing/sphere.env`) y la imagen de SPACE v1.7.1 con sus parches, en [`space/`](space/).
- Parte de `node-template`, la plantilla de los microservicios Node.js del proyecto; de ahí la estructura que se describe abajo.

---

## 🌟 Arquitectura y Funcionalidades Integradas

El proyecto implementa las siguientes características clave para garantizar el estándar de calidad:

### 1. Clean Architecture y Estructura Modular

El código está dividido en capas lógicas estrictas para favorecer el mantenimiento y la escalabilidad (MVC modificado para APIs REST):

- **Rutas (`src/routes/`)**: Definen los endpoints de la API ("Public API" y "Solution-Internal API") y aplican middlewares.
- **Controladores (`src/controllers/`)**: Reciben las peticiones HTTP (`req`, `res`), validan flujos básicos y delegan la lógica al servicio.
- **Servicios (`src/services/`)**: Contienen la lógica de negocio pura, agnóstica a Express. Realizan las operaciones CRUD o de procesamiento.
- **Modelos (`src/models/`)**: Definen esquemas usando Mongoose para interactuar con MongoDB (siguiendo el patrón `Data Holder`).

### 2. Error Report Pattern (Manejo de Errores Global)

En lugar de manejar errores localmente en cada controlador, se centralizan:

- **`AppError` (`src/utils/AppError.js`)**: Clase extendida para lanzar errores operacionales (ej. `new AppError("User not found", 404)`).
- **`errorHandler` (`src/middlewares/errorHandler.js`)**: Interceptador global en `src/app.js` que estandariza todas las respuestas de error como `{ code, message, details? }`, el esquema `ErrorReport` del contrato. Evita fugas de información de stack trace en producción.
- **`notFound` (`src/middlewares/notFound.js`)**: Captura peticiones a rutas inexistentes y lanza un error `404`.

### 3. Validación Estricta con Joi

Validación declarativa de datos de entrada (`req.body`, `req.query`, `req.params`) para evitar inyecciones e inconsistencias:

- Interceptada por el middleware **`validate` (`src/middlewares/validate.js`)**.
- Los fallos en esquemas Joi son procesados por el gestor de errores devolviendo código `400 Bad Request` y los detalles específicos de qué campos fallaron.

### 4. Seguridad Activa (Security First)

Implementado globalmente en `src/app.js`:

- **Helmet**: Protege aplicando headers HTTP seguros.
- **CORS**: Habilita configuración controlada del intercambio cruzado de recursos.
- **Sin limitador propio**: el límite de peticiones lo aplica la pasarela (Kong) antes de que la petición llegue aquí; un segundo limitador solo repartiría al mismo cliente entre dos contadores.

### 5. Documentación (Swagger / OpenAPI)

La documentación se sirve desde `openapi/pricing.yaml`, el mismo fichero contra el que valida la suite de contrato; no se genera a partir de comentarios _JSDoc_.

- Interfaz en `/docs` y especificación en `/openapi.json` (configuradas vía `src/config/swagger.js`).

### 6. Calidad del Código y Git Hooks (Husky)

Se prohíbe subir código roto o mal formateado. Las herramientas actúan en pre-commit:

- **ESLint & Prettier**: Formatean y analizan la sintaxis (`lint-staged`).
- **Husky (`.husky/`)**:
  - `pre-commit`: Ejecuta `lint-staged` (ESLint y Prettier sobre lo preparado) y la suite de pruebas completa.
  - `commit-msg`: Exige convencionales (Conventional Commits: `feat:`, `fix:`, `chore:`) interceptado mediante `@commitlint/` para estandarizar el historial.

### 7. Integración y Despliegue Continuo (CI/CD)

Múltiples pipelines provistos vía GitHub Actions (`.github/workflows/`):

- **`ci-cd.yml`**: Disparado en cada push y pull request a `main`. Instala dependencias con `pnpm` (usando caché), pasa ESLint, la auditoría de seguridad de dependencias y las pruebas con cobertura.
- **`release.yml`**: Disparado al empujar una etiqueta `v*`. Compila la imagen de Docker, la sube a Docker Hub y crea la release de GitHub con notas generadas a partir de los Conventional Commits.

---

## 🚀 Cómo Ejecutar el Proyecto

El entorno utiliza **`pnpm`** como gestor de paquetes principal. Lo habitual es levantar `pricing` con el resto de la pila mediante `scripts/dev-up.sh` del repositorio [docs](https://github.com/TFM-MIS-MEM/docs), que genera los secretos que comparte con `auth` y la pasarela, levanta SPACE y emite su clave. Para levantarlo por separado:

### Prerrequisitos

- Node.js >= 20
- `pnpm` instalado (`npm install -g pnpm`)
- MongoDB (local, o el del compose de desarrollo)

```bash
pnpm install
```

### Configuración

```bash
# Copia .env.example en .env (sobrescribe el .env que haya)
pnpm run env:local
```

Después, sustituye los valores de ejemplo: `INTERNAL_API_SECRET` tiene que coincidir con el de `auth`, las claves de Stripe son las de tu cuenta de pruebas y `SPACE_API_KEY` la emite `space-bootstrap.sh`.

### Opción 1: Desarrollo Local (Hot-reload, MongoDB Local)

```bash
pnpm run dev   # escucha en el PORT del .env (3001 en .env.example)
```

No uses `pnpm run dev:local`: vuelve a copiar `.env.example` antes de arrancar y descarta los valores que hayas puesto.

### Opción 2: Desarrollo con Docker Compose

Levanta el servicio con recarga en caliente y su MongoDB. El servicio se publica en `127.0.0.1:3001`; MongoDB, en el puerto `27018` del anfitrión, en todas las interfaces y sin autenticación (TFM-MIS-MEM/docs#145).

```bash
docker network create tfm-network   # solo la primera vez
pnpm run docker:dev
```

`pnpm run env:compose` y `pnpm run dev:compose` fallan: copian `.env.docker-compose.example`, que no existe (TFM-MIS-MEM/docs#146).

### Opción 3: Entorno Producción (Docker Compose)

Compila usando el `Dockerfile` de producción (peso ligero, usuario non-root por seguridad). No publica el puerto del servicio, pero sí el `27017` de MongoDB en todas las interfaces (TFM-MIS-MEM/docs#145).

```bash
pnpm run docker:prod
```

---

## ✅ Lista de Comandos Disponibles

- `pnpm run dev`: Inicia Nodemon sin copiar variables de entorno previamente.
- `pnpm test`: Ejecuta Jest con los tests de integración y/u unitarios (busca en `/tests`).
- `pnpm run test:coverage`: Extrae reporte de cobertura del testeo.
- `pnpm run lint`: Busca anomalías en el código base.
- `pnpm run lint:fix`: Autocorrige fallos sintácticos (espaciados, comillas).
- `pnpm run format`: Prettier fuerza un formateo a lo largo de toda la fuente del proyecto de los archivos configurados (`*.js`).

---

## 🏗️ Estructura Completa del Directorio

```text
pricing-microservice/
├── .github/                # Workflows de CI/CD (GitHub Actions)
├── .husky/                 # Git hooks para validación de pre-commits y mensajes de commit
├── scripts/                # Scripts utilitarios (ej. automatizar copia de .env)
├── src/                    # Código fuente principal de la app
│   ├── app.js              # Inicialización de Express, Middlewares (limiter, helmet, cors) y logs
│   ├── server.js           # Orquestación global: Inicia conexión a MongoDB y asocia el puerto
│   ├── config/             # Variables de setup (env config, swagger UI)
│   ├── controllers/        # Controladores REST. Lógica de Request / Response (HTTP).
│   ├── middlewares/        # Piezas intermedias: Gestor de Errores Global, Validadores Joi.
│   ├── models/             # Esquemas relacionales con Mongoose
│   ├── routes/             # Orquestador de Paths expuestos
│   ├── services/           # Reglas de negocio y transacciones (Separado de Req/Res estricto)
│   └── utils/              # Clases y helpers: `AppError.js` custom error, Loggers, etc.
├── tests/                  # Entorno Jest y Supertest
├── Dockerfile              # Construcción multi-stage de producción
├── Dockerfile.dev          # Construcción en modo desarrollo
└── package.json            # Definición principal de Node para las abstracciones
```
