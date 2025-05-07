import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import dotenv from 'dotenv';
import { chatActionMiddleware } from "./server/api/notionChatHandler"; // Corrected import path

// Load environment variables from .env file
dotenv.config();

// Helper function to create a Vite plugin for adding middleware
function chatActionPlugin() {
  return {
    name: 'vite-plugin-chat-action',
    configureServer(server: import('vite').ViteDevServer) {
      // Add our middleware *before* Vite's internal middleware
      server.middlewares.use(chatActionMiddleware);
    }
  };
}

export default defineConfig(async () => { // Make config function async
  const cartographerPlugin =
    process.env.NODE_ENV !== "production" && process.env.REPL_ID !== undefined
      ? await import("@replit/vite-plugin-cartographer").then((m) =>
          m.cartographer()
        )
      : null;

  return { // Return the config object
    plugins: [
      react(),
      runtimeErrorOverlay(),
      chatActionPlugin(), // Add our custom plugin here
      ...(cartographerPlugin ? [cartographerPlugin] : []), // Conditionally add resolved plugin
    ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  server: {
    proxy: {
      '/api/notion': { // Keep the existing proxy for direct Notion calls
        target: 'https://api.notion.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            const notionAuth = req.headers['notion-auth'] as string;
            const notionVersion = req.headers['notion-version'] as string || '2022-06-28'; 

            if (notionAuth) {
              proxyReq.removeHeader('notion-auth');
              proxyReq.setHeader('Authorization', `Bearer ${notionAuth}`);
            }
            proxyReq.setHeader('Notion-Version', notionVersion);
          });
        }
      }
    }
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
}});
