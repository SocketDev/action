import commonjs from '@rollup/plugin-commonjs'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const config = {
  plugins: [commonjs(), nodeResolve({ preferBuiltins: true })]
}

export default config
