import js from "@eslint/js"
import reactHooks from "eslint-plugin-react-hooks"
import globals from "globals"
import tseslint from "typescript-eslint"

// Lint React Compiler (eslint-plugin-react-hooks v7) diturunkan ke "warn" dulu:
// ±17 titik set-state-in-effect warisan akan dibereskan bertahap di PR terpisah.
// rules-of-hooks & exhaustive-deps tetap pada level bawaannya (error).
const reactHooksRules = Object.fromEntries(
  Object.entries(reactHooks.configs.recommended.rules).map(([rule, level]) => [
    rule,
    rule === "react-hooks/rules-of-hooks" || rule === "react-hooks/exhaustive-deps"
      ? level
      : "warn",
  ]),
)

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "public/build/**",
      "vendor/**",
      "resources/js/types/ziggy-routes.d.ts",
      // File hasil generate (ziggy) — bukan kode tulisan tangan, jangan dilint.
      "resources/js/ziggy.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["resources/js/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["resources/js/**/*.{ts,tsx}", "tests/frontend/**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooksRules,
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
)
