// Bundles the MCP server, its SDK and Bruto's domain code into one file:
// `npx bruto-mcp` then starts without installing anything else.
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

await build({
  entryPoints: [fileURLToPath(new URL('./src/index.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('./dist/index.js', import.meta.url)),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  minify: true,
  legalComments: 'none',
  define: { __VERSION__: JSON.stringify(version) },
  banner: {
    // A few dependencies are CommonJS and still call require().
    js: "#!/usr/bin/env node\nimport { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
})

console.log(`bruto-mcp ${version} built`)
