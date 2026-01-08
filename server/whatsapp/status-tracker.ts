/**
 * WhatsApp Status Update Handler and Tracker
 * 
 * Tracks message status updates through the operational graph with:
 * - Real-time status tracking (sent, delivered, read, failed)
 * - Delivery receipts and read receipts
 * - Error tracking and retry logic
 * - Status history and analytics
 */

import { WhatsAppWebhookEvent, WhatsAppOperationalGraph } from './op-graph';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MessageStatus = 'sent' | 'delivered' | 'read' | 'failed' | 'pending';

export interface StatusUpdate {
  messageId: string;
  status: MessageStatus;
  timestamp: number;
  recipientId: string;
  error?: {
    code: number;
    title: string;
    message: string;
  };
  metadata?: {
    device?: string;
    conversationId?: string;
  };
}

export interface StatusHistory {
  messageId: string;
  updates: StatusUpdate[];
  finalStatus?: MessageStatus;
  deliveryTime?: number; // Time from sent to delivered
  readTime?: number; // Time from sent to read
  failedTime?: number; // Time from sent to failed
  retryCount: number;
}

export interface StatusTrackingConfig {
  enableHistory: boolean;
  maxHistorySize: number;
  enableAnalytics: boolean;
  retryOnFailed: boolean;
  maxRetries: number;
}

export interface StatusAnalytics {
  totalMessages: number;
  sentMessages: number;
  deliveredMessages: number;
  readMessages: number;
  failedMessages: number;
  averageDeliveryTime: number;
  averageReadTime: number;
  deliveryRate: number; // delivered / sent
  readRate: number; // read / delivered
  failureRate: number; // failed / sent
}

// ============================================================================
// STATUS TRACKER CLASS
// ============================================================================

export class WhatsAppStatusTracker {
  private graph: WhatsAppOperationalGraph;
  private statusHistory: Map<string, StatusHistory> = new Map();
  private pendingStatus: Map<string, MessageStatus> = new Map();
  private analytics: StatusAnalytics;
  private config: StatusTrackingConfig;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(graph: WhatsAppOperationalGraph, config?: Partial<StatusTrackingConfig>) {
    this.graph = graph;
    this.config = {
      enableHistory: config?.enableHistory ?? true,
      maxHistorySize: config?.maxHistorySize ?? 1000,
      enableAnalytics: config?.enableAnalytics ?? true,
      retryOnFailed: config?.retryOnFailed ?? true,
      maxRetries: config?.maxRetries ?? 3,
    };

    this.analytics = this.initializeAnalytics();
  }

  // ============================================================================
  // STATUS UPDATE HANDLING
  // ============================================================================

  async processStatusUpdate(event: WhatsAppWebhookEvent): Promise<void> {
    try {
      const statusUpdates = this.extractStatusUpdates(event);

      for (const update of statusUpdates) {
        await this.updateStatus(update);
      }

      // Trigger graph execution if needed
      if (statusUpdates.length > 0) {
        this.emit('status_updates_processed', { count: statusUpdates.length });
      }
    } catch (error) {
      console.error('Error processing status updates:', error);
      throw new Error(`Status update processing failed: ${(error as Error).message}`);
    }
  }

