import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'apps/forecaster-ui/dist')
const destination = resolve(root, 'apps/payload/public/forecast')

if (!existsSync(source)) {
  throw new Error('Build the forecaster UI before staging it into Payload.')
}

rmSync(destination, { force: true, recursive: true })
mkdirSync(destination, { recursive: true })
cpSync(source, destination, { recursive: true })

