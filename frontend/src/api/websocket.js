// WebSocket Configuration
// Use this to connect to the FastAPI WebSocket endpoints

export class GameWebSocket {
  constructor(roomId, token) {
    this.roomId = roomId;
    this.token = token;
    this.ws = null;
    this.listeners = {};
    this.connect();
  }

  connect() {
    // Determine WS protocol based on HTTP protocol
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use the backend URL from env or fallback to local port 8080
    const host = import.meta.env.VITE_BACKEND_URL ? import.meta.env.VITE_BACKEND_URL.replace(/^https?:\/\//, '') : 'localhost:8080';
    
    const wsUrl = `${protocol}//${host}/api/v1/game/ws/${this.roomId}?token=${this.token}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log(`Connected to room ${this.roomId}`);
      this.emit('connected', null);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.emit(data.type || 'message', data);
      } catch (e) {
        console.error('Failed to parse WebSocket message:', e);
      }
    };

    this.ws.onclose = () => {
      console.log(`Disconnected from room ${this.roomId}`);
      this.emit('disconnected', null);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
      this.emit('error', error);
    };
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => cb(data));
    }
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn('WebSocket is not connected');
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
