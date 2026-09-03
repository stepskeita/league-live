import js from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/**
 * Shared base rules for all LeagueLive packages. Each package's own
 * eslint.config.mjs spreads this in alongside its framework-specific config
 * (eslint-config-next, eslint-config-expo, etc).
 */
const baseConfig = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default baseConfig;
