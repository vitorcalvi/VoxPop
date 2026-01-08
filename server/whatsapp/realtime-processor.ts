/**
 * WhatsApp Real-Time Event Processing
 * 
 * Handles real-time event processing with:
 * - WebSocket/Socket.IO integration
 * - Real-time message delivery
 * - Live status updates
 * - Typing indicators
 * - Presence management
 * - Event broadcasting
 */

import { WhatsAppMessage, WhatsAppWebhookEvent, WhatsAppOperationalGraph } from './op-graph';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type RealTimeEventType = 
  | 'message_received'
  | 'message_sent'
  | 'message_delivered'
  | 'message_read'
  | 'status_update'
  | 'typing_start'
  | 'typing_stop'
  | 'presence_update'
  | 'contact_online'
  | 'contact_offline'
  | 'group_created'
  | 'group_updated'
  | 'group_member_added'
  | 'group_member_removed';

export interface RealTimeEvent {
  id: string;
  type: RealTimeEventType;
  timestamp: number;
  data: any;
  target?: string[]; // Recipient IDs or room IDs
  broadcast: boolean;
  metadata: {
    source: string;
    correlationId?: string;
    priority?: 'low' | 'normal' | 'high';
    expiresAt?: number;
  };
}

export interface PresenceInfo {
  phoneNumber: string;
  status: 'online' | 'offline' | 'away';
  lastSeen: number;
  metadata: {
    device?: string;
    platform?: string;
    customStatus?: string;
  };
}

export interface TypingIndicator {
  conversationId: string;
  phoneNumber: string;
  isTyping: boolean;
  timestamp: number;
}

export interface RealTimeConfig {
  enablePresenceTracking: boolean;
  enableTypingIndicators: boolean;
  presenceTimeout: number;
  typingTimeout: number;
  maxEventQueueSize: number;
  enableEventPersistence: boolean;
}

// ============================================================================
// REAL-TIME EVENT PROCESSOR CLASS
// ============================================================================

export class WhatsAppRealTimeProcessor {
  private graph: WhatsAppOperationalGraph;
  private config: RealTimeConfig;
  private connectedClients: Map<string, Set<string>> = new Map(); // phoneNumber -> socketIds
  private roomMembers: Map<string, Set<string>> = new Map(); // roomId -> phoneNumbers
  private presence: Map<string, PresenceInfo> = new Map();
  private typingIndicators: Map<string, TypingIndicator> = new Map();
  private eventQueue: RealTimeEvent[] = [];
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isProcessing = false;

  // Socket.IO instance (to be set externally)
  private io: any = null;

  constructor(graph: WhatsAppOperationalGraph, config?: Partial<RealTimeConfig>) {
    this.graph = graph;
    this.config = {
      enablePresenceTracking: config?.enablePresenceTracking ?? true,
      enableTypingIndicators: config?.enableTypingIndicators ?? true,
      presenceTimeout: config?.presenceTimeout ?? 300000, // 5 minutes
      typingTimeout: config?.typingTimeout ?? 10000, // 10 seconds
      maxEventQueueSize: config?.maxEventQueueSize ?? 1000,
      enableEventPersistence: config?.enableEventPersistence ?? false,
    };

    // Start event processing loop
    this.startEventProcessingLoop();

    // Start cleanup loops
    this.startPresenceCleanupLoop();
    this.startTypingCleanupLoop();
  }

  // ============================================================================
  // SOCKET.IO INTEGRATION
  // ============================================================================

  setSocketIO(io: any): void {
    this.io = io;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    if (!this.io) return;

    this.io.on('connection', (socket: any) => {
      const phoneNumber = socket.handshake.auth?.phoneNumber;

      if (!phoneNumber) {
        socket.disconnect();
        return;
      }

      // Track connected client
      if (!this.connectedClients.has(phoneNumber)) {
        this.connectedClients.set(phoneNumber, new Set());
      }
      this.connectedClients.get(phoneNumber)!.add(socket.id);

      // Set user as online
      this.setPresence(phoneNumber, 'online');

      // Join personal room
      socket.join(`user:${phoneNumber}`);

      this.emit('client_connected', { phoneNumber, socketId: socket.id });

      socket.on('disconnect', () => {
        this.handleClientDisconnect(phoneNumber, socket.id);
      });

      socket.on('typing_start', (data: { conversationId: string }) => {
        this.handleTypingStart(phoneNumber, data.conversationId);
      });

      socket.on('typing_stop', (data: { conversationId: string }) => {
        this.handleTypingStop(phoneNumber, data.conversationId);
      });

      socket.on('join_room', (roomId: string) => {
        this.joinRoom(phoneNumber, socket.id, roomId);
      });

      socket.on('leave_room', (roomId: string) => {
        this.leaveRoom(phoneNumber, socket.id, roomId);
      });

      socket.on('presence_update', (data: { status: 'online' | 'offline' | 'away' }) => {
        this.setPresence(phoneNumber, data.status);
      });
    });
  }

