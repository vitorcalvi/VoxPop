/**
 * WhatsApp Message Router with Dependency Resolution
 * 
 * Handles intelligent routing of WhatsApp messages through the operational graph,
 * with support for:
 * - Message type detection and routing
 * - Group vs individual message handling
 * - Reply threading
 * - Forward tracking
 * - Priority routing
 */

import { WhatsAppMessage, WhatsAppWebhookEvent, WhatsAppOperationalGraph } from './op-graph';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type MessageRoute = 
  | 'direct_send'
  | 'group_send'
  | 'broadcast'
  | 'template_message'
  | 'interactive_message'
  | 'media_message'
  | 'location_message'
  | 'contact_message';

export type MessagePriority = 'urgent' | 'high' | 'normal' | 'low';

export interface RouteRule {
  condition: (message: WhatsAppMessage) => boolean;
  route: MessageRoute;
  priority: MessagePriority;
  metadata?: Record<string, any>;
}

export interface RoutingContext {
  message: WhatsAppMessage;
  originalEvent?: WhatsAppWebhookEvent;
  route: MessageRoute;
  priority: MessagePriority;
  metadata: Record<string, any>;
  timestamp: number;
  correlationId: string;
}

export interface RoutingDecision {
  route: MessageRoute;
  priority: MessagePriority;
  nodesToExecute: string[];
  estimatedLatency: number;
  requiresRetry: boolean;
  metadata?: Record<string, any>;
}

// ============================================================================
// MESSAGE ROUTER CLASS
// ============================================================================

export class WhatsAppMessageRouter {
  private graph: WhatsAppOperationalGraph;
  private routeRules: RouteRule[] = [];
  private messageCache: Map<string, RoutingContext> = new Map();
  private replyThreads: Map<string, string[]> = new Map(); // messageId -> [replyIds]
  private forwardTracker: Map<string, number> = new Map(); // messageId -> forwardCount

  constructor(graph: WhatsAppOperationalGraph) {
    this.graph = graph;
    this.initializeDefaultRoutes();
  }

  // ============================================================================
  // ROUTE RULE MANAGEMENT
  // ============================================================================

  private initializeDefaultRoutes(): void {
    // Group messages
    this.addRoute({
      condition: (msg) => msg.metadata?.isGroup === true,
      route: 'group_send',
      priority: 'normal',
    });

    // Template messages
    this.addRoute({
      condition: (msg) => msg.metadata?.isTemplate === true,
      route: 'template_message',
      priority: 'high',
    });

    // Interactive messages
    this.addRoute({
      condition: (msg) => msg.metadata?.isInteractive === true,
      route: 'interactive_message',
      priority: 'high',
    });

    // Media messages
    this.addRoute({
      condition: (msg) => ['image', 'video', 'audio', 'document'].includes(msg.type),
      route: 'media_message',
      priority: 'normal',
    });

    // Location messages
    this.addRoute({
      condition: (msg) => msg.type === 'location',
      route: 'location_message',
      priority: 'normal',
    });

    // Contact messages
    this.addRoute({
      condition: (msg) => msg.type === 'contact',
      route: 'contact_message',
      priority: 'normal',
    });

    // Broadcast messages
    this.addRoute({
      condition: (msg) => msg.metadata?.isBroadcast === true,
      route: 'broadcast',
      priority: 'low',
    });

    // Default: direct send
    this.addRoute({
      condition: () => true,
      route: 'direct_send',
      priority: 'normal',
    });
  }

