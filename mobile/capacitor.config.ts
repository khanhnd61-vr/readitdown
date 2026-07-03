import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.readitdown.mobile",
  appName: "ReadItDown",
  webDir: "dist",
  backgroundColor: "#1e1e1e",
  android: {
    // Android 15 (target SDK 35) forces edge-to-edge; this keeps the webview
    // out from under the system bars on devices where the CSS safe-area
    // insets report 0.
    adjustMarginsForEdgeToEdge: "auto",
  },
};

export default config;
