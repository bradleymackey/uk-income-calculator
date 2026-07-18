import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { nitro } from 'nitro/vite';
import { resolve } from 'path';

const baseURL = '/tools/tax/';

export default defineConfig({
  base: baseURL,
  plugins: [tailwindcss(), tanstackStart(), nitro({ baseURL }), react()],
  resolve: {
    alias: {
      '~': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
  },
});
