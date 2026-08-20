import { createServer } from 'node:net'

/**
 * An unused TCP port on the loopback interface.
 *
 * Bind to port 0, ask the OS what it gave us, release it. There is a window
 * between releasing and the caller binding, so this is not airtight — but the
 * suite runs a handful of servers on one machine, and the alternative (a fixed
 * port) collides with whatever the developer already has running, which is the
 * failure that actually happens.
 */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        server.close()
        reject(new Error('Could not determine a free port'))
        return
      }
      const { port } = address
      server.close(() => resolve(port))
    })
  })
}
