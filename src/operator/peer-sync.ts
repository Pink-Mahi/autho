import { ProtocolEvent, Operator } from '../types';

export class PeerSync {
  private peers: Operator[];
  private syncInterval: NodeJS.Timeout | null = null;

  constructor(peers: Operator[]) {
    this.peers = peers;
  }

  async broadcastEvent(event: ProtocolEvent): Promise<void> {
    const promises = this.peers.map(async (peer) => {
      try {
        const response = await fetch(`${peer.endpoint}/api/event/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(event)
        });
        
        if (!response.ok) {
          console.warn(`[PeerSync] Failed to broadcast to ${peer.operatorId}`);
        }
      } catch (error) {
        console.error(`[PeerSync] Error broadcasting to ${peer.operatorId}:`, error);
      }
    });

    await Promise.allSettled(promises);
  }

  async fetchPeerEvents(peer: Operator, fromHeight: number): Promise<ProtocolEvent[]> {
    try {
      const response = await fetch(
        `${peer.endpoint}/api/events?fromHeight=${fromHeight}`
      );
      
      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error(`[PeerSync] Error fetching from ${peer.operatorId}:`, error);
      return [];
    }
  }

  async syncWithPeers(
    currentHeight: number,
    onNewEvent: (event: ProtocolEvent) => Promise<void>
  ): Promise<void> {
    for (const peer of this.peers) {
      const events = await this.fetchPeerEvents(peer, currentHeight);
      
      for (const event of events) {
        try {
          await onNewEvent(event);
        } catch (error) {
          console.error(`[PeerSync] Error processing event from ${peer.operatorId}:`, error);
        }
      }
    }
  }

  startAutoSync(
    getCurrentHeight: () => number,
    onNewEvent: (event: ProtocolEvent) => Promise<void>,
    intervalMs: number = 5000
  ): void {
    if (this.syncInterval) {
      return;
    }

    console.log('[PeerSync] Starting automatic peer synchronization...');
    
    this.syncInterval = setInterval(async () => {
      const currentHeight = getCurrentHeight();
      await this.syncWithPeers(currentHeight, onNewEvent);
    }, intervalMs);
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[PeerSync] Stopped automatic peer synchronization');
    }
  }

  async checkPeerHealth(): Promise<Map<string, boolean>> {
    const healthMap = new Map<string, boolean>();

    const promises = this.peers.map(async (peer) => {
      try {
        const response = await fetch(`${peer.endpoint}/health`, {
          signal: AbortSignal.timeout(5000)
        });
        healthMap.set(peer.operatorId, response.ok);
      } catch (error) {
        healthMap.set(peer.operatorId, false);
      }
    });

    await Promise.allSettled(promises);
    return healthMap;
  }

  getPeers(): Operator[] {
    return [...this.peers];
  }

  addPeer(peer: Operator): void {
    if (!this.peers.find(p => p.operatorId === peer.operatorId)) {
      this.peers.push(peer);
      console.log(`[PeerSync] Added peer: ${peer.operatorId}`);
    }
  }

  removePeer(operatorId: string): void {
    this.peers = this.peers.filter(p => p.operatorId !== operatorId);
    console.log(`[PeerSync] Removed peer: ${operatorId}`);
  }
}
