import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  server: { // Add server configuration
    proxy: {
      '/api/notion': {
        target: 'https://api.notion.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/notion/, ''),
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            // Extract custom header from client request
            const notionAuth = req.headers['notion-auth'] as string;
            const notionVersion = req.headers['notion-version'] as string || '2022-06-28'; // Default if not provided

            if (notionAuth) {
              // Remove the custom header
              proxyReq.removeHeader('notion-auth');
              // Set the standard Authorization header for Notion API
              proxyReq.setHeader('Authorization', `Bearer ${notionAuth}`);
            }
            // Ensure Notion-Version is set
            proxyReq.setHeader('Notion-Version', notionVersion);
            // proxyReq.removeHeader('notion-version'); // DO NOT remove the header we just set

            // Log headers for debugging (optional)
            // console.log('Proxying request to Notion API:');
            // console.log('  URL:', options.target + proxyReq.path);
            // console.log('  Headers:', proxyReq.getHeaders());
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
});
