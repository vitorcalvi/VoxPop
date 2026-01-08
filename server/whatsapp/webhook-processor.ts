/**
 * WhatsApp Webhook Event Processing with Rate Limiting
 * 
 * Handles incoming WhatsApp webhook events with:
 * - Event validation and verification
 * - Rate limiting per endpoint
 * - Event deduplication
 * - Queue management
 * - Retry logic for failed events
 */

import { WhatsAppWebhookEvent, WhatsAppOperationalGraph } from './op-graph';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type WebhookEventType = 'messages' | 'statuses' | 'contacts' | 'groups';

export interface WebhookEvent {
  id: string;
  type: WebhookEventType;
  data: WhatsAppWebhookEvent;
  receivedAt: number;
  processedAt?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  retryCount: number;
  metadata: {
    sourceIp: string;
    signature?: string;
    webhookId?: string;
  };
}

export interface RateLimitInfo {
  endpoint: string;
  requests: number;
  windowStart: number;
  windowEnd: number;
  isLimited: boolean;
  retryAfter: number;
}

export interface WebhookConfig {
  verifySignature: boolean;
  signatureHeader: string;
  webhookSecret: string;
  rateLimitEnabled: boolean;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  enableDeduplication: boolean;
  deduplicationWindowMs: number;
  maxRetries: number;
  maxQueueSize: number;
}

// ============================================================================
// WEBHOOK PROCESSOR CLASS
// ============================================================================

export class WhatsAppWebhookProcessor {
  private graph: WhatsAppOperationalGraph;
  private config: WebhookConfig;
  private eventQueue: WebhookEvent[] = [];
  private processingQueue: Set<string> = new Set();
  private eventCache: Map<string, number> = new Map(); // eventId -> timestamp
  private rateLimiters: Map<string, RateLimitInfo> = new Map();
  private eventListeners: Map<string, Set<Function>> = new Map();
  private isProcessing = false;

  constructor(graph: WhatsAppOperationalGraph, config?: Partial<WebhookConfig>) {
    this.graph = graph;
    this.config = {
      verifySignature: config?.verifySignature ?? false,
      signatureHeader: config?.signatureHeader ?? 'x-hub-signature-256',
      webhookSecret: config?.webhookSecret ?? '',
      rateLimitEnabled: config?.rateLimitEnabled ?? true,
      rateLimitMaxRequests: config?.rateLimitMaxRequests ?? 1000,
      rateLimitWindowMs: config?.rateLimitWindowMs ?? 3600000, // 1 hour
      enableDeduplication: config?.enableDeduplication ?? true,
      deduplicationWindowMs: config?.deduplicationWindowMs ?? 60000, // 1 minute
      maxRetries: config?.maxRetries ?? 3,
      maxQueueSize: config?.maxQueueSize ?? 10000,
    };

    // Start event processing loop
    this.startEventProcessingLoop();
  }

  // ============================================================================
  // WEBHOOK HANDLER
  // ============================================================================

  async handleWebhook(
    data: WhatsAppWebhookEvent,
    metadata?: {
      sourceIp?: string;
      signature?: string;
      webhookId?: string;
    }
  ): Promise<{ success: boolean; eventId?: string; error?: string }> {
    try {
      // Verify signature if enabled
      if (this.config.verifySignature && metadata?.signature) {
        const isValid = this.verifySignature(
          JSON.stringify(data),
          metadata.signature
        );

        if (!isValid) {
          this.emit('signature_verification_failed', { metadata });
          return { success: false, error: 'Invalid signature' };
        }
      }

      // Check rate limits
      if (this.config.rateLimitEnabled) {
        const rateLimitInfo = this.checkRateLimit(
          metadata?.webhookId || 'default'
        );

        if (rateLimitInfo.isLimited) {
          this.emit('rate_limit_exceeded', { rateLimit: rateLimitInfo });
          return {
            success: false,
            error: `Rate limit exceeded. Retry after ${rateLimitInfo.retryAfter}ms`,
          };
        }
      }

      // Check deduplication
      const eventId = this.generateEventId(data);
      if (this.config.enableDeduplication) {
        const isDuplicate = this.isDuplicateEvent(eventId);
        if (isDuplicate) {
          this.emit('duplicate_event_detected', { eventId });
          return { success: false, error: 'Duplicate event' };
        }
      }

      // Check queue size
      if (this.eventQueue.length >= this.config.maxQueueSize) {
        this.emit('queue_full', { size: this.eventQueue.length });
        return { success: false, error: 'Event queue full' };
      }

      // Create webhook event
      const webhookEvent: WebhookEvent = {
        id: eventId,
        type: this.determineEventType(data),
        data,
        receivedAt: Date.now(),
        status: 'pending',
        retryCount: 0,
        metadata: {
          sourceIp: metadata?.sourceIp || 'unknown',
          signature: metadata?.signature,
          webhookId: metadata?.webhookId,
        },
      };

      // Add to queue
      this.eventQueue.push(webhookEvent);

      // Cache for deduplication
      if (this.config.enableDeduplication) {
        this.eventCache.set(eventId, Date.now());
      }

      this.emit('event_queued', { eventId, type: webhookEvent.type });
      return { success: true, eventId };

    } catch (error) {
      console.error('Error handling webhook:', error);
      this.emit('webhook_handling_failed', { error: (error as Error).message });
      return { success: false, error: (error as Error).message };
    }
  }

