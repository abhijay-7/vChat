import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  server: {
    host:true,
     https: {
      key: fs.readFileSync(path.resolve(__dirname, 'localhost.key')),   
      cert: fs.readFileSync(path.resolve(__dirname, 'localhost.crt')),  
    },
  },
  plugins: [
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
  ],
})
