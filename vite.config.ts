import { defineConfig } from 'vite';

// relative base so the build also works inside an Electron/Steam wrapper
export default defineConfig({
  base: './',
});