  addRoute(rule: RouteRule): void {
    this.routeRules.push(rule);
    // Sort by priority (urgent first)
    this.routeRules.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  removeRoute(condition: (message: WhatsAppMessage) => boolean): void {
    this.routeRules = this.routeRules.filter(rule => rule.condition !== condition);
  }

  clearRoutes(): void {
    this.routeRules = [];
    this.initializeDefaultRoutes();
  }

  // ============================================================================
  // ROUTING LOGIC
  // ============================================================================

  async route(event: WhatsAppWebhookEvent): Promise<RoutingDecision[]> {
    const decisions: RoutingDecision[] = [];

    try {
      // Extract messages from event
      const messages = this.extractMessages(event);

      for (const message of messages) {
        const decision = await this.routeMessage(message, event);
        decisions.push(decision);

        // Track reply threads
        if (message.metadata?.replyToId) {
          this.trackReply(message.metadata.replyToId, message.id);
        }

        // Track forwards
        if (message.metadata?.forwardCount && message.metadata.forwardCount > 0) {
          this.trackForward(message.id, message.metadata.forwardCount);
        }

        // Cache routing context
        const context: RoutingContext = {
          message,
          originalEvent: event,
          route: decision.route,
          priority: decision.priority,
          metadata: decision.metadata || {},
          timestamp: Date.now(),
          correlationId: this.generateCorrelationId(message),
        };

        this.messageCache.set(message.id, context);
      }

      return decisions;
    } catch (error) {
      console.error('Error routing messages:', error);
      throw new Error(`Message routing failed: ${(error as Error).message}`);
    }
  }

  private async routeMessage(message: WhatsAppMessage, event: WhatsAppWebhookEvent): Promise<RoutingDecision> {
    // Find matching route
    for (const rule of this.routeRules) {
      if (rule.condition(message)) {
        const nodesToExecute = this.getNodesForRoute(rule.route);
        const estimatedLatency = this.estimateLatency(rule.route, nodesToExecute);

        return {
          route: rule.route,
          priority: rule.priority,
          nodesToExecute,
          estimatedLatency,
          requiresRetry: false,
          metadata: rule.metadata,
        };
      }
    }

    // Default fallback
    return {
      route: 'direct_send',
      priority: 'normal',
      nodesToExecute: this.getNodesForRoute('direct_send'),
      estimatedLatency: 1000,
      requiresRetry: false,
    };
  }

  private extractMessages(event: WhatsAppWebhookEvent): WhatsAppMessage[] {
    const messages: WhatsAppMessage[] = [];

    for (const entry of event.entry) {
      for (const change of entry.changes) {
        if (change.field === 'messages' && change.value.messages) {
          for (const msg of change.value.messages) {
            // Determine if group message
            const isGroup = msg.from.includes('@g.us');
            
            messages.push({
              ...msg,
              metadata: {
                ...msg.metadata,
                isGroup,
                groupId: isGroup ? msg.from : undefined,
              },
            });
          }
        }
      }
    }

    return messages;
  }

  private getNodesForRoute(route: MessageRoute): string[] {
    // Map routes to graph nodes
    const nodeMap: Record<MessageRoute, string[]> = {
      direct_send: ['message_validator', 'text_processor', 'api_sender'],
      group_send: ['message_validator', 'group_manager', 'api_sender'],
      broadcast: ['message_validator', 'rate_limiter', 'api_sender'],
      template_message: ['message_validator', 'api_sender'],
      interactive_message: ['message_validator', 'api_sender'],
      media_message: ['message_validator', 'media_handler', 'api_sender'],
      location_message: ['message_validator', 'api_sender'],
      contact_message: ['message_validator', 'contact_sync', 'api_sender'],
    };

    return nodeMap[route] || [];
  }

  private estimateLatency(route: MessageRoute, nodes: string[]): number {
    // Base latency per node type
    const nodeLatency: Record<string, number> = {
      message_validator: 10,
      text_processor: 50,
      media_handler: 500,
      group_manager: 100,
      contact_sync: 200,
      rate_limiter: 5,
      api_sender: 300,
    };

    let total = 0;
    for (const node of nodes) {
      total += nodeLatency[node] || 100;
    }

    return total;
  }

  // ============================================================================
  // REPLY THREADING
  // ============================================================================

  private trackReply(originalMessageId: string, replyId: string): void {
    if (!this.replyThreads.has(originalMessageId)) {
      this.replyThreads.set(originalMessageId, []);
    }
    this.replyThreads.get(originalMessageId)!.push(replyId);
  }

  getReplyThread(messageId: string): string[] {
    return this.replyThreads.get(messageId) || [];
  }

  isReply(messageId: string): boolean {
    // Check if this message is a reply to another
    for (const context of this.messageCache.values()) {
      if (context.message.id === messageId && context.message.metadata?.replyToId) {
        return true;
      }
    }
    return false;
  }

  // ============================================================================
  // FORWARD TRACKING
  // ============================================================================

  private trackForward(messageId: string, count: number): void {
    this.forwardTracker.set(messageId, count);
  }

  getForwardCount(messageId: string): number {
    return this.forwardTracker.get(messageId) || 0;
  }

  isForwarded(messageId: string): boolean {
    return this.forwardTracker.has(messageId);
  }

  // ============================================================================
  // ROUTING CONTEXT MANAGEMENT
  // ============================================================================

  getRoutingContext(messageId: string): RoutingContext | undefined {
    return this.messageCache.get(messageId);
  }

  getRoutingContexts(): RoutingContext[] {
    return Array.from(this.messageCache.values());
  }

  clearRoutingContext(messageId: string): void {
    this.messageCache.delete(messageId);
  }

  clearAllRoutingContexts(): void {
    this.messageCache.clear();
  }

  // ============================================================================
  // PRIORITY QUEUE MANAGEMENT
  // ============================================================================

  async routeWithPriority(event: WhatsAppWebhookEvent): Promise<RoutingDecision[]> {
    const decisions = await this.route(event);

    // Sort by priority
    decisions.sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    return decisions;
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================

  validateMessage(message: WhatsAppMessage): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!message.id) {
      errors.push('Message ID is required');
    }

    if (!message.from) {
      errors.push('Message sender is required');
    }

    if (!message.to) {
      errors.push('Message recipient is required');
    }

    if (!message.type) {
      errors.push('Message type is required');
    }

    // Type-specific validation
    if (['image', 'video', 'audio', 'document'].includes(message.type)) {
      if (!message.mediaUrl) {
        errors.push(`Media URL is required for ${message.type} messages`);
      }

      if (!message.mediaMimeType) {
        errors.push(`Media MIME type is required for ${message.type} messages`);
      }
    }

    if (message.type === 'text' && !message.content) {
      errors.push('Message content is required for text messages');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateCorrelationId(message: WhatsAppMessage): string {
    return `${message.from}-${message.to}-${message.id}-${Date.now()}`;
  }

  getStats(): {
    totalRoutes: number;
    cachedMessages: number;
    replyThreads: number;
    forwardedMessages: number;
  } {
    return {
      totalRoutes: this.routeRules.length,
      cachedMessages: this.messageCache.size,
      replyThreads: this.replyThreads.size,
      forwardedMessages: this.forwardTracker.size,
    };
  }

  reset(): void {
    this.messageCache.clear();
    this.replyThreads.clear();
    this.forwardTracker.clear();
    this.initializeDefaultRoutes();
  }
}

// ============================================================================
// ROUTE RULE BUILDER
// ============================================================================

export class RouteRuleBuilder {
  private rule: Partial<RouteRule> = {};

  static create(): RouteRuleBuilder {
    return new RouteRuleBuilder();
  }

  condition(condition: (message: WhatsAppMessage) => boolean): RouteRuleBuilder {
    this.rule.condition = condition;
    return this;
  }

  route(route: MessageRoute): RouteRuleBuilder {
    this.rule.route = route;
    return this;
  }

  priority(priority: MessagePriority): RouteRuleBuilder {
    this.rule.priority = priority;
    return this;
  }

  metadata(metadata: Record<string, any>): RouteRuleBuilder {
    this.rule.metadata = metadata;
    return this;
  }

  build(): RouteRule {
    if (!this.rule.condition) {
      throw new Error('Route condition is required');
    }

    if (!this.rule.route) {
      throw new Error('Route is required');
    }

    return {
      condition: this.rule.condition!,
      route: this.rule.route!,
      priority: this.rule.priority || 'normal',
      metadata: this.rule.metadata,
    };
  }
}
