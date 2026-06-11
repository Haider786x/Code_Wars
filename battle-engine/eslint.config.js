import globals from "globals";
import pluginJs from "@eslint/js";

export default [
  {
    ignores: ["node_modules/", "dist/", "load-tests/"]
  },
  {languageOptions: { globals: { ...globals.node, ...globals.jest } }},
  pluginJs.configs.recommended,
  {
    rules: {
      "no-unused-vars": "warn",
      "no-undef": "error",
      "no-console": "off"
    }
  }
];
