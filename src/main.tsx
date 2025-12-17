import { createRoot } from "react-dom/client";
import { ErrorBoundary } from "react-error-boundary";
import App from "./App.tsx";
import "./index.css";
import { ErrorFallback } from "./components/ErrorFallback";

createRoot(document.getElementById("root")!).render(
    <ErrorBoundary FallbackComponent={ErrorFallback}>
        <App />
    </ErrorBoundary>
);
