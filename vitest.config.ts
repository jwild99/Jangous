import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
      "@": path.resolve(__dirname, "./client/src"),
    },
  },
  test: {
    include: [
      "shared/**/*.test.ts",
      "server/**/*.test.ts",
      "tests/**/*.test.{ts,tsx}",
      "client/**/*.test.{ts,tsx}",
    ],
    environment: "node",
  },
});