  private extractStatusUpdates(event: WhatsAppWebhookEvent): StatusUpdate[] {
    const updates: StatusUpdate[] = [];

    for (const entry of event.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value.statuses) {
          for (const status of change.value.statuses) {
            updates.push({
              messageId: status.id,
              status: status.status,
              timestamp: status.timestamp * 1000,
              recipientId: status.recipient_id,
            });
          }
        }
      }
    }

    return updates;
  }

  private async updateStatus(update: StatusUpdate): Promise<void> {
    const history = this.getStatusHistory(update.messageId);

    // Add new status to history
    if (this.config.enableHistory) {
      history.updates.push(update);

      // Trim history if needed
      if (history.updates.length > this.config.maxHistorySize) {
        history.updates = history.updates.slice(-this.config.maxHistorySize);
      }
    }

    // Update pending status
    this.pendingStatus.set(update.messageId, update.status);

    // Calculate timing metrics
    this.calculateTimingMetrics(update, history);

    // Handle failed messages
    if (update.status === 'failed' && update.error) {
      history.retryCount++;
      await this.handleFailedMessage(update, history);
    }

    // Update final status
    if (['read', 'failed'].includes(update.status)) {
      history.finalStatus = update.status;
      if (update.status === 'failed') {
        history.failedTime = update.timestamp;
      }
    }

    // Update analytics
    if (this.config.enableAnalytics) {
      this.updateAnalytics(update);
    }

    // Emit event
    this.emit('status_updated', { messageId: update.messageId, status: update.status, update });

    // Store history
    this.statusHistory.set(update.messageId, history);
  }

  // ============================================================================
  // STATUS HISTORY
  // ============================================================================

  getStatusHistory(messageId: string): StatusHistory {
    if (!this.statusHistory.has(messageId)) {
      const history: StatusHistory = {
        messageId,
        updates: [],
        retryCount: 0,
      };
      this.statusHistory.set(messageId, history);
    }
    return this.statusHistory.get(messageId)!;
  }

  getMessageStatus(messageId: string): MessageStatus | undefined {
    return this.pendingStatus.get(messageId);
  }

  getStatusTimeline(messageId: string): StatusUpdate[] {
    const history = this.statusHistory.get(messageId);
    return history?.updates || [];
  }

  getAllStatusHistories(): StatusHistory[] {
    return Array.from(this.statusHistory.values());
  }

  clearStatusHistory(messageId: string): void {
    this.statusHistory.delete(messageId);
    this.pendingStatus.delete(messageId);
  }

  clearAllStatusHistories(): void {
    this.statusHistory.clear();
    this.pendingStatus.clear();
  }

  // ============================================================================
  // TIMING METRICS
  // ============================================================================

  private calculateTimingMetrics(update: StatusUpdate, history: StatusHistory): void {
    // Find the "sent" status (first update)
    const sentUpdate = history.updates.find(u => u.status === 'sent');
    if (!sentUpdate) return;

    const sentTime = sentUpdate.timestamp;

    // Calculate delivery time
    if (update.status === 'delivered') {
      history.deliveryTime = update.timestamp - sentTime;
    }

    // Calculate read time
    if (update.status === 'read') {
      history.readTime = update.timestamp - sentTime;
    }
  }

  getDeliveryTime(messageId: string): number | undefined {
    const history = this.statusHistory.get(messageId);
    return history?.deliveryTime;
  }

  getReadTime(messageId: string): number | undefined {
    const history = this.statusHistory.get(messageId);
    return history?.readTime;
  }

  getAverageDeliveryTime(): number {
    const histories = Array.from(this.statusHistory.values());
    const deliveryTimes = histories
      .filter(h => h.deliveryTime !== undefined)
      .map(h => h.deliveryTime!);

    if (deliveryTimes.length === 0) return 0;

    return deliveryTimes.reduce((sum, time) => sum + time, 0) / deliveryTimes.length;
  }

  getAverageReadTime(): number {
    const histories = Array.from(this.statusHistory.values());
    const readTimes = histories
      .filter(h => h.readTime !== undefined)
      .map(h => h.readTime!);

    if (readTimes.length === 0) return 0;

    return readTimes.reduce((sum, time) => sum + time, 0) / readTimes.length;
  }

  // ============================================================================
  // FAILED MESSAGE HANDLING
  // ============================================================================

  private async handleFailedMessage(update: StatusUpdate, history: StatusHistory): Promise<void> {
    if (!this.config.retryOnFailed) return;

    if (history.retryCount < this.config.maxRetries) {
      this.emit('retry_requested', { 
        messageId: update.messageId, 
        retryCount: history.retryCount,
        error: update.error 
      });
    } else {
      this.emit('max_retries_exceeded', { 
        messageId: update.messageId, 
        retryCount: history.retryCount,
        error: update.error 
      });
    }
  }

  getFailedMessages(): Array<{ messageId: string; status: StatusHistory }> {
    return Array.from(this.statusHistory.entries())
      .filter(([_, history]) => history.finalStatus === 'failed')
      .map(([messageId, history]) => ({ messageId, status: history }));
  }

  // ============================================================================
