import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// basicSsl generates a locally-trusted cert so `npm run dev -- --host` is a
// secure context from other devices on the LAN too — the Web Crypto API
// (api/crypto.ts) throws on plain http:// unless the host is localhost.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), ...(command === 'serve' ? [basicSsl()] : [])],
  base: '/language-learning-desktop-phrasebook/',
}));
