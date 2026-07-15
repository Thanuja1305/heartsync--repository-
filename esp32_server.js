import http from 'http';
import { WebSocketServer } from 'ws';

// Create a standard HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('HeartSync ESP32 WebSocket Server is running.\n');
});

// Attach the WebSocket server to the HTTP server specifically on the root path ('/')
const wss = new WebSocketServer({
  server,
  path: '/'
});

// Connection event handler
wss.on('connection', (ws, req) => {
  // Extract and log the remote IP address of the connected ESP32 client
  const ip = req.socket.remoteAddress || req.headers['x-forwarded-for'];
  console.log(`[WS CONNECT] New client connected from IP: ${ip}`);

  // Set alive flag for heartbeat tracking
  ws.isAlive = true;

  // Implement listener for message events
  ws.on('message', (messageStr) => {
    try {
      const message = messageStr.toString();
      console.log(`[WS MESSAGE] Received: ${message}`);
      
      // Echo a brief acknowledgment back to the client
      ws.send(JSON.stringify({ 
        type: "ack", 
        status: "received", 
        timestamp: Date.now() 
      }));
    } catch (err) {
      console.error('[WS ERROR] Failed to process incoming message:', err);
    }
  });

  // Handle pong events from the client
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  // Implement listener for close events
  ws.on('close', (code, reason) => {
    console.log(`[WS DISCONNECT] Connection closed by client. Code: ${code}, Reason: ${reason}`);
  });

  // Implement listener for error events
  ws.on('error', (error) => {
    console.error(`[WS ERROR] Socket error encountered:`, error);
  });
});

// Heartbeat Mechanism: Every 30 seconds, verify if client is alive.
// If it is not, aggressively terminate the connection to prevent memory leaks.
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      console.log('[WS HEARTBEAT] Client timed out. Terminating connection...');
      return ws.terminate();
    }
    
    // Assume client is dead until it sends back a pong response
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Cleanup interval on server close
wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

// Network Binding: Listen on 0.0.0.0 and port 8080
const PORT = 8080;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`[SERVER START] WebSocket server running on ws://${HOST}:${PORT}/`);
  console.log(`[SERVER START] Local subnet clients can connect to ws://YOUR_PC_LOCAL_IP:${PORT}/`);
});
