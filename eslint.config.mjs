import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Supabase CLI가 로컬 스택을 띄울 때 만드는 임시 파일. 우리 코드가 아니다.
      "supabase/.temp/**",
      "scripts/gen-vapid.cjs",
    ],
  },
];

export default eslintConfig;
