import { spawn } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
function spawnShell(label, command) {
  const child = spawn(command, {
    cwd: rootDir,
    env: process.env,
    stdio: 'inherit',
    shell: true,
  })

  child.on('exit', (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`
    console.log(`[start] ${label} exited with ${reason}`)
  })

  return child
}

const nextProc = spawnShell('next', 'npm run start:next')
const wsProc = spawnShell('ws', 'node ws-server/index.js')

function shutdown(code = 0) {
  if (nextProc && !nextProc.killed) nextProc.kill('SIGTERM')
  if (wsProc && !wsProc.killed) wsProc.kill('SIGTERM')
  setTimeout(() => process.exit(code), 300)
}

nextProc.on('exit', (code) => shutdown(code ?? 0))
wsProc.on('exit', (code) => shutdown(code ?? 0))

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
