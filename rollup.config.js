import commonjs from '@rollup/plugin-commonjs'
import terser from '@rollup/plugin-terser'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const config = {
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true }), terser()]
}

export default config
