import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./styles/globals.css"
import AppQueryClientProvider from "./providers/AppQueryClientProvider"
import { ReactFlowProvider } from "@xyflow/react"

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <AppQueryClientProvider>
            <ReactFlowProvider>
                <App />
            </ReactFlowProvider>
        </AppQueryClientProvider>
    </React.StrictMode>
)
