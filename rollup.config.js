import { babel } from '@rollup/plugin-babel';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import json from '@rollup/plugin-json';
import { string } from '@backrunner/rollup-plugin-string';
import { terser } from 'rollup-plugin-terser';
import fs from 'fs';

const pkg = JSON.parse(fs.readFileSync('./package.json'));
const external = Object.keys(pkg.dependencies || {}).concat(['fs/promises']);

const extensions = ['.js', '.ts'];

export default {
  input: 'main.ts',
  output: {
    file: './bin/cli.js',
    format: 'cjs',
    banner: '#!/usr/bin/env node',
  },
  external,
  plugins: [
    nodeResolve({
      extensions,
      modulesOnly: true,
    }),
    json(),
    string({
      include: 'templates/**/*.ejs',
    }),
    babel({
      exclude: ['node_modules/**', './history/**'],
      babelHelpers: 'bundled',
      extensions,
    }),
    terser(),
  ],
};
