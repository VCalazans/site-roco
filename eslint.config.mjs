import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "public/vendor/**", "coverage/**"],
  },
  {
    // Arquivos de teste mockam objetos parciais (ex.: Session sem `expires`);
    // suprimir a checagem via @ts-nocheck é aceitável NESSES arquivos apenas.
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
];

export default eslintConfig;
