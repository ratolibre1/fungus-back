# Fungus API

Backend para el proyecto Fungus.

## Requisitos

- Node.js (v18 o superior)
- MongoDB (local o en la nube)

## Instalación

1. Clonar el repositorio
```bash
git clone https://github.com/ratolibre1/fungus-back.git
cd fungus-back
```

2. Instalar dependencias
```bash
npm install
```

3. Configurar variables de entorno
Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:
```
PORT=3000
MONGO_URI=mongodb://localhost:27017/fungus
NODE_ENV=development
```

## Desarrollo

Para iniciar el servidor en modo desarrollo:
```bash
npm run dev
```

## Compilar para producción

Para compilar el código TypeScript:
```bash
npm run build
```

Para iniciar el servidor en modo producción:
```bash
npm start
```

## Estructura del proyecto

```
fungus-back/
├── src/
│   ├── config/        # Configuraciones del proyecto
│   ├── controllers/   # Controladores de la API
│   ├── middleware/    # Middleware personalizados
│   ├── models/        # Modelos de datos (Mongoose)
│   ├── routes/        # Rutas de la API
│   └── index.ts       # Punto de entrada de la aplicación
├── .env               # Variables de entorno
├── .gitignore         # Archivos ignorados por Git
├── package.json       # Dependencias y scripts
├── tsconfig.json      # Configuración de TypeScript
└── README.md          # Documentación
```