import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { 
  P2PMessage, 
  PeerInfo, 
  ProtocolEvent,
  EventSignature,
  // Message payload types defined inline
} from './node-types';

/**
 * P2P MESSAGE HANDLER
 * 
 * Handles peer-to-peer communication for the decentralized network:
 * - Peer discovery via ADDR messages
 * - Event log gossip and sync
 * - Checkpoint verification
 * - Connection management
 */
export class P2PMessageHandler extends EventEmitter {
  private peers: Map<string, PeerConnection>;
  private nodeId: string;
  private publicKey: string;
  private maxPeers: number;
  private messageHandlers: Map<string, (peer: PeerConnection, data: any) => void>;

  constructor(nodeId: string, publicKey: string, maxPeers: number = 50) {
    super();
    this.peers = new Map();
    this.nodeId = nodeId;
    this.publicKey = publicKey;
    this.maxPeers = maxPeers;
    this.messageHandlers = new Map();
    
    this.setupMessageHandlers();
  }

  private setupMessageHandlers(): void {
    // Peer discovery
    this.messageHandlers.set('ADDR', this.handleAddrMessage.bind(this));
    this.messageHandlers.set('GETADDR', this.handleGetAddrMessage.bind(this));
    
    // Event sync
    this.messageHandlers.set('EVENT', this.handleEventMessage.bind(this));
    this.messageHandlers.set('GETEVENT', this.handleGetEventMessage.bind(this));
    this.messageHandlers.set('EVENTSYNC', this.handleEventSyncMessage.bind(this));
    
    // Checkpoint sync
    this.messageHandlers.set('CHECKPOINT', this.handleCheckpointMessage.bind(this));
    this.messageHandlers.set('GETCHECKPOINT', this.handleGetCheckpointMessage.bind(this));
    
    // Handshake
    this.messageHandlers.set('HELLO', this.handleHelloMessage.bind(this));
    this.messageHandlers.set('PING', this.handlePingMessage.bind(this));
    this.messageHandlers.set('PONG', this.handlePongMessage.bind(this));
  }

