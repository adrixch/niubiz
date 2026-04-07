import React, { useState } from "react";

const MERCHANT_ID = "456879852";

const NIUBIZ_SCRIPT_URL =
  "https://static-content-qas.vnforapps.com/v2/js/checkout.js?qa=true";

function loadNiubizScript() {
  return new Promise((resolve, reject) => {
    if (document.getElementById("niubiz-checkout-script")) {
      return resolve();
    }
    const script = document.createElement("script");
    script.id = "niubiz-checkout-script";
    script.src = NIUBIZ_SCRIPT_URL;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar el script de Niubiz"));
    document.head.appendChild(script);
  });
}

export default function CheckoutPage() {
  const [status, setStatus] = useState("idle"); 
  const [errorMsg, setErrorMsg] = useState("");

  const handlePay = async () => {
    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 10.0 }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Error HTTP ${res.status}`);
      }

      const { sessionToken, purchaseNumber, amount } = await res.json();

      if (!sessionToken) {
        throw new Error("No se recibió sessionToken del backend");
      }

      await loadNiubizScript();

      setStatus("idle");

      if (!window.VisanetCheckout) {
        throw new Error("El checkout de Niubiz no se inicializó correctamente");
      }

      window.VisanetCheckout.configure({
        action: "https://sandbox.vnforapps.com/v2/payments/visa",
        sessiontoken: sessionToken,
        channel: "web",
        merchantid: MERCHANT_ID,
        purchasenumber: purchaseNumber,
        amount: amount,
        currency: "PEN",
        description: "Producto Demo",
        timeouturl: "http://localhost:3000/result",
        complete: function (params) {
          console.log("[Niubiz] Resultado del pago:", params);
          const query = new URLSearchParams(params).toString();
           window.location.href = `/#/result?${query}`;
        },
      });

      window.VisanetCheckout.open();
    } catch (err) {
      console.error("[handlePay] Error:", err.message);
      setStatus("error");
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="card">
      {/* Encabezado */}
      <div className="card__logo">🛒</div>
      <h1 className="card__title">Producto Demo</h1>
      <p className="card__subtitle">Pago seguro con Niubiz</p>

      {/* Precio */}
      <div className="price-box">
        <p className="price-box__label">Total a pagar</p>
        <p className="price-box__amount">
          <span className="price-box__currency">S/</span>10.00
        </p>
      </div>

      {/* Botón de pago */}
      <button
        className="btn-pay"
        onClick={handlePay}
        disabled={status === "loading"}
      >
        {status === "loading" ? (
          <>
            <span className="spinner" />
            Preparando pago...
          </>
        ) : (
          "💳 Pagar ahora"
        )}
      </button>

      {/* Mensajes de estado */}
      {status === "loading" && (
        <div className="status-box status-box--loading">
          <p className="status-box__title">Conectando con Niubiz...</p>
          <p>Obteniendo sesión de pago segura.</p>
        </div>
      )}

      {status === "error" && (
        <div className="status-box status-box--error">
          <p className="status-box__title">Error al iniciar el pago</p>
          <p>{errorMsg}</p>
        </div>
      )}

      {/* Badge de ambiente */}
      <div>
        <span className="sandbox-badge">⚠️ Ambiente SANDBOX — No se realizan cobros reales </span>
      </div>
      </div>
  );
}
