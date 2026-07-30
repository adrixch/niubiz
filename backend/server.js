require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3001;
const FRONTEND_RESULT_URL = process.env.FRONTEND_RESULT_URL || "http://localhost:3000/result.html";

app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001"] }));
app.use(express.json());

function buildBasicAuth() {
  const credentials = `${process.env.NIUBIZ_USER}:${process.env.NIUBIZ_PASSWORD}`;
  return Buffer.from(credentials).toString("base64");
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.post("/api/token", async (_req, res) => {
  try {
    const response = await axios.get(process.env.NIUBIZ_SECURITY_URL, {
      headers: {
        Authorization: `Basic ${buildBasicAuth()}`,
        "Content-Type": "application/json",
      },
    });

    const token = response.data;

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
      const tokenRes = await axios.get(process.env.NIUBIZ_SECURITY_URL, {
        headers: {
          Authorization: `Basic ${buildBasicAuth()}`,
          "Content-Type": "application/json",
        },
      });
      token = tokenRes.data;
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

    return res.json({
      sessionToken: sessionKey,
      purchaseNumber,
      amount: parseFloat(amount).toFixed(2),
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

app.listen(PORT, () => {
  console.log(`\n🚀 Backend Niubiz corriendo en http://localhost:${PORT}`);
  console.log(`   MerchantID : ${process.env.NIUBIZ_MERCHANT_ID}`);
  console.log(`   Ambiente   : SANDBOX\n`);
});
      