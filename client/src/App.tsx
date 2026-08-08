import { lazy, Suspense } from "react";
import { Home } from "./screens/Home.js";

const Control = lazy(() => import("./screens/Control.js").then((module) => ({ default: module.Control })));
const Display = lazy(() => import("./screens/Display.js").then((module) => ({ default: module.Display })));

export function App() {
  const path = window.location.pathname;
  if (path === "/juego") return <Suspense fallback={<main className="display display--center" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><h1>Cargando pantalla…</h1></main>}><Display /></Suspense>;
  if (path === "/control" || path.startsWith("/control/")) return <Suspense fallback={<main className="mobile mobile--center" role="status" aria-live="polite"><div className="loader" aria-hidden="true" /><h1>Cargando control…</h1></main>}><Control /></Suspense>;
  return <Home />;
}
