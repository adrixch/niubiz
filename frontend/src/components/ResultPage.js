import React, { useMemo } from "react";

/**
 * Lee todos los query params de la URL y los devuelve como objeto.
 */
function useQueryParams() {
  return useMemo(() => {
    const params = {};
    const hash = window.location.hash; // "#/result?key=val&..."
    const queryString = hash.includes("?") ? hash.split("?")[1] : window.location.search.slice(1);
    new URLSearchParams(queryString).forEach((value, key) => {
      params[key] = value;
    });
    return params;
  }, []);
}

/**
 * Interpreta el código de acción de Niubiz:
 *   000 → Aprobado
 *   005 → Rechazado
 *   otros → Pendiente / desconocido
 */
function parseResult(params) {
  const action = params.action || params.actionCode || "";
  const errorCode = params.errorCode || params.responseCode || "";
  const status = (params.status || params.transactionStatus || "").toLowerCase();
  const hasAuthCode = Boolean(params.authorization || params.authorizationCode);
  const hasTransactionId = Boolean(params.transactionId || params.transactionToken);

  const successStatuses = ["approved", "authorized", "success", "completed", "completado"];
  const normalizedStatusTokens = status
    .split(/[^a-z0-9]+/i)
    .map((value) => value.trim())
    .filter(Boolean);
  const hasSuccessfulStatus = normalizedStatusTokens.some((value) => successStatuses.includes(value));
  const isRejectedAction = ["002", "005", "100", "101"].includes(action);

  if (isRejectedAction) {
    return { type: "error", icon: "❌", label: "Pago rechazado" };
  }

  const hasAuthFallbackSuccess =
    hasAuthCode && hasTransactionId && !errorCode && action !== "005" && !isRejectedAction;

  if (action === "000" || errorCode === "000" || hasSuccessfulStatus || hasAuthFallbackSuccess) {
    return { type: "success", icon: "✅", label: "Pago aprobado" };
  }
  return { type: "pending", icon: "⏳", label: "Pago pendiente" };
}

// Claves que queremos mostrar en la tabla (en orden)
const DISPLAY_KEYS = [
  ["purchaseNumber", "N° de orden"],
  ["amount", "Monto"],
  ["currency", "Moneda"],
  ["action", "Código de acción"],
  ["transactionId", "ID de transacción"],
  ["authorization", "Autorización"],
  ["brand", "Marca de tarjeta"],
  ["pan", "Tarjeta (enmascarada)"],
];

export default function ResultPage() {
  const params = useQueryParams();
  const result = parseResult(params);

  return (
    <div className="card">
      {/* Aviso de confirmación de pago exitoso */}
      {result.type === "success" && (
        <div className="confirmation-banner">
          <div className="confirmation-banner__check">✓</div>
          <p className="confirmation-banner__title">¡Compra completada con éxito!</p>
          <p className="confirmation-banner__msg">
            Tu compra fue procesada exitosamente. Recibirás un correo de confirmación en breve.
          </p>
        </div>
      )}

      {/* Ícono y título */}
      <div className="result-icon">{result.icon}</div>
      <h1 className={`result-title result-title--${result.type}`}>
        {result.label}
      </h1>
      <p className="result-detail">
        {result.type === "success" && "Tu transacción fue procesada correctamente."}
        {result.type === "error" && "La transacción no pudo completarse. Intenta nuevamente."}
        {result.type === "pending" && "Tu transacción está siendo procesada."}
      </p>

      {/* Detalle de la transacción */}
      {Object.keys(params).length > 0 && (
        <div className="result-params">
          {DISPLAY_KEYS.filter(([key]) => params[key]).map(([key, label]) => (
            <div className="result-params__row" key={key}>
              <span className="result-params__key">{label}</span>
              <span className="result-params__val">{params[key]}</span>
            </div>
          ))}

          {/* Mostrar cualquier clave extra que no esté en DISPLAY_KEYS */}
          {Object.entries(params)
            .filter(([key]) => !DISPLAY_KEYS.some(([k]) => k === key))
            .map(([key, val]) => (
              <div className="result-params__row" key={key}>
                <span className="result-params__key">{key}</span>
                <span className="result-params__val">{val}</span>
              </div>
            ))}
        </div>
      )}

      {/* Botón para volver */}
      <button className="btn-back" onClick={() => (window.location.href = "/")}>
        ← Volver al inicio
      </button>

      <div style={{ marginTop: 16 }}>
        <span className="sandbox-badge">⚠️ Ambiente SANDBOX</span>
      </div>
    </div>
  );
}
