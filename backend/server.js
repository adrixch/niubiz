require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_RESULT_URL = process.env.FRONTEND_RESULT_URL || "http://localhost:3000/result.html";
const NIUBIZ_AUTHORIZATION_URL =
  process.env.NIUBIZ_AUTHORIZATION_URL ||
  "https://apisandbox.vnforappstest.com/api.authorization/v3/authorization/ecommerce";

app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001", "https://niubiz.vercel.app"] }));
app.use(express.json());
// Niubiz devuelve el transactionToken como POST de formulario hacia `action`.
app.use(express.urlencoded({ extended: true }));

// Órdenes generadas en /api/session, a la espera de autorización.
// Guardamos el monto en el servidor para no confiar en lo que vuelve del navegador.
const pendingOrders = new Map();
const ORDER_TTL_MS = 30 * 60 * 1000;

function rememberOrder(purchaseNumber, amount) {
  pendingOrders.set(purchaseNumber, { amount, createdAt: Date.now() });
  for (const [key, value] of pendingOrders) {
    if (Date.now() - value.createdAt > ORDER_TTL_MS) pendingOrders.delete(key);
  }
}

function buildBasicAuth() {
  const credentials = `${process.env.NIUBIZ_USER}:${process.env.NIUBIZ_PASSWORD}`;
  return Buffer.from(credentials).toString("base64");
}

async function fetchSecurityToken() {
  const response = await axios.get(process.env.NIUBIZ_SECURITY_URL, {
    headers: {
      Authorization: `Basic ${buildBasicAuth()}`,
      "Content-Type": "application/json",
    },
  });
  return response.data;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/token", async (_req, res) => {
  try {
    const token = await fetchSecurityToken();

    if (!token) {
      return res.status(502).json({ error: "No se recibió token de Niubiz" });
    }

    return res.json({ token });
  } catch (err) {
    console.error("[/api/token] Error:", err?.response?.data || err.message);
    return res.status(err?.response?.status || 500).json({
      error: "Error al obtener token de seguridad",
      detail: err?.response?.data || err.message,
    });
  }
});


app.post("/api/session", async (req, res) => {

  let { token, amount = 10.0 } = req.body;

  if (!token) {
    try {
      token = await fetchSecurityToken();
    } catch (err) {
      console.error("[/api/session] Error obteniendo token:", err?.response?.data || err.message);
      return res.status(502).json({
        error: "No se pudo obtener token de seguridad",
        detail: err?.response?.data || err.message,
      });
    }
  }

  const merchantId = process.env.NIUBIZ_MERCHANT_ID;
  const sessionUrl = `${process.env.NIUBIZ_ECOMMERCE_URL}/${merchantId}`;

  const purchaseNumber = String(Date.now()).slice(-12);

  const payload = {
    channel: "web",
    amount: parseFloat(amount).toFixed(2),
    currency: "PEN",
    antifraud: {
      clientIp: req.ip || "127.0.0.1",
      merchantDefineData: {
        MDD4: "user@demo.com",
        MDD21: "0",
        MDD32: purchaseNumber,
        MDD75: "Registrado",
        MDD77: "1",
      },
    },

    redirecturl: FRONTEND_RESULT_URL
  };

  try {
    const response = await axios.post(sessionUrl, payload, {
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    });

    const { sessionKey } = response.data;

    if (!sessionKey) {
      return res.status(502).json({ error: "No se recibió sessionKey de Niubiz" });
    }

    const finalAmount = parseFloat(amount).toFixed(2);
    rememberOrder(purchaseNumber, finalAmount);

    return res.json({
      sessionToken: sessionKey,
      purchaseNumber,
      amount: finalAmount,
      merchantId,
    });
  } catch (err) {
    console.error("[/api/session] Error:", err?.response?.data || err.message);
    return res.status(err?.response?.status || 500).json({
      error: "Error al crear sesión de pago",
      detail: err?.response?.data || err.message,
    });
  }
});

/**
 * Destino del `action` del checkout de Niubiz.
 * Niubiz envía aquí un POST de formulario con el transactionToken; nosotros
 * autorizamos la transacción y redirigimos al frontend con el resultado.
 */
app.post("/api/authorization", async (req, res) => {
  const transactionToken = req.body.transactionToken || req.body.tokenId;
  const purchaseNumber = req.query.purchaseNumber || req.body.purchaseNumber;

  const redirectWith = (params) => {
    const url = new URL(FRONTEND_RESULT_URL);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    });
    return res.redirect(303, url.toString());
  };

  if (!transactionToken || !purchaseNumber) {
    console.error("[/api/authorization] Faltan datos:", { transactionToken, purchaseNumber });
    return redirectWith({
      action: "999",
      errorMessage: "No se recibió el token de transacción",
      purchaseNumber,
    });
  }

  const stored = pendingOrders.get(purchaseNumber);
  const amount = stored?.amount || req.query.amount;

  if (!amount) {
    console.error("[/api/authorization] Orden desconocida:", purchaseNumber);
    return redirectWith({
      action: "999",
      errorMessage: "La orden expiró o no existe",
      purchaseNumber,
    });
  }

  const merchantId = process.env.NIUBIZ_MERCHANT_ID;

  try {
    const token = await fetchSecurityToken();

    const { data } = await axios.post(
      `${NIUBIZ_AUTHORIZATION_URL}/${merchantId}`,
      {
        channel: "web",
        captureType: "manual",
        countable: true,
        order: {
          tokenId: transactionToken,
          purchaseNumber,
          amount: parseFloat(amount),
          currency: "PEN",
        },
      },
      {
        headers: {
          Authorization: token,
          "Content-Type": "application/json",
        },
      }
    );

    pendingOrders.delete(purchaseNumber);

    const dataMap = data?.dataMap || {};
    console.log("[/api/authorization] Aprobada:", purchaseNumber, dataMap.ACTION_CODE);

    return redirectWith({
      action: dataMap.ACTION_CODE || "000",
      purchaseNumber,
      amount,
      currency: "PEN",
      transactionId: dataMap.TRANSACTION_ID,
      authorization: dataMap.AUTHORIZATION_CODE,
      brand: dataMap.BRAND,
      pan: dataMap.CARD,
    });
  } catch (err) {
    // Un rechazo llega como HTTP 4xx con el detalle en data.data
    const detail = err?.response?.data;
    const dataMap = detail?.data || {};
    console.error("[/api/authorization] Error:", detail || err.message);

    return redirectWith({
      action: dataMap.ACTION_CODE || "999",
      errorMessage: dataMap.ACTION_DESCRIPTION || detail?.errorMessage || "No se pudo autorizar el pago",
      purchaseNumber,
      amount,
      currency: "PEN",
      transactionId: dataMap.TRANSACTION_ID,
      brand: dataMap.BRAND,
      pan: dataMap.CARD,
    });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Backend Niubiz corriendo en http://localhost:${PORT}`);
  console.log(`   MerchantID : ${process.env.NIUBIZ_MERCHANT_ID}`);
  console.log(`   Ambiente   : SANDBOX\n`);
});
      