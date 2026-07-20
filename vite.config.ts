import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // In dev the SPA is served by Vite; proxy the assistant API to the Node
    // server (npm start) so the chat works end-to-end during development.
    proxy: {
      '/api/assistant': 'http://localhost:3000',
    },
  },
});
