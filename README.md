# Integración Niubiz Sandbox — React + Node.js

## Estructura del proyecto

```
niubiz/
├── backend/
│   ├── .env          ← Credenciales (no subir a git)
│   ├── package.json
│   └── server.js     ← API Express
└── frontend/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── App.js
    │   ├── App.css
    │   └── components/
    │       ├── CheckoutPage.js
    │       └── ResultPage.js
    └── package.json
```

---

## Instalación y ejecución

### Terminal 1 — Backend

```bash
cd backend
npm install
npm start          # Puerto 3001
# o en modo watch:
npm run dev
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm start          # Puerto 3000
```

Abrir: **http://localhost:3000**

---

## Flujo de pago

```
Usuario hace clic en "Pagar ahora"
        │
        ▼
Frontend → POST /api/session (backend)
        │
        ▼
Backend obtiene token de Niubiz Security API
Backend crea sesión en Niubiz Ecommerce API
        │
        ▼
Frontend recibe { sessionToken, purchaseNumber, amount }
        │
        ▼
Frontend carga script checkout.js de Niubiz
Frontend llama a VisanetCheckout.open()
        │
        ▼
Niubiz muestra formulario de pago emergente
        │
        ▼
Usuario ingresa datos de tarjeta
        │
        ▼
Niubiz llama callback complete(params)
Frontend redirige a /result?...params
```

---

## Tarjetas de prueba (Sandbox)

| Resultado  | Número de tarjeta      | Vencimiento | CVV |
|------------|------------------------|-------------|-----|
| Aprobado   | 4111 1111 1111 1111    | 12/2030     | 123 |
| Rechazado  | 4000 0000 0000 0002    | 12/2030     | 123 |
| Sin fondos | 4000 0000 0000 9995    | 12/2030     | 123 |

---

## Endpoints del backend

| Método | Ruta          | Descripción                          |
|--------|---------------|--------------------------------------|
| GET    | /health       | Verificar que el servidor está activo |
| POST   | /api/token    | Obtener token de seguridad Niubiz     |
| POST   | /api/session  | Crear sesión de pago y obtener sessionToken |

### POST /api/session

**Body (opcional):**
```json
{ "amount": 10.00 }
```

**Respuesta exitosa:**
```json
{
  "sessionToken": "abc123...",
  "purchaseNumber": "ORD-1234567890",
  "amount": "10.00",
  "merchantId": "456879852"
}
```

---

## Notas importantes

- El proxy en `frontend/package.json` redirige `/api/*` → `http://localhost:3001`
- Las credenciales en `.env` son exclusivas de sandbox — no producción
- El script de Niubiz se carga con `?qa=true` para el ambiente de pruebas
- `redirecturl` en la sesión debe coincidir con una URL válida del frontend
