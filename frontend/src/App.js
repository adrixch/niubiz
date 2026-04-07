import React from "react";
import CheckoutPage from "./components/CheckoutPage";
import ResultPage from "./components/ResultPage";
import "./App.css";

function App() {
  const hash = window.location.hash;
  return hash.startsWith("#/result") ? <ResultPage /> : <CheckoutPage />;
}

export default App;
