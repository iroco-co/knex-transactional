import commonjs from "@rollup/plugin-commonjs";
import typescript from "@rollup/plugin-typescript";
import resolve from "@rollup/plugin-node-resolve";
import { terser } from "rollup-plugin-terser";
import peerDepsExternal from "rollup-plugin-peer-deps-external";
import sourcemaps from "rollup-plugin-sourcemaps";

const extensions = [".js", ".ts"];
const external = ["knex", "async_hooks"];

export default {
  input: "src/index.ts",
  output: [
    {
      file: "dist/index.js",
      format: "cjs",
      sourcemap: true,
    },
    {
      file: "dist/index.esm.js",
      format: "es",
      sourcemap: true,
    },
    {
      file: "dist/index.min.js",
      format: "umd",
      name: "knex-transactional",
      globals: {
        knex: "knex",
        async_hooks: "async_hooks",
      },
      plugins: [terser()],
      sourcemap: true,
    },
  ],
  external,
  plugins: [
    peerDepsExternal(),
    resolve({ extensions, preferBuiltins: true }),
    commonjs(),
    typescript({
      tsconfig: "./tsconfig.json",
      declaration: true,
      declarationDir: "./dist/types",
      module: "ESNext",
    }),
    sourcemaps(),
  ],
};
