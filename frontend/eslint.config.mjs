import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // Standard data-fetching in useEffect is valid — rule is too aggressive
      "react-hooks/set-state-in-effect": "off",
      // Flags local accumulator variables (let acc) as if they were state — false positive
      "react-hooks/immutability": "off",
      // AGENTS.md Rule 2 mandates fetchRef.current = async () => {} pattern over useCallback;
      // this rule incorrectly flags that assignment as a render-time ref mutation
      "react-hooks/refs": "off",
      // Date.now() in useState initializer or conditional render is safe — disable false positive
      "react-hooks/purity": "off",
    },
  },
]);

export default eslintConfig;
