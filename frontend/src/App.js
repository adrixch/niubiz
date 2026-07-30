import React from "react";
import CheckoutPage from "./components/CheckoutPage";
import ResultPage from "./components/ResultPage";
import "./App.css";

function App() {
  const { pathname } = window.location;
  const hash = window.location.hash;
  const isResultRoute =
    hash.startsWith("#/result") || pathname === "/result";

  return isResultRoute ? <ResultPage /> : <CheckoutPage />;
  }

export default App;