  /**
   * Connect to a peer
   */
  async connectToPeer(address: string, port: number): Promise<PeerConnection> {
    const peerId = `${address}:${port}`;
    
    // Check if already connected
    if (this.peers.has(peerId)) {
      return this.peers.get(peerId)!;
    }
    
    // Check max peers
    if (this.peers.size >= this.maxPeers) {
      throw new Error('Max peers reached');
    }
    
    return new Promise((resolve, reject) => {
      const ws = new (WebSocket as any)(`ws://${address}:${port}`);
      
      ws.on('open', () => {
        const peer = new PeerConnection(peerId, ws, address, port);
        this.peers.set(peerId, peer);
        
        // Send HELLO
        this.sendMessage(peer, {
          type: 'HELLO',
          from: this.nodeId,
          timestamp: Date.now(),
          nonce: Math.random().toString(36).substring(7),
          payload: {
            nodeId: this.nodeId,
            publicKey: this.publicKey,
            version: '1.0.0',
            role: 'operator'
          }
        });
        
        this.emit('peer:connected', peer);
        resolve(peer);
      });
      
      ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(peerId, data);
      });
      
      ws.on('error', (error) => {
        console.error(`[P2P] Connection error to ${peerId}:`, error);
        reject(error);
      });
      
      ws.on('close', () => {
        this.peers.delete(peerId);
        this.emit('peer:disconnected', peerId);
      });
    });
  }

  /**
   * Accept incoming peer connection
   */
  acceptPeerConnection(ws: WebSocket, address: string, port: number): PeerConnection {
    const peerId = `${address}:${port}`;
    
    const peer = new PeerConnection(peerId, ws, address, port);
    this.peers.set(peerId, peer);
    
    ws.on('message', (data: WebSocket.Data) => {
      this.handleMessage(peerId, data);
    });
    
    ws.on('close', () => {
      this.peers.delete(peerId);
      this.emit('peer:disconnected', peerId);
    });
    
    this.emit('peer:connected', peer);
    return peer;
  }

  /**
   * Handle incoming message
   */
  private handleMessage(peerId: string, data: WebSocket.Data): void {
    try {
      const message: P2PMessage = JSON.parse(data.toString());
      const peer = this.peers.get(peerId);
      
      if (!peer) {
        console.warn(`[P2P] Message from unknown peer: ${peerId}`);
        return;
      }
      
      // Update last seen
      peer.lastSeen = Date.now();
      peer.messageCount++;
      
      // Route to handler
      const handler = this.messageHandlers.get(message.type);
      if (handler) {
        handler(peer, message.payload);
      } else {
        console.warn(`[P2P] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error(`[P2P] Error handling message from ${peerId}:`, error);
    }
  }

  /**
   * Send message to peer
   */
  sendMessage(peer: PeerConnection, message: P2PMessage): void {
    try {
      peer.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[P2P] Error sending message to ${peer.id}:`, error);
    }
  }

  /**
   * Broadcast message to all peers
   */
  broadcast(message: P2PMessage, excludePeer?: string): void {
    for (const [peerId, peer] of this.peers) {
      if (peerId !== excludePeer) {
        this.sendMessage(peer, message);
      }
    }
  }

  /**
   * ADDR: Peer address announcement
   */
  private handleAddrMessage(peer: PeerConnection, data: any): void {
    console.log(`[P2P] Received ${data.addresses?.length || 0} peer addresses from ${peer.id}`);
    this.emit('peers:discovered', data.addresses);
  }

  /**
   * GETADDR: Request peer addresses
   */
  private handleGetAddrMessage(peer: PeerConnection, data: any): void {
    const addresses = Array.from(this.peers.values()).map(p => ({
      address: p.address,
      port: p.port,
      publicKey: this.publicKey,
      role: 'operator' as const,
      lastSeen: p.lastSeen
    }));
    
    this.sendMessage(peer, {
      type: 'ADDR',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: { addresses }
    });
  }

  /**
   * EVENT: New event gossip
   */
  private handleEventMessage(peer: PeerConnection, data: { event: ProtocolEvent; signature: EventSignature }): void {
    console.log(`[P2P] Received event ${data.event.eventId} from ${peer.id}`);
    this.emit('event:received', data.event, data.signature, peer.id);
  }

  /**
   * GETEVENT: Request specific event
   */
  private handleGetEventMessage(peer: PeerConnection, data: { eventId: string }): void {
    console.log(`[P2P] Peer ${peer.id} requested event ${data.eventId}`);
    this.emit('event:requested', data.eventId, peer);
  }

  /**
   * EVENTSYNC: Event log sync request/response
   */
  private handleEventSyncMessage(peer: PeerConnection, data: any): void {
    if ('fromEventId' in data) {
      // Sync request
      console.log(`[P2P] Peer ${peer.id} requested sync from ${data.fromEventId}`);
      this.emit('sync:requested', data, peer);
    } else {
      // Sync response
      console.log(`[P2P] Received ${data.events.length} events from ${peer.id}`);
      this.emit('sync:received', data.events, peer.id);
    }
  }

  /**
   * CHECKPOINT: Checkpoint announcement
   */
  private handleCheckpointMessage(peer: PeerConnection, data: any): void {
    console.log(`[P2P] Received checkpoint ${data.checkpoint.checkpointId} from ${peer.id}`);
    this.emit('checkpoint:received', data.checkpoint, data.signatures, peer.id);
  }

  /**
   * GETCHECKPOINT: Request checkpoint
   */
  private handleGetCheckpointMessage(peer: PeerConnection, data: any): void {
    console.log(`[P2P] Peer ${peer.id} requested checkpoint ${data.checkpointId}`);
    this.emit('checkpoint:requested', data.checkpointId, peer);
  }

  /**
   * HELLO: Handshake
   */
  private handleHelloMessage(peer: PeerConnection, data: any): void {
    peer.publicKey = data.publicKey;
    peer.version = data.version;
    peer.role = data.role;
    
    console.log(`[P2P] Handshake from ${peer.id}: ${data.role} node v${data.version}`);
    
    // Send HELLO back if not already sent
    this.sendMessage(peer, {
      type: 'HELLO',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: {
        nodeId: this.nodeId,
        publicKey: this.publicKey,
        version: '1.0.0',
        role: 'operator'
      }
    });
    
    this.emit('peer:handshake', peer);
  }

  /**
   * PING: Heartbeat request
   */
  private handlePingMessage(peer: PeerConnection, data: any): void {
    this.sendMessage(peer, {
      type: 'PONG',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: {}
    });
  }

  /**
   * PONG: Heartbeat response
   */
  private handlePongMessage(peer: PeerConnection, data: any): void {
    const latency = Date.now() - peer.lastPingSent;
    peer.latency = latency;
    console.log(`[P2P] Pong from ${peer.id}: ${latency}ms`);
  }

  /**
   * Request peer addresses from all connected peers
   */
  requestPeerAddresses(): void {
    this.broadcast({
      type: 'GETADDR',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: {}
    });
  }

  /**
   * Gossip new event to all peers
   */
  gossipEvent(event: ProtocolEvent, signature: EventSignature): void {
    this.broadcast({
      type: 'EVENT',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: { event, signature }
    });
  }

  /**
   * Request event sync from peer
   */
  requestEventSync(peer: PeerConnection, fromEventId?: string, toEventId?: string): void {
    this.sendMessage(peer, {
      type: 'EVENTSYNC',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: {
        fromEventId,
        toEventId,
        maxEvents: 1000
      }
    });
  }

  /**
   * Send event sync response
   */
  sendEventSyncResponse(peer: PeerConnection, events: ProtocolEvent[], hasMore: boolean): void {
    this.sendMessage(peer, {
      type: 'EVENTSYNC',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: {
        events,
        hasMore
      }
    });
  }

  /**
   * Request checkpoint from peer
   */
  requestCheckpoint(peer: PeerConnection, checkpointId?: string): void {
    this.sendMessage(peer, {
      type: 'GETCHECKPOINT',
      from: this.nodeId,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(7),
      payload: { checkpointId }
    });
  }

  /**
   * Ping all peers
   */
  pingAllPeers(): void {
    for (const peer of this.peers.values()) {
      peer.lastPingSent = Date.now();
      this.sendMessage(peer, {
        type: 'PING',
        from: this.nodeId,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substring(7),
        payload: {}
      });
    }
  }

  /**
   * Get connected peers
   */
  getPeers(): PeerConnection[] {
    return Array.from(this.peers.values());
  }

  /**
   * Get peer by ID
   */
  getPeer(peerId: string): PeerConnection | undefined {
    return this.peers.get(peerId);
  }

  /**
   * Disconnect from peer
   */
  disconnectPeer(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.ws.close();
      this.peers.delete(peerId);
      this.emit('peer:disconnected', peerId);
    }
  }

  /**
   * Disconnect from all peers
   */
  disconnectAll(): void {
    for (const peer of this.peers.values()) {
      peer.ws.close();
    }
    this.peers.clear();
  }

  /**
   * Get peer statistics
   */
  getPeerStats(): {
    totalPeers: number;
    operatorPeers: number;
    gatewayPeers: number;
    averageLatency: number;
    totalMessages: number;
  } {
    const peers = this.getPeers();
    const operatorPeers = peers.filter(p => p.role === 'operator').length;
    const gatewayPeers = peers.filter(p => p.role === 'gateway').length;
    const averageLatency = peers.reduce((sum, p) => sum + (p.latency || 0), 0) / peers.length;
    const totalMessages = peers.reduce((sum, p) => sum + p.messageCount, 0);
    
    return {
      totalPeers: peers.length,
      operatorPeers,
      gatewayPeers,
      averageLatency,
      totalMessages
    };
  }
}

/**
 * Peer connection wrapper
 */
export class PeerConnection {
  id: string;
  ws: WebSocket;
  address: string;
  port: number;
  publicKey?: string;
  version?: string;
  role?: 'operator' | 'gateway';
  lastSeen: number;
  lastPingSent: number;
  latency?: number;
  messageCount: number;

  constructor(id: string, ws: WebSocket, address: string, port: number) {
    this.id = id;
    this.ws = ws;
    this.address = address;
    this.port = port;
    this.lastSeen = Date.now();
    this.lastPingSent = 0;
    this.messageCount = 0;
  }
}
