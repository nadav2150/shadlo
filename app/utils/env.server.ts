/**
 * Server-side environment variables
 * This file should only be imported in server-side code (files with .server.ts extension)
 */

// For now, we only need NODE_ENV which is handled by Remix/Vite
export const env = {
  NODE_ENV: 'development', // This will be overridden by the build process
}; 