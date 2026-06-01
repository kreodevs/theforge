import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { ecmaVersion: "latest", sourceType: "module" },
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@theforge/component-source-orbita",
              message:
                "Import @theforge/component-source-orbita only from component-source.plugins.ts",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/modules/component-source/component-source.plugins.ts"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
];
