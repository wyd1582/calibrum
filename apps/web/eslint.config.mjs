import nextConfig from "eslint-config-next";

const config = [{ ignores: [".next/**", "node_modules/**", "next-env.d.ts"] }, ...nextConfig];
export default config;