// ANALYTICS
  // ============================================================================

  private initializeAnalytics(): StatusAnalytics {
    return {
      totalMessages: 0,
      sentMessages: 0,
      deliveredMessages: 0,
      readMessages: 0,
      failedMessages: 0,
      averageDeliveryTime: 0,
      averageReadTime: 0,
      deliveryRate: 0,
      readRate: 0,
      failureRate: 0,
    };
  }

  private updateAnalytics(update: StatusUpdate): void {
    this.analytics.totalMessages++;

    switch (update.status) {
      case 'sent':
        this.analytics.sentMessages++;
        break;
      case 'delivered':
        this.analytics.deliveredMessages++;
        break;
      case 'read':
        this.analytics.readMessages++;
        break;
      case 'failed':
        this.analytics.failedMessages++;
        break;
    }

    // Calculate rates
    if (this.analytics.sentMessages > 0) {
      this.analytics.deliveryRate = 
        (this.analytics.deliveredMessages / this.analytics.sentMessages) * 100;
      this.analytics.readRate = 
        (this.analytics.readMessages / this.analytics.deliveredMessages) * 100;
      this.analytics.failureRate = 
        (this.analytics.failedMessages / this.analytics.sentMessages) * 100;
    }

    // Calculate averages
    this.analytics.averageDeliveryTime = this.getAverageDeliveryTime();
    this.analytics.averageReadTime = this.getAverageReadTime();
  }

  getAnalytics(): StatusAnalytics {
    return { ...this.analytics };
  }

  resetAnalytics(): void {
    this.analytics = this.initializeAnalytics();
    this.emit('analytics_reset', {});
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
          console.error(`Error in status tracker event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // CONFIGURATION
  // ============================================================================

  updateConfig(config: Partial<StatusTrackingConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  getConfig(): StatusTrackingConfig {
    return { ...this.config };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  getStats(): {
    totalTrackedMessages: number;
    pendingStatusUpdates: number;
    analytics: StatusAnalytics;
  } {
    return {
      totalTrackedMessages: this.statusHistory.size,
      pendingStatusUpdates: this.pendingStatus.size,
      analytics: this.getAnalytics(),
    };
  }

  reset(): void {
    this.statusHistory.clear();
    this.pendingStatus.clear();
    this.resetAnalytics();
    this.emit('tracker_reset', {});
  }
}

// ============================================================================
// STATUS UPDATE BUILDER
// ============================================================================

export class StatusUpdateBuilder {
  private update: Partial<StatusUpdate> = {};

  static create(): StatusUpdateBuilder {
    return new StatusUpdateBuilder();
  }

  messageId(messageId: string): StatusUpdateBuilder {
    this.update.messageId = messageId;
    return this;
  }

  status(status: MessageStatus): StatusUpdateBuilder {
    this.update.status = status;
    return this;
  }

  timestamp(timestamp: number): StatusUpdateBuilder {
    this.update.timestamp = timestamp;
    return this;
  }

  recipientId(recipientId: string): StatusUpdateBuilder {
    this.update.recipientId = recipientId;
    return this;
  }

  error(code: number, title: string, message: string): StatusUpdateBuilder {
    this.update.error = { code, title, message };
    return this;
  }

  metadata(metadata: Record<string, any>): StatusUpdateBuilder {
    this.update.metadata = metadata;
    return this;
  }

  build(): StatusUpdate {
    if (!this.update.messageId) {
      throw new Error('Message ID is required');
    }

    if (!this.update.status) {
      throw new Error('Status is required');
    }

    if (!this.update.timestamp) {
      this.update.timestamp = Date.now();
    }

    if (!this.update.recipientId) {
      throw new Error('Recipient ID is required');
    }

    return {
      messageId: this.update.messageId!,
      status: this.update.status!,
      timestamp: this.update.timestamp!,
      recipientId: this.update.recipientId!,
      error: this.update.error,
      metadata: this.update.metadata,
    };
  }
}
