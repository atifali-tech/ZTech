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
    },
  },
]);

export default eslintConfig;
