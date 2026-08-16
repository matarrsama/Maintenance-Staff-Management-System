import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: __dirname,
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        index: path.resolve(__dirname, 'index.html'),
        dashboard: path.resolve(__dirname, 'dashboard.html'),
        'staff-directory': path.resolve(__dirname, 'staff-directory.html'),
        'add-staff': path.resolve(__dirname, 'add-staff.html'),
        'leave-roster': path.resolve(__dirname, 'leave-roster.html'),
        'request-manager': path.resolve(__dirname, 'request-manager.html'),
        reports: path.resolve(__dirname, 'reports.html'),
        settings: path.resolve(__dirname, 'settings.html'),
        profile: path.resolve(__dirname, 'profile.html'),
        notifications: path.resolve(__dirname, 'notifications.html'),
      },
    },
  },
})