  private handleClientDisconnect(phoneNumber: string, socketId: string): void {
    const clients = this.connectedClients.get(phoneNumber);
    if (clients) {
      clients.delete(socketId);

      // If no more clients for this user, set as offline
      if (clients.size === 0) {
        this.connectedClients.delete(phoneNumber);
        this.setPresence(phoneNumber, 'offline');
        this.emit('client_disconnected', { phoneNumber });
      }
    }
  }

  // ============================================================================
  // ROOM MANAGEMENT
  // ============================================================================

  private joinRoom(phoneNumber: string, socketId: string, roomId: string): void {
    if (!this.roomMembers.has(roomId)) {
      this.roomMembers.set(roomId, new Set());
    }
    this.roomMembers.get(roomId)!.add(phoneNumber);

    if (this.io) {
      this.io.to(socketId).sockets.get(socketId)?.join(roomId);
    }

    this.emit('room_joined', { phoneNumber, roomId });
  }

  private leaveRoom(phoneNumber: string, socketId: string, roomId: string): void {
    const members = this.roomMembers.get(roomId);
    if (members) {
      members.delete(phoneNumber);

      if (members.size === 0) {
        this.roomMembers.delete(roomId);
      }
    }

    if (this.io) {
      this.io.to(socketId).sockets.get(socketId)?.leave(roomId);
    }

    this.emit('room_left', { phoneNumber, roomId });
  }

  getRoomMembers(roomId: string): string[] {
    const members = this.roomMembers.get(roomId);
    return members ? Array.from(members) : [];
  }

  // ============================================================================
  // PRESENCE TRACKING
  // ============================================================================

  setPresence(phoneNumber: string, status: 'online' | 'offline' | 'away'): void {
    if (!this.config.enablePresenceTracking) return;

    const presence: PresenceInfo = {
      phoneNumber,
      status,
      lastSeen: Date.now(),
      metadata: {},
    };

    this.presence.set(phoneNumber, presence);

    // Broadcast presence update
    this.broadcast('presence_update', {
      phoneNumber,
      status,
      lastSeen: presence.lastSeen,
    });

    this.emit('presence_updated', { phoneNumber, status });

    // Emit specific events
    if (status === 'online') {
      this.emit('contact_online', { phoneNumber });
    } else if (status === 'offline') {
      this.emit('contact_offline', { phoneNumber });
    }
  }

  getPresence(phoneNumber: string): PresenceInfo | undefined {
    return this.presence.get(phoneNumber);
  }

  getAllOnlineContacts(): string[] {
    return Array.from(this.presence.values())
      .filter(p => p.status === 'online')
      .map(p => p.phoneNumber);
  }

