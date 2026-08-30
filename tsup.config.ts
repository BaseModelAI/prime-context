import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  external: ["@earendil-works/pi-coding-agent", "@earendil-works/pi-ai", "typebox"],
  noExternal: ["diff"],
});
