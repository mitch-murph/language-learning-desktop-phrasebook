import { createRoot } from 'react-dom/client';
import App from './App';
import { initNamespace } from './api/namespace';
import './index.css';

initNamespace();

createRoot(document.getElementById('root')!).render(<App />);
