/**
 * WhatsApp Operational Graph Implementation
 * 
 * A dependency-resolving execution graph for WhatsApp operations including:
 * - Message routing with validation
 * - Status updates and tracking
 * - Media handling pipeline
 * - Group management
 * - Contact synchronization
 * - Rate limiting and retry logic
 * - Real-time event processing
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type NodeType = 
  | 'webhook_receiver'
  | 'message_validator'
  | 'message_router'
  | 'text_processor'
  | 'media_handler'
  | 'group_manager'
  | 'contact_sync'
  | 'status_tracker'
  | 'rate_limiter'
  | 'retry_handler'
  | 'api_sender'
  | 'event_emitter'
  | 'state_store';

export type NodeStatus = 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'retrying';

export type EdgeType = 'dependency' | 'data_flow' | 'control_flow';

export interface GraphNode {
  id: string;
  type: NodeType;
  status: NodeStatus;
  dependencies: string[];
  data: any;
  metadata: {
    createdAt: number;
    lastExecuted?: number;
    executionCount: number;
    failureCount: number;
  };
  execute: (input: any) => Promise<any>;
  onError?: (error: Error, context: any) => Promise<void>;
  retryCount: number;
  maxRetries: number;
  timeout: number;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  condition?: (data: any) => boolean;
  transform?: (data: any) => any;
}

export interface WhatsAppMessage {
  id: string;
  from: string;
  to: string;
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'location' | 'contact';
  content: string;
  mediaUrl?: string;
  mediaMimeType?: string;
  timestamp: number;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: {
    isGroup?: boolean;
    groupId?: string;
    replyToId?: string;
    forwardCount?: number;
  };
}

export interface WhatsAppWebhookEvent {
  object: 'whatsapp_business_account';
  entry: Array<{
    id: string;
    changes: Array<{
      field: 'messages';
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: WhatsAppMessage[];
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: number;
          recipient_id: string;
        }>;
      };
    }>;
  }>;
}

export interface GroupOperation {
  type: 'create' | 'add_member' | 'remove_member' | 'update_metadata' | 'send_message' | 'delete';
  groupId?: string;
  groupName?: string;
  participantPhone?: string;
  metadata?: any;
}

export interface ContactSyncOperation {
  type: 'full_sync' | 'incremental_sync' | 'single_contact';
  contacts?: any[];
  phone?: string;
  lastSyncTimestamp?: number;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstLimit?: number;
  queueTimeout: number;
}

export interface GraphExecutionResult {
  success: boolean;
  completedNodes: string[];
  failedNodes: string[];
  errors: Map<string, Error>;
  executionTime: number;
  data: Map<string, any>;
}

// ============================================================================
// CORE OPERATIONAL GRAPH CLASS
// ============================================================================

export class WhatsAppOperationalGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private edges: Map<string, GraphEdge> = new Map();
  private executionQueue: string[] = [];
  private executingNodes: Set<string> = new Set();
  private rateLimiter: Map<string, { count: number; resetTime: number }> = new Map();
  private rateLimitConfig: RateLimitConfig;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(rateLimitConfig?: Partial<RateLimitConfig>) {
    this.rateLimitConfig = {
      maxRequests: rateLimitConfig?.maxRequests ?? 1000,
      windowMs: rateLimitConfig?.windowMs ?? 3600000, // 1 hour
      burstLimit: rateLimitConfig?.burstLimit ?? 10,
      queueTimeout: rateLimitConfig?.queueTimeout ?? 30000, // 30s
    };
  }

  // ============================================================================
  // NODE MANAGEMENT
  // ============================================================================

  addNode(node: Omit<GraphNode, 'metadata' | 'retryCount' | 'status'>): string {
    const nodeId = node.id;
    
    if (this.nodes.has(nodeId)) {
      throw new Error(`Node with ID ${nodeId} already exists`);
    }

    const graphNode: GraphNode = {
      ...node,
      status: 'idle',
      metadata: {
        createdAt: Date.now(),
        executionCount: 0,
        failureCount: 0,
      },
      retryCount: 0,
    };

    this.nodes.set(nodeId, graphNode);
    this.emit('node_added', { nodeId, type: node.type });
    return nodeId;
  }

  removeNode(nodeId: string): void {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node ${nodeId} not found`);
    }

    // Remove all edges connected to this node
    this.edges.forEach((edge, edgeId) => {
      if (edge.from === nodeId || edge.to === nodeId) {
        this.edges.delete(edgeId);
      }
    });

    this.nodes.delete(nodeId);
    this.emit('node_removed', { nodeId });
  }

  getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  // ============================================================================
  // EDGE MANAGEMENT
  // ============================================================================

  addEdge(edge: GraphEdge): void {
    const { from, to } = edge;

    if (!this.nodes.has(from)) {
      throw new Error(`Source node ${from} not found`);
    }

    if (!this.nodes.has(to)) {
      throw new Error(`Target node ${to} not found`);
    }

    const edgeId = `${from}->${to}-${Date.now()}-${Math.random()}`;
    this.edges.set(edgeId, { ...edge, id: edgeId });
    this.emit('edge_added', { edgeId, from, to, type: edge.type });
  }

  removeEdge(edgeId: string): void {
    if (!this.edges.has(edgeId)) {
      throw new Error(`Edge ${edgeId} not found`);
    }

    this.edges.delete(edgeId);
    this.emit('edge_removed', { edgeId });
  }

  getEdgesFrom(nodeId: string): GraphEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.from === nodeId);
  }

  getEdgesTo(nodeId: string): GraphEdge[] {
    return Array.from(this.edges.values()).filter(edge => edge.to === nodeId);
  }

  // ============================================================================
  // DEPENDENCY RESOLUTION
  // ============================================================================

  private getExecutionOrder(): string[] {
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const order: string[] = [];

    const visit = (nodeId: string): void => {
      if (visited.has(nodeId)) {
        return;
      }

      if (visiting.has(nodeId)) {
        throw new Error(`Circular dependency detected involving node ${nodeId}`);
      }

      visiting.add(nodeId);

      const node = this.nodes.get(nodeId);
      if (!node) {
        throw new Error(`Node ${nodeId} not found`);
      }

      // Visit dependencies first
      for (const depId of node.dependencies) {
        visit(depId);
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
      order.push(nodeId);
    };

    for (const nodeId of this.nodes.keys()) {
      visit(nodeId);
    }

    return order;
  }

  private canExecuteNode(node: GraphNode): boolean {
    // Check if node is already executing
    if (this.executingNodes.has(node.id)) {
      return false;
    }

    // Check if dependencies are completed
    for (const depId of node.dependencies) {
      const depNode = this.nodes.get(depId);
      if (!depNode) {
        throw new Error(`Dependency node ${depId} not found`);
      }

      if (depNode.status !== 'completed') {
        return false;
      }
    }

    // Check rate limits
    if (!this.checkRateLimit(node.id)) {
      return false;
    }

    return true;
  }

  // ============================================================================
  // RATE LIMITING
  // ============================================================================

  private checkRateLimit(nodeId: string): boolean {
    const now = Date.now();
    const limit = this.rateLimiter.get(nodeId);

    if (!limit) {
      this.rateLimiter.set(nodeId, { count: 1, resetTime: now + this.rateLimitConfig.windowMs });
      return true;
    }

    if (now > limit.resetTime) {
      this.rateLimiter.set(nodeId, { count: 1, resetTime: now + this.rateLimitConfig.windowMs });
      return true;
    }

    if (limit.count >= this.rateLimitConfig.maxRequests) {
      return false;
    }

    limit.count++;
    return true;
  }

  updateRateLimitConfig(config: Partial<RateLimitConfig>): void {
    this.rateLimitConfig = { ...this.rateLimitConfig, ...config };
    this.emit('rate_limit_updated', this.rateLimitConfig);
  }

  getRateLimitStatus(nodeId: string): { allowed: boolean; count: number; resetTime: number } {
    const limit = this.rateLimiter.get(nodeId);
    const now = Date.now();

    if (!limit || now > limit.resetTime) {
      return { allowed: true, count: 0, resetTime: now + this.rateLimitConfig.windowMs };
    }

    return {
      allowed: limit.count < this.rateLimitConfig.maxRequests,
      count: limit.count,
      resetTime: limit.resetTime,
    };
  }

  // ============================================================================
  // GRAPH EXECUTION
  // ============================================================================

  async execute(eventData: WhatsAppWebhookEvent): Promise<GraphExecutionResult> {
    const startTime = Date.now();
    const errors = new Map<string, Error>();
    const data = new Map<string, any>();
    const completedNodes: string[] = [];
    const failedNodes: string[] = [];

    // Get execution order (topological sort)
    const executionOrder = this.getExecutionOrder();

    // Initialize starting nodes (webhook_receiver type)
    for (const nodeId of executionOrder) {
      const node = this.nodes.get(nodeId);
      if (node && node.type === 'webhook_receiver' && node.dependencies.length === 0) {
        this.executionQueue.push(nodeId);
      }
    }

    // Execute nodes in dependency order
    while (this.executionQueue.length > 0) {
      const nodeId = this.executionQueue.shift()!;

      if (!nodeId) continue;

      const node = this.nodes.get(nodeId);
      if (!node) {
        console.warn(`Node ${nodeId} not found, skipping`);
        continue;
      }

      // Check if node can execute
      if (!this.canExecuteNode(node)) {
        // Re-queue for later
        this.executionQueue.push(nodeId);
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }

      try {
        // Mark as processing
        node.status = 'processing';
        this.executingNodes.add(nodeId);
        node.metadata.lastExecuted = Date.now();
        this.emit('node_started', { nodeId, type: node.type });

        // Get input data from dependencies
        const input = this.getNodeInput(nodeId, data, eventData);

        // Execute with timeout
        const result = await Promise.race([
          node.execute(input),
          new Promise<any>((_, reject) => 
            setTimeout(() => reject(new Error(`Node ${nodeId} timed out after ${node.timeout}ms`)), node.timeout)
          )
        ]);

        // Store output
        data.set(nodeId, result);

        // Mark as completed
        node.status = 'completed';
        node.metadata.executionCount++;
        node.retryCount = 0;
        completedNodes.push(nodeId);
        this.executingNodes.delete(nodeId);
        this.emit('node_completed', { nodeId, type: node.type, result });

        // Add dependent nodes to queue
        const outgoingEdges = this.getEdgesFrom(nodeId);
        for (const edge of outgoingEdges) {
          // Check edge condition
          if (edge.condition && !edge.condition(result)) {
            continue;
          }

          // Transform data if needed
          let transformedData = result;
          if (edge.transform) {
            transformedData = edge.transform(result);
          }

          // Merge transformed data with edge target
          data.set(edge.to, { ...data.get(edge.to), ...transformedData });
          this.executionQueue.push(edge.to);
        }

      } catch (error) {
        const err = error as Error;
        node.status = 'failed';
        node.metadata.failureCount++;
        this.executingNodes.delete(nodeId);
        failedNodes.push(nodeId);
        errors.set(nodeId, err);
        this.emit('node_failed', { nodeId, type: node.type, error: err });

        // Try error handler if available
        if (node.onError) {
          try {
            await node.onError(err, { nodeId, data: data.get(nodeId) });
          } catch (handlerError) {
            console.error(`Error handler failed for node ${nodeId}:`, handlerError);
          }
        }

        // Retry logic
        if (node.retryCount < node.maxRetries) {
          node.status = 'retrying';
          node.retryCount++;
          
          // Exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, node.retryCount), 30000);
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
          
          this.executionQueue.unshift(nodeId);
          this.emit('node_retrying', { nodeId, retryCount: node.retryCount, delay: backoffDelay });
        } else {
          // Max retries exceeded, propagate failure to dependents
          this.markDependentsFailed(nodeId, failedNodes);
        }
      }
    }

    // Reset node statuses for next execution
    this.nodes.forEach(node => {
      if (node.status === 'completed') {
        node.status = 'idle';
      }
    });

    const executionTime = Date.now() - startTime;
    const success = errors.size === 0;

    this.emit('execution_completed', {
      success,
      completedNodes,
      failedNodes,
      executionTime,
    });

    return {
      success,
      completedNodes,
      failedNodes,
      errors,
      executionTime,
      data,
    };
  }

  private getNodeInput(nodeId: string, data: Map<string, any>, eventData: WhatsAppWebhookEvent): any {
    const node = this.nodes.get(nodeId);
    if (!node) return null;

    // If node is webhook_receiver, use event data
    if (node.type === 'webhook_receiver') {
      return eventData;
    }

    // Collect data from dependencies
    const input: any = {};
    const incomingEdges = this.getEdgesTo(nodeId);

    for (const edge of incomingEdges) {
      const sourceData = data.get(edge.from);
      if (sourceData) {
        Object.assign(input, sourceData);
      }
    }

    return input;
  }

  private markDependentsFailed(nodeId: string, failedNodes: string[]): void {
    const visited = new Set<string>();
    const queue = [nodeId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      const outgoingEdges = this.getEdgesFrom(currentId);
      for (const edge of outgoingEdges) {
        const dependentNode = this.nodes.get(edge.to);
        if (dependentNode && !visited.has(edge.to)) {
          dependentNode.status = 'failed';
          failedNodes.push(edge.to);
          queue.push(edge.to);
          this.emit('node_failed', { 
            nodeId: edge.to, 
            type: dependentNode.type, 
            error: new Error(`Dependency ${currentId} failed`) 
          });
        }
      }
    }
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
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  getGraphStats(): {
    totalNodes: number;
    totalEdges: number;
    executingNodes: number;
    pendingNodes: number;
    completedNodes: number;
    failedNodes: number;
  } {
    const nodes = Array.from(this.nodes.values());
    return {
      totalNodes: nodes.length,
      totalEdges: this.edges.size,
      executingNodes: this.executingNodes.size,
      pendingNodes: nodes.filter(n => n.status === 'pending').length,
      completedNodes: nodes.filter(n => n.status === 'completed').length,
      failedNodes: nodes.filter(n => n.status === 'failed').length,
    };
  }

  reset(): void {
    this.nodes.forEach(node => {
      node.status = 'idle';
      node.retryCount = 0;
    });
    this.executionQueue = [];
    this.executingNodes.clear();
    this.emit('graph_reset', {});
  }

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for circular dependencies
    try {
      this.getExecutionOrder();
    } catch (error) {
      errors.push((error as Error).message);
    }

    // Check for orphaned nodes (no edges)
    for (const [nodeId, node] of this.nodes.entries()) {
      const incomingEdges = this.getEdgesTo(nodeId);
      const outgoingEdges = this.getEdgesFrom(nodeId);

      if (incomingEdges.length === 0 && outgoingEdges.length === 0) {
        if (node.type !== 'webhook_receiver') {
          errors.push(`Node ${nodeId} is orphaned (no edges)`);
        }
      }
    }

    // Check edge references
    for (const [edgeId, edge] of this.edges.entries()) {
      if (!this.nodes.has(edge.from)) {
        errors.push(`Edge ${edgeId} references non-existent source node ${edge.from}`);
      }
      if (!this.nodes.has(edge.to)) {
        errors.push(`Edge ${edgeId} references non-existent target node ${edge.to}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
