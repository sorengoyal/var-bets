import js from "@eslint/js";
import typescriptEslint from "typescript-eslint";

export default typescriptEslint.config(
  js.configs.recommended,
  ...typescriptEslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  }
);
