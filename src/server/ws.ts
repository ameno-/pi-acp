import { AgentSideConnection } from '@agentclientprotocol/sdk'
import type { Stream } from '@agentclientprotocol/sdk'
import { WebSocketServer, type WebSocket } from 'ws'
import { PiAcpAgent } from '../acp/agent.js'
import http from 'http'

// Connection metadata
interface ConnectionMeta {
  id: string
  connectedAt: Date
  lastActivity: Date
  messageCount: number
  messageWindowStart: Date
  pingTimeout?: NodeJS.Timeout
  isAlive: boolean
}

// Configuration constants
const MAX_CONNECTIONS = 10
const IDLE_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const PING_INTERVAL_MS = 30000 // 30 seconds
const PONG_TIMEOUT_MS = 10000 // 10 seconds
const RATE_LIMIT_MESSAGES = 100
const RATE_LIMIT_WINDOW_MS = 60000 // 1 minute

// Global state
const connections = new Map<WebSocket, ConnectionMeta>()
const serverStartTime = Date.now()
let pingInterval: NodeJS.Timeout | null = null
let idleCheckInterval: NodeJS.Timeout | null = null

function generateConnectionId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

function closeConnection(ws: WebSocket, code: number, reason: string) {
  const meta = connections.get(ws)
  if (meta?.pingTimeout) {
    clearTimeout(meta.pingTimeout)
  }
  connections.delete(ws)
  try {
    ws.close(code, reason)
  } catch {
    // ignore
  }
}

function isRateLimited(meta: ConnectionMeta): boolean {
  const now = new Date()
  const windowStart = meta.messageWindowStart
  const timeInWindow = now.getTime() - windowStart.getTime()

  if (timeInWindow > RATE_LIMIT_WINDOW_MS) {
    // Reset window
    meta.messageWindowStart = now
    meta.messageCount = 1
    return false
  }

  meta.messageCount++
  return meta.messageCount > RATE_LIMIT_MESSAGES
}

function wsToStream(ws: WebSocket, meta: ConnectionMeta): Stream {
  const readable = new ReadableStream<any>({
    start(controller) {
      ws.on('message', data => {
        // Update activity
        meta.lastActivity = new Date()

        // Check rate limit
        if (isRateLimited(meta)) {
          console.log(`[ws] Rate limit exceeded for connection ${meta.id}`)
          closeConnection(ws, 1008, 'Rate limit exceeded')
          controller.close()
          return
        }

        try {
          const text = typeof data === 'string' ? data : data.toString('utf-8')
          const msg = JSON.parse(text)
          // Filter out ping/pong control messages
          if (msg && (msg.type === 'ping' || msg.type === 'pong')) {
            return
          }
          controller.enqueue(msg)
        } catch {
          // Ignore malformed frames.
        }
      })

      ws.on('close', () => {
        cleanupConnection(ws)
        controller.close()
      })
      ws.on('error', (err: Error) => controller.error(err))

      // Handle pong responses
      ws.on('pong', () => {
        meta.isAlive = true
        meta.lastActivity = new Date()
        if (meta.pingTimeout) {
          clearTimeout(meta.pingTimeout)
          meta.pingTimeout = undefined
        }
      })
    }
  })

  const writable = new WritableStream<any>({
    write(msg) {
      if (ws.readyState !== ws.OPEN) return
      meta.lastActivity = new Date()
      ws.send(JSON.stringify(msg))
    },
    close() {
      cleanupConnection(ws)
      try {
        ws.close()
      } catch {
        // ignore
      }
    }
  })

  return { readable, writable }
}

function cleanupConnection(ws: WebSocket) {
  const meta = connections.get(ws)
  if (meta) {
    if (meta.pingTimeout) {
      clearTimeout(meta.pingTimeout)
    }
    console.log(`[ws] Connection ${meta.id} disconnected. Total: ${connections.size - 1}`)
  }
  connections.delete(ws)
}