  private startPresenceCleanupLoop(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = this.config.presenceTimeout;

      for (const [phoneNumber, presence] of this.presence.entries()) {
        if (presence.status === 'online' && !this.connectedClients.has(phoneNumber)) {
          // User is marked as online but not connected - likely stale
          const timeSinceLastSeen = now - presence.lastSeen;
          if (timeSinceLastSeen > timeout) {
            this.setPresence(phoneNumber, 'offline');
          }
        }
      }
    }, 60000); // Check every minute
  }

  // ============================================================================
  // TYPING INDICATORS
  // ============================================================================

  private handleTypingStart(phoneNumber: string, conversationId: string): void {
    if (!this.config.enableTypingIndicators) return;

    const indicator: TypingIndicator = {
      conversationId,
      phoneNumber,
      isTyping: true,
      timestamp: Date.now(),
    };

    this.typingIndicators.set(`${conversationId}:${phoneNumber}`, indicator);

    // Broadcast typing start
    this.broadcastToRoom(conversationId, 'typing_start', {
      phoneNumber,
      conversationId,
    });

    this.emit('typing_start', { phoneNumber, conversationId });
  }

  private handleTypingStop(phoneNumber: string, conversationId: string): void {
    if (!this.config.enableTypingIndicators) return;

    const key = `${conversationId}:${phoneNumber}`;
    this.typingIndicators.delete(key);

    // Broadcast typing stop
    this.broadcastToRoom(conversationId, 'typing_stop', {
      phoneNumber,
      conversationId,
    });

    this.emit('typing_stop', { phoneNumber, conversationId });
  }

  getTypingIndicator(conversationId: string, phoneNumber: string): TypingIndicator | undefined {
    return this.typingIndicators.get(`${conversationId}:${phoneNumber}`);
  }

  private startTypingCleanupLoop(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = this.config.typingTimeout;

      for (const [key, indicator] of this.typingIndicators.entries()) {
        if (now - indicator.timestamp > timeout) {
          // Auto-stop typing
          this.handleTypingStop(indicator.phoneNumber, indicator.conversationId);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  // ============================================================================
  // EVENT BROADCASTING
  // ============================================================================

  queueEvent(event: RealTimeEvent): void {
    if (this.eventQueue.length >= this.config.maxEventQueueSize) {
      this.emit('event_queue_full', { size: this.eventQueue.length });
      return;
    }

    this.eventQueue.push(event);
    this.emit('event_queued', { eventId: event.id, type: event.type });
  }

  private startEventProcessingLoop(): void {
    setInterval(() => {
      if (!this.isProcessing && this.eventQueue.length > 0) {
        this.processNextEvent();
      }
    }, 10); // Process every 10ms
  }

  private async processNextEvent(): Promise<void> {
    if (this.isProcessing) return;

    const event = this.eventQueue.shift();
    if (!event) return;

    this.isProcessing = true;

    try {
      // Broadcast event
      if (event.broadcast) {
        this.broadcast(event.type, event.data);
      } else if (event.target) {
        for (const target of event.target) {
          this.sendToUser(target, event.type, event.data);
        }
      }

      // Emit internal event
      this.emit(event.type, event.data);

      this.emit('event_processed', { eventId: event.id, type: event.type });

    } catch (error) {
      console.error('Error processing real-time event:', error);
      this.emit('event_processing_failed', { 
        eventId: event.id, 
        error: (error as Error).message 
      });
    } finally {
      this.isProcessing = false;
    }
  }

  broadcast(eventType: RealTimeEventType, data: any): void {
    if (!this.io) return;

    this.io.emit(eventType, data);
    this.emit('broadcast', { type: eventType, data });
  }

  broadcastToRoom(roomId: string, eventType: RealTimeEventType, data: any): void {
    if (!this.io) return;

    this.io.to(roomId).emit(eventType, data);
    this.emit('broadcast_to_room', { roomId, type: eventType, data });
  }

  sendToUser(phoneNumber: string, eventType: RealTimeEventType, data: any): void {
    if (!this.io) return;

    this.io.to(`user:${phoneNumber}`).emit(eventType, data);
    this.emit('sent_to_user', { phoneNumber, type: eventType, data });
  }

  // ============================================================================
  // MESSAGE EVENTS
  // ============================================================================

  onMessageReceived(message: WhatsAppMessage): void {
    const event: RealTimeEvent = {
      id: this.generateEventId(),
      type: 'message_received',
      timestamp: Date.now(),
      data: message,
      target: [message.to],
      broadcast: false,
      metadata: {
        source: 'whatsapp',
        correlationId: message.id,
        priority: 'normal',
      },
    };

    this.queueEvent(event);
  }

  onMessageSent(message: WhatsAppMessage): void {
    const event: RealTimeEvent = {
      id: this.generateEventId(),
      type: 'message_sent',
      timestamp: Date.now(),
      data: message,
      target: [message.to],
      broadcast: false,
      metadata: {
        source: 'whatsapp',
        correlationId: message.id,
        priority: 'normal',
      },
    };

    this.queueEvent(event);
  }

  onMessageDelivered(messageId: string, recipientId: string): void {
    const event: RealTimeEvent = {
      id: this.generateEventId(),
      type: 'message_delivered',
      timestamp: Date.now(),
      data: { messageId, recipientId, timestamp: Date.now() },
      target: [recipientId],
      broadcast: false,
      metadata: {
        source: 'whatsapp',
        correlationId: messageId,
        priority: 'normal',
      },
    };

    this.queueEvent(event);
  }

  onMessageRead(messageId: string, recipientId: string): void {
    const event: RealTimeEvent = {
      id: this.generateEventId(),
      type: 'message_read',
      timestamp: Date.now(),
      data: { messageId, recipientId, timestamp: Date.now() },
      target: [recipientId],
      broadcast: false,
      metadata: {
        source: 'whatsapp',
        correlationId: messageId,
        priority: 'normal',
      },
    };

    this.queueEvent(event);
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateEventId(): string {
    return `rt_event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(config: Partial<RealTimeConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  getConfig(): RealTimeConfig {
    return { ...this.config };
  }

  // ============================================================================
  // EVENT SYSTEM
  // ============================================================================

  on(event: string, listener: Function): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off(event: string, listener: Function): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  private emit(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`Error in real-time event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // STATS AND HEALTH
  // ============================================================================

  getStats(): {
    connectedClients: number;
    activeRooms: number;
    onlineContacts: number;
    pendingEvents: number;
    isProcessing: boolean;
  } {
    return {
      connectedClients: Array.from(this.connectedClients.values())
        .reduce((sum, clients) => sum + clients.size, 0),
      activeRooms: this.roomMembers.size,
      onlineContacts: this.getAllOnlineContacts().length,
      pendingEvents: this.eventQueue.length,
      isProcessing: this.isProcessing,
    };
  }

  reset(): void {
    this.connectedClients.clear();
    this.roomMembers.clear();
    this.presence.clear();
    this.typingIndicators.clear();
    this.eventQueue = [];
    this.isProcessing = false;
    this.emit('processor_reset', {});
  }
}
