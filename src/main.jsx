// Este é o ponto de entrada do site: prepara a página e entrega o controle ao React.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// O modo estrito ajuda a perceber usos problemáticos do React durante o desenvolvimento.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