  // ============================================================================
  // EVENT PROCESSING LOOP
  // ============================================================================

  private startEventProcessingLoop(): void {
    setInterval(() => {
      if (!this.isProcessing && this.eventQueue.length > 0) {
        this.processNextEvent();
      }
    }, 100); // Process every 100ms
  }

  private async processNextEvent(): Promise<void> {
    if (this.isProcessing) return;

    const event = this.eventQueue.shift();
    if (!event) return;

    this.isProcessing = true;
    this.processingQueue.add(event.id);

    try {
      // Update status
      event.status = 'processing';
      event.processedAt = Date.now();

      this.emit('event_processing_started', { eventId: event.id });

      // Execute graph with event data
      const result = await this.graph.execute(event.data);

      if (result.success) {
        // Mark as completed
        event.status = 'completed';
        this.emit('event_processed', {
          eventId: event.id,
          result,
          duration: Date.now() - event.receivedAt,
        });
      } else {
        // Handle failure
        await this.handleFailedEvent(event, result);
      }

    } catch (error) {
      console.error('Error processing event:', error);
      await this.handleFailedEvent(event, { errors: new Map(), success: false });
    } finally {
      this.processingQueue.delete(event.id);
      this.isProcessing = false;

      // Clean up event cache
      if (this.config.enableDeduplication) {
        this.cleanupEventCache();
      }
    }
  }