function onConnection(ws: WebSocket, req: http.IncomingMessage) {
  // Check max connections
  if (connections.size >= MAX_CONNECTIONS) {
    console.log(`[ws] Max connections (${MAX_CONNECTIONS}) reached. Rejecting new connection.`)
    ws.close(1013, 'Server overloaded')
    return
  }

  const meta: ConnectionMeta = {
    id: generateConnectionId(),
    connectedAt: new Date(),
    lastActivity: new Date(),
    messageCount: 0,
    messageWindowStart: new Date(),
    isAlive: true
  }

  connections.set(ws, meta)
  console.log(`[ws] New connection ${meta.id} from ${req.socket.remoteAddress}. Total: ${connections.size}`)

  const stream = wsToStream(ws, meta)
  new AgentSideConnection(conn => new PiAcpAgent(conn), stream)
}

function startHeartbeat() {
  // Send ping to all connections every 30s
  pingInterval = setInterval(() => {
    for (const [ws, meta] of connections) {
      if (!meta.isAlive) {
        console.log(`[ws] Connection ${meta.id} ping timeout. Closing.`)
        closeConnection(ws, 1001, 'Ping timeout')
        continue
      }

      // Mark as not alive until pong received
      meta.isAlive = false

      // Send ping
      try {
        ws.ping()
      } catch {
        closeConnection(ws, 1011, 'Ping failed')
        continue
      }

      // Set pong timeout
      meta.pingTimeout = setTimeout(() => {
        if (connections.has(ws)) {
          console.log(`[ws] Connection ${meta.id} pong timeout. Closing.`)
          closeConnection(ws, 1001, 'Pong timeout')
        }
      }, PONG_TIMEOUT_MS)
    }
  }, PING_INTERVAL_MS)
}

function startIdleCheck() {
  // Check for idle connections every minute
  idleCheckInterval = setInterval(() => {
    const now = Date.now()
    for (const [ws, meta] of connections) {
      const idleTime = now - meta.lastActivity.getTime()
      if (idleTime > IDLE_TIMEOUT_MS) {
        console.log(`[ws] Connection ${meta.id} idle for ${Math.floor(idleTime / 1000)}s. Closing.`)
        closeConnection(ws, 1001, 'Idle timeout')
      }
    }
  }, 60000)
}

function createHealthHandler(): http.RequestListener {
  return (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const health = {
        status: 'healthy',
        connections: connections.size,
        maxConnections: MAX_CONNECTIONS,
        uptime: Math.floor((Date.now() - serverStartTime) / 1000),
        timestamp: new Date().toISOString()
      }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(health))
      return
    }

    // Default 404
    res.writeHead(404)
    res.end('Not found')
  }
}

export function startWsServer(opts: { host: string; port: number }) {
  // Create HTTP server for health endpoint
  const httpServer = http.createServer(createHealthHandler())

  // Create WebSocket server attached to HTTP server
  const wss = new WebSocketServer({
    server: httpServer
  })

  wss.on('connection', onConnection)

  // Start HTTP server
  httpServer.listen(opts.port, opts.host, () => {
    console.log(`[ws] Server listening on ${opts.host}:${opts.port}`)
    console.log(`[ws] Health endpoint: http://${opts.host}:${opts.port}/health`)
  })

  // Start intervals
  startHeartbeat()
  startIdleCheck()

  // Graceful shutdown handler
  function gracefulShutdown(signal: string) {
    console.log(`[ws] Received ${signal}. Shutting down gracefully...`)

    // Clear intervals
    if (pingInterval) clearInterval(pingInterval)
    if (idleCheckInterval) clearInterval(idleCheckInterval)

    // Close all connections
    console.log(`[ws] Closing ${connections.size} connections...`)
    for (const [ws, _meta] of connections) {
      closeConnection(ws, 1001, 'Server shutting down')
    }

    // Close servers
    wss.close(() => {
      console.log('[ws] WebSocket server closed')
    })
    httpServer.close(() => {
      console.log('[ws] HTTP server closed')
      process.exit(0)
    })

    // Force exit after 10s
    setTimeout(() => {
      console.error('[ws] Forced shutdown')
      process.exit(1)
    }, 10000)
  }

  // Register shutdown handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  // Return combined server object
  return {
    wss,
    httpServer,
    close: () => gracefulShutdown('manual')
  }
}

// Export for testing
export { connections, MAX_CONNECTIONS, IDLE_TIMEOUT_MS, PING_INTERVAL_MS, PONG_TIMEOUT_MS }