  private async handleFailedEvent(
    event: WebhookEvent,
    result: any
  ): Promise<void> {
    event.retryCount++;

    if (event.retryCount < this.config.maxRetries) {
      // Re-queue for retry
      event.status = 'pending';
      
      // Exponential backoff
      const backoffDelay = Math.min(1000 * Math.pow(2, event.retryCount), 60000);
      
      setTimeout(() => {
        this.eventQueue.unshift(event);
        this.emit('event_retrying', {
          eventId: event.id,
          retryCount: event.retryCount,
          delay: backoffDelay,
        });
      }, backoffDelay);

    } else {
      // Max retries exceeded
      event.status = 'failed';
      this.emit('event_failed', {
        eventId: event.id,
        retryCount: event.retryCount,
        errors: result.errors || [],
      });
    }
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  private checkRateLimit(endpoint: string): RateLimitInfo {
    const now = Date.now();
    const windowMs = this.config.rateLimitWindowMs;
    const maxRequests = this.config.rateLimitMaxRequests;

    let rateLimitInfo = this.rateLimiters.get(endpoint);

    if (!rateLimitInfo || now > rateLimitInfo.windowEnd) {
      // Create new window
      rateLimitInfo = {
        endpoint,
        requests: 1,
        windowStart: now,
        windowEnd: now + windowMs,
        isLimited: false,
        retryAfter: windowMs,
      };
      this.rateLimiters.set(endpoint, rateLimitInfo);
      return rateLimitInfo;
    }

    // Increment request count
    rateLimitInfo.requests++;

    // Check if limited
    rateLimitInfo.isLimited = rateLimitInfo.requests > maxRequests;
    rateLimitInfo.retryAfter = rateLimitInfo.windowEnd - now;

    this.rateLimiters.set(endpoint, rateLimitInfo);
    return rateLimitInfo;
  }

  getRateLimitStatus(endpoint: string): RateLimitInfo {
    const info = this.rateLimiters.get(endpoint);
    const now = Date.now();

    if (!info || now > info.windowEnd) {
      return {
        endpoint,
        requests: 0,
        windowStart: now,
        windowEnd: now + this.config.rateLimitWindowMs,
        isLimited: false,
        retryAfter: 0,
      };
    }

    return { ...info };
  }

  resetRateLimiters(): void {
    this.rateLimiters.clear();
    this.emit('rate_limiters_reset', {});
  }

  // ============================================================================
  // EVENT DEDUPLICATION
  // ============================================================================

  private isDuplicateEvent(eventId: string): boolean {
    const timestamp = this.eventCache.get(eventId);
    if (!timestamp) return false;

    const now = Date.now();
    return (now - timestamp) < this.config.deduplicationWindowMs;
  }

  private cleanupEventCache(): void {
    const now = Date.now();
    const windowMs = this.config.deduplicationWindowMs;

    for (const [eventId, timestamp] of this.eventCache.entries()) {
      if (now - timestamp > windowMs) {
        this.eventCache.delete(eventId);
      }
    }
  }

  // ============================================================================
  // SIGNATURE VERIFICATION
  // ============================================================================

  private verifySignature(payload: string, signature: string): boolean {
    const crypto = require('crypto');

    // Extract hash and algorithm from signature
    const [algorithm, hash] = signature.split('=');

    if (algorithm !== 'sha256') {
      return false;
    }

    // Compute expected signature
    const expectedSignature = crypto
      .createHmac('sha256', this.config.webhookSecret)
      .update(payload)
      .digest('hex');

    // Compare signatures with timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(hash, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    );
  }

  // ============================================================================
  // EVENT TYPE DETERMINATION
  // ============================================================================

  private determineEventType(data: WhatsAppWebhookEvent): WebhookEventType {
    for (const entry of data.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages') {
          return 'messages';
        }
        if (change.field === 'statuses') {
          return 'statuses';
        }
        if (change.field === 'contacts') {
          return 'contacts';
        }
      }
    }

    return 'messages';
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateEventId(data: WhatsAppWebhookEvent): string {
    const crypto = require('crypto');
    const payload = JSON.stringify(data);
    const hash = crypto.createHash('sha256').update(payload).digest('hex');
    return `event_${hash.substring(0, 16)}`;
  }

  // ============================================================================
  // QUEUE MANAGEMENT
  // ============================================================================

  getQueueStats(): {
    queued: number;
    processing: number;
    total: number;
  } {
    return {
      queued: this.eventQueue.length,
      processing: this.processingQueue.size,
      total: this.eventQueue.length + this.processingQueue.size,
    };
  }

  getProcessingEvents(): WebhookEvent[] {
    return this.eventQueue.filter(e => e.status === 'processing');
  }

  getPendingEvents(): WebhookEvent[] {
    return this.eventQueue.filter(e => e.status === 'pending');
  }

  getFailedEvents(): WebhookEvent[] {
    return this.eventQueue.filter(e => e.status === 'failed');
  }

  clearQueue(): void {
    this.eventQueue = [];
    this.processingQueue.clear();
    this.emit('queue_cleared', {});
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(config: Partial<WebhookConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  getConfig(): WebhookConfig {
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
          console.error(`Error in webhook processor event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // HEALTH CHECK
  // ============================================================================

  getHealthStatus(): {
    isProcessing: boolean;
    queueSize: number;
    rateLimitersActive: number;
    eventCacheSize: number;
    lastProcessedAt?: number;
  } {
    const lastProcessedEvent = this.eventQueue
      .filter(e => e.status === 'completed')
      .sort((a, b) => (b.processedAt || 0) - (a.processedAt || 0))[0];

    return {
      isProcessing: this.isProcessing,
      queueSize: this.eventQueue.length,
      rateLimitersActive: this.rateLimiters.size,
      eventCacheSize: this.eventCache.size,
      lastProcessedAt: lastProcessedEvent?.processededAt,
    };
  }

  reset(): void {
    this.eventQueue = [];
    this.processingQueue.clear();
    this.eventCache.clear();
    this.rateLimiters.clear();
    this.isProcessing = false;
    this.emit('processor_reset', {});
  }
}
