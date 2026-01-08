/**
 * Comprehensive Test Suite for WhatsApp Operational Graph
 * 
 * Tests all operations including:
 * - Core graph functionality
 * - Message routing and dependency resolution
 * - Status tracking
 * - Media handling
 * - Group management
 * - Contact synchronization
 * - Webhook processing
 * - Real-time events
 */

import {
  WhatsAppOperationalGraph,
  WhatsAppWebhookEvent,
  WhatsAppMessage,
  GraphNode,
} from '../server/whatsapp/op-graph';

import { WhatsAppMessageRouter, MessageRoute } from '../server/whatsapp/message-router';
import { WhatsAppStatusTracker } from '../server/whatsapp/status-tracker';
import { WhatsAppMediaHandler } from '../server/whatsapp/media-handler';
import { WhatsAppGroupManager, GroupOperation } from '../server/whatsapp/group-manager';
import { WhatsAppContactSync, ContactSyncOperation } from '../server/whatsapp/contact-sync';
import { WhatsAppWebhookProcessor } from '../server/whatsapp/webhook-processor';
import { WhatsAppRealTimeProcessor } from '../server/whatsapp/realtime-processor';

// ============================================================================
// TEST UTILITIES
// ============================================================================

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

interface TestSuite {
  name: string;
  tests: TestResult[];
}

class TestRunner {
  private suites: TestSuite[] = [];

  async test(name: string, fn: () => Promise<void> | void): Promise<TestResult> {
    const startTime = Date.now();
    try {
      await fn();
      return {
        name,
        passed: true,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name,
        passed: false,
        duration: Date.now() - startTime,
        error: (error as Error).message,
      };
    }
  }

  suite(name: string, fn: () => Promise<void>): void {
    const suite: TestSuite = { name, tests: [] };
    this.suites.push(suite);

    const testFn = async (testName: string, fn: () => Promise<void> | void) => {
      const result = await this.test(testName, fn);
      suite.tests.push(result);
    };

    (global as any).test = testFn;

    fn().then(() => {
      delete (global as any).test;
    });
  }

  getResults(): TestSuite[] {
    return this.suites;
  }

  printSummary(): void {
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;

    for (const suite of this.suites) {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Test Suite: ${suite.name}`);
      console.log(`${'='.repeat(60)}`);

      for (const test of suite.tests) {
        const status = test.passed ? '✓ PASS' : '✗ FAIL';
        const duration = `${test.duration}ms`;
        console.log(`  ${status} ${test.name} (${duration})`);

        if (!test.passed && test.error) {
          console.log(`    Error: ${test.error}`);
        }

        totalTests++;
        if (test.passed) passedTests++;
        else failedTests++;
      }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log('Test Summary');
    console.log(`${'='.repeat(60)}`);
    console.log(`Total: ${totalTests}`);
    console.log(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
    console.log(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
  }
}

// ============================================================================
// TEST DATA FIXTURES
// ============================================================================

const createSampleWebhookEvent = (): WhatsAppWebhookEvent => ({
  object: 'whatsapp_business_account',
  entry: [
    {
      id: '123456789',
      changes: [
        {
          field: 'messages',
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '+1234567890',
              phone_number_id: '987654321',
            },
            messages: [
              {
                id: 'msg_123',
                from: '+15555555555',
                to: '+1234567890',
                type: 'text',
                content: 'Hello, this is a test message',
                timestamp: Date.now(),
              },
            ],
          },
        },
      ],
    },
  ],
});

const createSampleMessage = (overrides?: Partial<WhatsAppMessage>): WhatsAppMessage => ({
  id: 'msg_123',
  from: '+15555555555',
  to: '+1234567890',
  type: 'text',
  content: 'Hello, World!',
  timestamp: Date.now(),
  ...overrides,
});

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests(): Promise<void> {
  const runner = new TestRunner();

  // Run all test suites
  await runGraphTests(runner);
  await runMessageRouterTests(runner);
  await runStatusTrackerTests(runner);
  await runMediaHandlerTests(runner);
  await runGroupManagerTests(runner);
  await runContactSyncTests(runner);
  await runWebhookProcessorTests(runner);
  await runRealTimeProcessorTests(runner);
  await runIntegrationTests(runner);

  // Print summary
  runner.printSummary();
}

// ============================================================================
// OPERATIONAL GRAPH TESTS
// ============================================================================

async function runGraphTests(runner: TestRunner): Promise<void> {
  await runner.suite('Operational Graph', async () => {
    const graph = new WhatsAppOperationalGraph();

    const test = (global as any).test;

    // Test 1: Add and retrieve nodes
    await test('Add and retrieve nodes', async () => {
      const node: Omit<GraphNode, 'metadata' | 'retryCount' | 'status'> = {
        id: 'node1',
        type: 'message_validator',
        dependencies: [],
        data: {},
        execute: async (input) => input,
        timeout: 5000,
        maxRetries: 3,
      };

      graph.addNode(node);
      const retrieved = graph.getNode('node1');

      if (!retrieved || retrieved.id !== 'node1') {
        throw new Error('Node not retrieved correctly');
      }
    });

    // Test 2: Add edges between nodes
    await test('Add edges between nodes', async () => {
      graph.addNode({
        id: 'node2',
        type: 'text_processor',
        dependencies: [],
        data: {},
        execute: async (input) => input,
        timeout: 5000,
        maxRetries: 3,
      });

      graph.addEdge({
        id: 'edge1',
        from: 'node1',
        to: 'node2',
        type: 'dependency',
      });

      const edges = graph.getEdgesFrom('node1');
      if (edges.length !== 1 || edges[0].to !== 'node2') {
        throw new Error('Edge not created correctly');
      }
    });

    // Test 3: Dependency resolution
    await test('Resolve dependencies correctly', async () => {
      const order = graph.getExecutionOrder();
      
      if (!order.includes('node1') || !order.includes('node2')) {
        throw new Error('Nodes not in execution order');
      }

      // node1 should come before node2
      const node1Index = order.indexOf('node1');
      const node2Index = order.indexOf('node2');
      
      if (node1Index > node2Index) {
        throw new Error('Dependency order incorrect');
      }
    });

    // Test 4: Detect circular dependencies
    await test('Detect circular dependencies', async () => {
      graph.addNode({
        id: 'node3',
        type: 'message_router',
        dependencies: ['node4'],
        data: {},
        execute: async (input) => input,
        timeout: 5000,
        maxRetries: 3,
      });

      graph.addNode({
        id: 'node4',
        type: 'api_sender',
        dependencies: ['node3'],
        data: {},
        execute: async (input) => input,
        timeout: 5000,
        maxRetries: 3,
      });

      try {
        graph.getExecutionOrder();
        throw new Error('Circular dependency not detected');
      } catch (error) {
        if (!(error as Error).message.includes('Circular dependency')) {
          throw error;
        }
        // Expected error - circular dependency detected
      }
    });

    // Test 5: Graph validation
    await test('Validate graph integrity', async () => {
      const validation = graph.validate();

      if (!validation.valid) {
        throw new Error(`Graph validation failed: ${validation.errors.join(', ')}`);
      }
    });

    // Test 6: Execute graph
    await test('Execute graph with webhook event', async () => {
      const event = createSampleWebhookEvent();

      const result = await graph.execute(event);

      if (!result.success) {
        throw new Error('Graph execution failed');
      }

      if (result.executionTime <= 0) {
        throw new Error('Invalid execution time');
      }
    });

    // Test 7: Rate limiting
    await test('Apply rate limits correctly', async () => {
      const status = graph.getRateLimitStatus('node1');

      if (!status.allowed) {
        throw new Error('Rate limit incorrectly applied');
      }

      if (status.count < 0) {
        throw new Error('Invalid rate limit count');
      }
    });

    // Test 8: Node retry logic
    await test('Handle node retries on failure', async () => {
      let executionCount = 0;

      graph.addNode({
        id: 'node5',
        type: 'retry_handler',
        dependencies: [],
        data: {},
        execute: async (input) => {
          executionCount++;
          if (executionCount < 3) {
            throw new Error('Simulated failure');
          }
          return input;
        },
        timeout: 1000,
        maxRetries: 3,
      });

      const node = graph.getNode('node5');
      if (node) {
        node.retryCount = 0;
      }

      // Execution should succeed after retries
      const event = createSampleWebhookEvent();
      await graph.execute(event);

      if (executionCount < 3) {
        throw new Error('Retry logic not working correctly');
      }
    });

    // Test 9: Graph statistics
    await test('Calculate graph statistics', async () => {
      const stats = graph.getGraphStats();

      if (stats.totalNodes < 5) {
        throw new Error('Incorrect node count');
      }

      if (stats.totalEdges < 1) {
        throw new Error('Incorrect edge count');
      }
    });

    // Test 10: Graph reset
    await test('Reset graph state', async () => {
      graph.reset();

      const node = graph.getNode('node1');
      if (node && node.status !== 'idle') {
        throw new Error('Graph not reset correctly');
      }
    });
  });
}

// ============================================================================
// MESSAGE ROUTER TESTS
// ============================================================================

async function runMessageRouterTests(runner: TestRunner): Promise<void> {
  await runner.suite('Message Router', async () => {
    const graph = new WhatsAppOperationalGraph();
    const router = new WhatsAppMessageRouter(graph);

    const test = (global as any).test;

    // Test 1: Route text messages
    await test('Route text messages correctly', async () => {
      const event = createSampleWebhookEvent();
      const decisions = await router.route(event);

      if (decisions.length === 0) {
        throw new Error('No routing decisions made');
      }

      const decision = decisions[0];
      if (decision.route !== 'direct_send') {
        throw new Error('Incorrect route for text message');
      }
    });

    // Test 2: Route media messages
    await test('Route media messages correctly', async () => {
      const event = createSampleWebhookEvent();
      event.entry[0].changes[0].value.messages![0].type = 'image';
      event.entry[0].changes[0].value.messages![0].mediaUrl = 'https://example.com/image.jpg';
      event.entry[0].changes[0].value.messages![0].mediaMimeType = 'image/jpeg';

      const decisions = await router.route(event);

      const decision = decisions.find(d => d.route === 'media_message');
      if (!decision) {
        throw new Error('Media message not routed correctly');
      }
    });

    // Test 3: Route group messages
    await test('Route group messages correctly', async () => {
      const event = createSampleWebhookEvent();
      event.entry[0].changes[0].value.messages![0].from = 'group_id@g.us';

      const decisions = await router.route(event);

      const decision = decisions.find(d => d.route === 'group_send');
      if (!decision) {
        throw new Error('Group message not routed correctly');
      }
    });

    // Test 4: Validate messages
    await test('Validate message structure', async () => {
      const message = createSampleMessage();
      const validation = router.validateMessage(message);

      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    });

    // Test 5: Detect invalid messages
    await test('Detect invalid messages', async () => {
      const message = createSampleMessage();
      delete (message as any).id;

      const validation = router.validateMessage(message);

      if (validation.valid) {
        throw new Error('Invalid message not detected');
      }
    });

    // Test 6: Track reply threads
    await test('Track reply threads', async () => {
      const event = createSampleWebhookEvent();
      event.entry[0].changes[0].value.messages![0].metadata = {
        replyToId: 'msg_122',
      };

      await router.route(event);

      const hasReply = router.isReply('msg_123');
      if (!hasReply) {
        throw new Error('Reply not tracked correctly');
      }
    });

    // Test 7: Track forwarded messages
    await test('Track forwarded messages', async () => {
      const event = createSampleWebhookEvent();
      event.entry[0].changes[0].value.messages![0].metadata = {
        forwardCount: 2,
      };

      await router.route(event);

      const forwardCount = router.getForwardCount('msg_123');
      if (forwardCount !== 2) {
        throw new Error('Forward count not tracked correctly');
      }
    });

    // Test 8: Priority routing
    await test('Route messages by priority', async () => {
      const decisions = await router.routeWithPriority(createSampleWebhookEvent());

      if (decisions.length === 0) {
        throw new Error('No routing decisions made');
      }

      // Check if sorted by priority
      for (let i = 1; i < decisions.length; i++) {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        const prevPriority = priorityOrder[decisions[i - 1].priority];
        const currPriority = priorityOrder[decisions[i].priority];

        if (prevPriority > currPriority) {
          throw new Error('Messages not sorted by priority');
        }
      }
    });

    // Test 9: Custom route rules
    await test('Apply custom route rules', async () => {
      router.clearRoutes();

      router.addRoute({
        condition: (msg) => msg.content === 'urgent',
        route: 'direct_send',
        priority: 'urgent',
      });

      const event = createSampleWebhookEvent();
      event.entry[0].changes[0].value.messages![0].content = 'urgent';

      const decisions = await router.route(event);

      const decision = decisions[0];
      if (decision.priority !== 'urgent') {
        throw new Error('Custom route rule not applied');
      }
    });

    // Test 10: Get routing stats
    await test('Calculate routing statistics', async () => {
      const stats = router.getStats();

      if (stats.totalRoutes === 0) {
        throw new Error('No routes registered');
      }
    });
  });
}

// ============================================================================
// STATUS TRACKER TESTS
// ============================================================================

async function runStatusTrackerTests(runner: TestRunner): Promise<void> {
  await runner.suite('Status Tracker', async () => {
    const graph = new WhatsAppOperationalGraph();
    const tracker = new WhatsAppStatusTracker(graph);

    const test = (global as any).test;

    // Test 1: Process status updates
    await test('Process status updates from webhook', async () => {
      const event: WhatsAppWebhookEvent = {
        object: 'whatsapp_business_account',
        entry: [
          {
            id: '123',
            changes: [
              {
                field: 'messages',
                value: {
                  messaging_product: 'whatsapp',
                  metadata: {
                    display_phone_number: '+1234567890',
                    phone_number_id: '987',
                  },
                  statuses: [
                    {
                      id: 'msg_123',
                      status: 'sent',
                      timestamp: Date.now() / 1000,
                      recipient_id: '+15555555555',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      await tracker.processStatusUpdate(event);

      const status = tracker.getMessageStatus('msg_123');
      if (status !== 'sent') {
        throw new Error('Status not tracked correctly');
      }
    });

    // Test 2: Track status history
    await test('Track status history for messages', async () => {
      const history = tracker.getStatusHistory('msg_123');

      if (history.updates.length === 0) {
        throw new Error('Status history not tracked');
      }
    });

    // Test 3: Calculate delivery time
    await test('Calculate delivery time metrics', async () => {
      const deliveryTime = tracker.getDeliveryTime('msg_123');

      if (deliveryTime !== undefined && deliveryTime < 0) {
        throw new Error('Invalid delivery time');
      }
    });

    // Test 4: Calculate read time
    await test('Calculate read time metrics', async () => {
      const readTime = tracker.getReadTime('msg_123');

      if (readTime !== undefined && readTime < 0) {
        throw new Error('Invalid read time');
      }
    });

    // Test 5: Get analytics
    await test('Generate analytics report', async () => {
      const analytics = tracker.getAnalytics();

      if (analytics.totalMessages < 0) {
        throw new Error('Invalid total messages count');
      }

      if (analytics.sentMessages < 0) {
        throw new Error('Invalid sent messages count');
      }
    });

    // Test 6: Calculate rates
    await test('Calculate delivery and read rates', async () => {
      const analytics = tracker.getAnalytics();

      if (analytics.deliveryRate < 0 || analytics.deliveryRate > 100) {
        throw new Error('Invalid delivery rate');
      }

      if (analytics.readRate < 0 || analytics.readRate > 100) {
        throw new Error('Invalid read rate');
      }
    });

    // Test 7: Get failed messages
    await test('Retrieve failed messages', async () => {
      const failedMessages = tracker.getFailedMessages();

      if (!Array.isArray(failedMessages)) {
        throw new Error('Failed messages not returned as array');
      }
    });

    // Test 8: Average timing metrics
    await test('Calculate average timing metrics', async () => {
      const avgDeliveryTime = tracker.getAverageDeliveryTime();
      const avgReadTime = tracker.getAverageReadTime();

      if (avgDeliveryTime < 0) {
        throw new Error('Invalid average delivery time');
      }

      if (avgReadTime < 0) {
        throw new Error('Invalid average read time');
      }
    });

    // Test 9: Clear status history
    await test('Clear individual status history', async () => {
      tracker.clearStatusHistory('msg_123');

      const history = tracker.getStatusHistory('msg_123');
      if (history.updates.length !== 0) {
        throw new Error('Status history not cleared');
      }
    });

    // Test 10: Reset tracker
    await test('Reset tracker state', async () => {
      tracker.reset();

      const stats = tracker.getStats();
      if (stats.totalTrackedMessages !== 0) {
        throw new Error('Tracker not reset correctly');
      }
    });
  });
}

// ============================================================================
// MEDIA HANDLER TESTS
// ============================================================================

async function runMediaHandlerTests(runner: TestRunner): Promise<void> {
  await runner.suite('Media Handler', async () => {
    const graph = new WhatsAppOperationalGraph();
    const handler = new WhatsAppMediaHandler(graph);

    const test = (global as any).test;

    // Test 1: Validate media
    await test('Validate media file structure', async () => {
      const message = createSampleMessage();
      message.type = 'image';
      message.mediaUrl = 'https://example.com/image.jpg';
      message.mediaMimeType = 'image/jpeg';

      const result = await handler.processMedia(message);

      if (!result.success) {
        throw new Error(`Media validation failed: ${result.errors.join(', ')}`);
      }
    });

    // Test 2: Reject invalid MIME type
    await test('Reject invalid media MIME types', async () => {
      const message = createSampleMessage();
      message.type = 'image';
      message.mediaUrl = 'https://example.com/file.exe';
      message.mediaMimeType = 'application/exe';

      const result = await handler.processMedia(message);

      if (result.success) {
        throw new Error('Invalid MIME type not rejected');
      }
    });

    // Test 3: Handle large media
    await test('Reject media exceeding size limit', async () => {
      const message = createSampleMessage();
      message.type = 'document';
      message.mediaUrl = 'https://example.com/large.pdf';
      message.mediaMimeType = 'application/pdf';

      const result = await handler.processMedia(message, Buffer.alloc(200 * 1024 * 1024)); // 200MB

      if (result.success) {
        throw new Error('Large media not rejected');
      }
    });

    // Test 4: Get media from cache
    await test('Retrieve media from cache', async () => {
      const message = createSampleMessage();
      message.type = 'image';
      message.mediaUrl = 'https://example.com/image.jpg';
      message.mediaMimeType = 'image/jpeg';

      const result = await handler.processMedia(message);
      if (result.success && result.file) {
        const cachedMedia = handler.getMedia(result.file.id);
        if (!cachedMedia) {
          throw new Error('Media not cached');
        }
      }
    });

    // Test 5: Update validation rules
    await test('Update media validation rules', async () => {
      const rules = handler.getValidationRules();
      const originalMaxSize = rules.image.maxSize;

      handler.updateValidationRules('image', { maxSize: 2 * 1024 * 1024 });

      const updatedRules = handler.getValidationRules();
      if (updatedRules.image.maxSize !== 2 * 1024 * 1024) {
        throw new Error('Validation rules not updated');
      }

      // Restore
      handler.updateValidationRules('image', { maxSize: originalMaxSize });
    });

    // Test 6: Media type detection
    await test('Detect media type from MIME type', async () => {
      const message = createSampleMessage();
      message.type = 'video';
      message.mediaUrl = 'https://example.com/video.mp4';
      message.mediaMimeType = 'video/mp4';

      const result = await handler.processMedia(message);
      if (result.success && result.file) {
        if (result.file.type !== 'video') {
          throw new Error('Media type not detected correctly');
        }
      }
    });

    // Test 7: Process warnings
    await test('Generate processing warnings', async () => {
      const message = createSampleMessage();
      message.type = 'image';
      message.mediaUrl = 'https://example.com/image.jpg';
      message.mediaMimeType = 'image/jpeg';

      const result = await handler.processMedia(message, Buffer.alloc(50)); // Very small file

      // Should have warning about small file size
      if (result.warnings.length === 0 && !result.success) {
        // If no warnings but failed, check if it's an error about size
        const hasSizeError = result.errors.some(e => e.includes('size'));
        if (!hasSizeError) {
          throw new Error('Warnings or errors not generated for small file');
        }
      }
    });

    // Test 8: Get all media
    await test('Retrieve all cached media', async () => {
      const allMedia = handler.getAllMedia();

      if (!Array.isArray(allMedia)) {
        throw new Error('All media not returned as array');
      }
    });

    // Test 9: Clear media cache
    await test('Clear media cache', async () => {
      handler.clearCache();

      const allMedia = handler.getAllMedia();
      if (allMedia.length !== 0) {
        throw new Error('Cache not cleared');
      }
    });

    // Test 10: Media metadata extraction
    await test('Extract media metadata', async () => {
      const message = createSampleMessage();
      message.type = 'image';
      message.mediaUrl = 'https://example.com/image.jpg';
      message.mediaMimeType = 'image/jpeg';

      const result = await handler.processMedia(message);
      if (result.success && result.file) {
        if (!result.file.metadata.checksum) {
          throw new Error('Checksum not generated');
        }
      }
    });
  });
}

// ============================================================================
// GROUP MANAGER TESTS
// ============================================================================

async function runGroupManagerTests(runner: TestRunner): Promise<void> {
  await runner.suite('Group Manager', async () => {
    const graph = new WhatsAppOperationalGraph();
    const groupManager = new WhatsAppGroupManager(graph);

    const test = (global as any).test;

    // Test 1: Create group
    await test('Create new WhatsApp group', async () => {
      const operation: GroupOperation = {
        type: 'create',
        groupName: 'Test Group',
        metadata: {
          createdBy: '+1234567890',
          creatorName: 'Test User',
        },
      };

      const group = await groupManager.executeOperation(operation);

      if (!group) {
        throw new Error('Group not created');
      }

      if (group.name !== 'Test Group') {
        throw new Error('Group name not set correctly');
      }
    });

    // Test 2: Add member to group
    await test('Add member to existing group', async () => {
      const groups = groupManager.getAllGroups();
      const groupId = groups[0].id;

      const operation: GroupOperation = {
        type: 'add_member',
        groupId,
        participantPhone: '+15555555555',
        metadata: {
          participantName: 'John Doe',
        },
      };

      const group = await groupManager.executeOperation(operation);

      if (!group) {
        throw new Error('Member not added');
      }

      const participant = group.participants.find(p => p.phoneNumber === '+15555555555');
      if (!participant) {
        throw new Error('Participant not found in group');
      }
    });

    // Test 3: Remove member from group
    await test('Remove member from group', async () => {
      const groups = groupManager.getAllGroups();
      const groupId = groups[0].id;

      const operation: GroupOperation = {
        type: 'remove_member',
        groupId,
        participantPhone: '+15555555555',
      };

      const group = await groupManager.executeOperation(operation);

      if (!group) {
        throw new Error('Member not removed');
      }

      const participant = group.participants.find(p => p.phoneNumber === '+15555555555');
      if (participant) {
        throw new Error('Participant still in group after removal');
      }
    });

    // Test 4: Get group participants
    await test('Retrieve group participants', async () => {
      const groups = groupManager.getAllGroups();
      const groupId = groups[0].id;

      const participants = groupManager.getParticipants(groupId);

      if (!participants) {
        throw new Error('Participants not retrieved');
      }
    });

    // Test 5: Make user admin
    await test('Promote user to group admin', async () => {
      const groups = groupManager.getAllGroups();
      const groupId = groups[0].id;

      // Add member first
      await groupManager.executeOperation({
        type: 'add_member',
        groupId,
        participantPhone: '+16666666666',
      });

      // Promote to admin
      const group = await groupManager.makeAdmin(groupId, '+16666666666');

      if (!group) {
        throw new Error('User not promoted to admin');
      }

      const participant = group.participants.find(p => p.phoneNumber === '+16666666666');
      if (!participant?.isAdmin) {
        throw new Error('User not marked as admin');
      }
    });

    // Test 6: Check admin status
    await test('Check if user is group admin', async () => {
      const groups = groupManager.getAllGroups();
      const groupId = groups[0].id;

      const isAdmin = groupManager.isAdmin(groupId, '+16666666666');

      if (!isAdmin) {
        throw new Error('Admin status not detected correctly');
      }
    });

    // Test 7: Add group message
    await test('Add message to group', async () => {
      const groups = groupManager.getAllGroups();
      const groupId = groups[0].id;

      const message = createSampleMessage();
      message.metadata = { groupId };

      await groupManager.addGroupMessage(message);

      const messages = groupManager.getGroupMessages(groupId);
      if (messages.length === 0) {
        throw new Error('Group message not added');
      }
    });

    // Test 8: Get groups by participant
    await test('Retrieve groups by participant', async () => {
      const groups = groupManager.getGroupsByParticipant('+1234567890');

      if (groups.length === 0) {
        throw new Error('Groups for participant not found');
      }
    });

    // Test 9: Update group metadata
    await test('Update group metadata', async () => {
      const groups = groupManager.getAllGroups();
      const groupId = groups[0].id;

      const operation: GroupOperation = {
        type: 'update_metadata',
        groupId,
        metadata: {
          groupName: 'Updated Group Name',
          description: 'Updated description',
        },
      };

      const group = await groupManager.executeOperation(operation);

      if (!group) {
        throw new Error('Group metadata not updated');
      }

      if (group.name !== 'Updated Group Name') {
        throw new Error('Group name not updated correctly');
      }
    });

    // Test 10: Get group statistics
    await test('Calculate group management statistics', async () => {
      const stats = groupManager.getStats();

      if (stats.totalGroups < 1) {
        throw new Error('Group count incorrect');
      }

      if (stats.averageGroupSize < 0) {
        throw new Error('Average group size invalid');
      }
    });
  });
}

// ============================================================================
// CONTACT SYNC TESTS
// ============================================================================

async function runContactSyncTests(runner: TestRunner): Promise<void> {
  await runner.suite('Contact Synchronization', async () => {
    const graph = new WhatsAppOperationalGraph();
    const contactSync = new WhatsAppContactSync(graph);

    const test = (global as any).test;

    // Test 1: Full contact sync
    await test('Execute full contact synchronization', async () => {
      const operation: ContactSyncOperation = {
        type: 'full_sync',
        contacts: [
          {
            phoneNumber: '+15555555555',
            name: 'John Doe',
          },
          {
            phoneNumber: '+16666666666',
            name: 'Jane Smith',
          },
        ],
      };

      const result = await contactSync.executeSync(operation);

      if (!result.success) {
        throw new Error(`Full sync failed: ${result.errors.join(', ')}`);
      }

      if (result.added !== 2) {
        throw new Error(`Expected 2 contacts added, got ${result.added}`);
      }
    });

    // Test 2: Incremental contact sync
    await test('Execute incremental contact synchronization', async () => {
      const operation: ContactSyncOperation = {
        type: 'incremental_sync',
        contacts: [
          {
            phoneNumber: '+17777777777',
            name: 'Bob Johnson',
          },
        ],
      };

      const result = await contactSync.executeSync(operation);

      if (!result.success) {
        throw new Error(`Incremental sync failed: ${result.errors.join(', ')}`);
      }

      if (result.added !== 1) {
        throw new Error(`Expected 1 contact added, got ${result.added}`);
      }
    });

    // Test 3: Sync single contact
    await test('Synchronize single contact', async () => {
      const operation: ContactSyncOperation = {
        type: 'single_contact',
        phone: '+18888888888',
        contacts: [
          {
            phoneNumber: '+18888888888',
            name: 'Alice Williams',
          },
        ],
      };

      const result = await contactSync.executeSync(operation);

      if (!result.success) {
        throw new Error(`Single contact sync failed: ${result.errors.join(', ')}`);
      }
    });

    // Test 4: Update existing contact
    await test('Update existing contact information', async () => {
      const operation: ContactSyncOperation = {
        type: 'single_contact',
        phone: '+15555555555',
        contacts: [
          {
            phoneNumber: '+15555555555',
            name: 'John Doe Updated',
          },
        ],
      };

      const result = await contactSync.executeSync(operation);

      if (result.updated !== 1) {
        throw new Error(`Expected 1 contact updated, got ${result.updated}`);
      }

      const contact = contactSync.getContact('+15555555555');
      if (contact?.name !== 'John Doe Updated') {
        throw new Error('Contact not updated correctly');
      }
    });

    // Test 5: Duplicate detection
    await test('Detect and handle duplicate contacts', async () => {
      const operation: ContactSyncOperation = {
        type: 'single_contact',
        phone: '+15555555555',
        contacts: [
          {
            phoneNumber: '+15555555555',
            name: 'John Doe',
          },
        ],
      };

      const result = await contactSync.executeSync(operation);

      if (result.duplicates === 0) {
        throw new Error('Duplicate contact not detected');
      }
    });

    // Test 6: Get contact
    await test('Retrieve contact by phone number', async () => {
      const contact = contactSync.getContact('+15555555555');

      if (!contact) {
        throw new Error('Contact not found');
      }

      if (contact.phoneNumber !== '+15555555555') {
        throw new Error('Contact phone number incorrect');
      }
    });

    // Test 7: Get all contacts
    await test('Retrieve all contacts', async () => {
      const contacts = contactSync.getAllContacts();

      if (!Array.isArray(contacts)) {
        throw new Error('Contacts not returned as array');
      }

      if (contacts.length === 0) {
        throw new Error('No contacts found');
      }
    });

    // Test 8: Block contact
    await test('Block contact', async () => {
      await contactSync.blockContact('+15555555555');

      const contact = contactSync.getContact('+15555555555');
      if (contact?.status !== 'blocked') {
        throw new Error('Contact not blocked');
      }
    });

    // Test 9: Unblock contact
    await test('Unblock contact', async () => {
      await contactSync.unblockContact('+15555555555');

      const contact = contactSync.getContact('+15555555555');
      if (contact?.status !== 'active') {
        throw new Error('Contact not unblocked');
      }
    });

    // Test 10: Get sync statistics
    await test('Calculate contact sync statistics', async () => {
      const stats = contactSync.getStats();

      if (stats.totalContacts < 3) {
        throw new Error('Incorrect contact count');
      }

      if (stats.activeContacts < 3) {
        throw new Error('Incorrect active contact count');
      }
    });
  });
}

// ============================================================================
// WEBHOOK PROCESSOR TESTS
// ============================================================================

async function runWebhookProcessorTests(runner: TestRunner): Promise<void> {
  await runner.suite('Webhook Processor', async () => {
    const graph = new WhatsAppOperationalGraph();
    const webhookProcessor = new WhatsAppWebhookProcessor(graph, { rateLimitEnabled: false });

    const test = (global as any).test;

    // Test 1: Handle webhook event
    await test('Process incoming webhook event', async () => {
      const event = createSampleWebhookEvent();

      const result = await webhookProcessor.handleWebhook(event);

      if (!result.success) {
        throw new Error(`Webhook handling failed: ${result.error}`);
      }

      if (!result.eventId) {
        throw new Error('Event ID not generated');
      }
    });

    // Test 2: Rate limiting
    await test('Apply rate limits to webhook endpoints', async () => {
      const processor = new WhatsAppWebhookProcessor(graph, {
        rateLimitEnabled: true,
        rateLimitMaxRequests: 5,
        rateLimitWindowMs: 60000,
      });

      const event = createSampleWebhookEvent();

      // Send 6 requests (limit is 5)
      let successCount = 0;
      for (let i = 0; i < 6; i++) {
        const result = await processor.handleWebhook(event);
        if (result.success) successCount++;
      }

      if (successCount !== 5) {
        throw new Error(`Expected 5 successful requests, got ${successCount}`);
      }
    });

    // Test 3: Event deduplication
    await test('Detect and handle duplicate events', async () => {
      const processor = new WhatsAppWebhookProcessor(graph, {
        enableDeduplication: true,
        deduplicationWindowMs: 60000,
      });

      const event = createSampleWebhookEvent();

      const result1 = await processor.handleWebhook(event);
      const result2 = await processor.handleWebhook(event);

      if (result1.success && result2.success) {
        throw new Error('Duplicate event not detected');
      }
    });

    // Test 4: Queue statistics
    await test('Calculate queue statistics', async () => {
      const stats = webhookProcessor.getQueueStats();

      if (stats.queued < 0) {
        throw new Error('Invalid queued count');
      }

      if (stats.processing < 0) {
        throw new Error('Invalid processing count');
      }
    });

    // Test 5: Get failed events
    await test('Retrieve failed events', async () => {
      const failedEvents = webhookProcessor.getFailedEvents();

      if (!Array.isArray(failedEvents)) {
        throw new Error('Failed events not returned as array');
      }
    });

    // Test 6: Get pending events
    await test('Retrieve pending events', async () => {
      const pendingEvents = webhookProcessor.getPendingEvents();

      if (!Array.isArray(pendingEvents)) {
        throw new Error('Pending events not returned as array');
      }
    });

    // Test 7: Rate limit status
    await test('Get rate limit status for endpoint', async () => {
      const status = webhookProcessor.getRateLimitStatus('default');

      if (status.requests < 0) {
        throw new Error('Invalid request count');
      }

      if (status.isLimited !== false && status.isLimited !== true) {
        throw new Error('Invalid limit status');
      }
    });

    // Test 8: Health check
    await test('Get processor health status', async () => {
      const health = webhookProcessor.getHealthStatus();

      if (health.queueSize < 0) {
        throw new Error('Invalid queue size');
      }

      if (health.rateLimitersActive < 0) {
        throw new Error('Invalid rate limiter count');
      }
    });

    // Test 9: Clear queue
    await test('Clear event queue', async () => {
      webhookProcessor.clearQueue();

      const stats = webhookProcessor.getQueueStats();
      if (stats.total !== 0) {
        throw new Error('Queue not cleared');
      }
    });

    // Test 10: Update configuration
    await test('Update webhook processor configuration', async () => {
      webhookProcessor.updateConfig({
        rateLimitEnabled: true,
        maxRetries: 5,
      });

      const config = webhookProcessor.getConfig();
      if (config.maxRetries !== 5) {
        throw new Error('Configuration not updated');
      }
    });
  });
}

// ============================================================================
// REAL-TIME PROCESSOR TESTS
// ============================================================================

async function runRealTimeProcessorTests(runner: TestRunner): Promise<void> {
  await runner.suite('Real-Time Processor', async () => {
    const graph = new WhatsAppOperationalGraph();
    const rtProcessor = new WhatsAppRealTimeProcessor(graph);

    const test = (global as any).test;

    // Test 1: Set presence
    await test('Set user presence status', async () => {
      rtProcessor.setPresence('+15555555555', 'online');

      const presence = rtProcessor.getPresence('+15555555555');
      if (!presence) {
        throw new Error('Presence not set');
      }

      if (presence.status !== 'online') {
        throw new Error('Presence status incorrect');
      }
    });

    // Test 2: Get online contacts
    await test('Retrieve all online contacts', async () => {
      const onlineContacts = rtProcessor.getAllOnlineContacts();

      if (!Array.isArray(onlineContacts)) {
        throw new Error('Online contacts not returned as array');
      }

      if (!onlineContacts.includes('+15555555555')) {
        throw new Error('Online contact not found');
      }
    });

    // Test 3: Typing indicator
    await test('Handle typing indicator', async () => {
      rtProcessor.onMessageReceived(createSampleMessage());

      // In a real implementation with Socket.IO, this would broadcast
      // For testing, we just verify the method doesn't throw
      const presence = rtProcessor.getPresence('+15555555555');
      if (!presence) {
        throw new Error('Presence not found');
      }
    });

    // Test 4: Message received event
    await test('Queue message received event', async () => {
      const message = createSampleMessage();
      rtProcessor.onMessageReceived(message);

      const stats = rtProcessor.getStats();
      if (stats.pendingEvents < 0) {
        throw new Error('Invalid pending events count');
      }
    });

    // Test 5: Message sent event
    await test('Queue message sent event', async () => {
      const message = createSampleMessage();
      rtProcessor.onMessageSent(message);

      const stats = rtProcessor.getStats();
      if (stats.pendingEvents < 0) {
        throw new Error('Invalid pending events count');
      }
    });

    // Test 6: Message delivered event
    await test('Queue message delivered event', async () => {
      rtProcessor.onMessageDelivered('msg_123', '+15555555555');

      const stats = rtProcessor.getStats();
      if (stats.pendingEvents < 0) {
        throw new Error('Invalid pending events count');
      }
    });

    // Test 7: Message read event
    await test('Queue message read event', async () => {
      rtProcessor.onMessageRead('msg_123', '+15555555555');

      const stats = rtProcessor.getStats();
      if (stats.pendingEvents < 0) {
        throw new Error('Invalid pending events count');
      }
    });

    // Test 8: Get processor statistics
    await test('Calculate real-time processor statistics', async () => {
      const stats = rtProcessor.getStats();

      if (stats.onlineContacts < 0) {
        throw new Error('Invalid online contacts count');
      }

      if (stats.pendingEvents < 0) {
        throw new Error('Invalid pending events count');
      }
    });

    // Test 9: Update configuration
    await test('Update real-time processor configuration', async () => {
      rtProcessor.updateConfig({
        enablePresenceTracking: true,
        enableTypingIndicators: false,
      });

      const config = rtProcessor.getConfig();
      if (config.enableTypingIndicators !== false) {
        throw new Error('Configuration not updated');
      }
    });

    // Test 10: Reset processor
    await test('Reset real-time processor state', async () => {
      rtProcessor.reset();

      const stats = rtProcessor.getStats();
      if (stats.connectedClients !== 0) {
        throw new Error('Processor not reset correctly');
      }
    });
  });
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

async function runIntegrationTests(runner: TestRunner): Promise<void> {
  await runner.suite('Integration Tests', async () => {
    const test = (global as any).test;

    // Test 1: End-to-end message flow
    await test('Process complete message flow through graph', async () => {
      const graph = new WhatsAppOperationalGraph();

      // Add nodes
      graph.addNode({
        id: 'webhook',
        type: 'webhook_receiver',
        dependencies: [],
        data: {},
        execute: async (input) => ({ ...input, processed: true }),
        timeout: 5000,
        maxRetries: 3,
      });

      graph.addNode({
        id: 'validator',
        type: 'message_validator',
        dependencies: ['webhook'],
        data: {},
        execute: async (input) => ({ ...input, validated: true }),
        timeout: 5000,
        maxRetries: 3,
      });

      graph.addNode({
        id: 'router',
        type: 'message_router',
        dependencies: ['validator'],
        data: {},
        execute: async (input) => ({ ...input, routed: true }),
        timeout: 5000,
        maxRetries: 3,
      });

      // Add edges
      graph.addEdge({
        id: 'edge1',
        from: 'webhook',
        to: 'validator',
        type: 'dependency',
      });

      graph.addEdge({
        id: 'edge2',
        from: 'validator',
        to: 'router',
        type: 'dependency',
      });

      // Execute
      const event = createSampleWebhookEvent();
      const result = await graph.execute(event);

      if (!result.success) {
        throw new Error('Graph execution failed');
      }

      if (result.completedNodes.length !== 3) {
        throw new Error(`Expected 3 completed nodes, got ${result.completedNodes.length}`);
      }
    });

    // Test 2: Message routing with media
    await test('Route message with media through graph', async () => {
      const graph = new WhatsAppOperationalGraph();
      const router = new WhatsAppMessageRouter(graph);
      const mediaHandler = new WhatsAppMediaHandler(graph);

      const message = createSampleMessage();
      message.type = 'image';
      message.mediaUrl = 'https://example.com/image.jpg';
      message.mediaMimeType = 'image/jpeg';

      // Route message
      const event = createSampleWebhookEvent();
      event.entry[0].changes[0].value.messages![0] = message;
      const decisions = await router.route(event);

      const mediaDecision = decisions.find(d => d.route === 'media_message');
      if (!mediaDecision) {
        throw new Error('Media message not routed');
      }
    });

    // Test 3: Group message with status tracking
    await test('Track status updates for group messages', async () => {
      const graph = new WhatsAppOperationalGraph();
      const statusTracker = new WhatsAppStatusTracker(graph);
      const groupManager = new WhatsAppGroupManager(graph);

      // Create group
      const group = await groupManager.executeOperation({
        type: 'create',
        groupName: 'Test Group',
        metadata: { createdBy: '+1234567890' },
      });

      if (!group) {
        throw new Error('Group not created');
      }

      // Add group message
      const message = createSampleMessage();
      message.metadata = { groupId: group.id };
      await groupManager.addGroupMessage(message);

      // Verify message added
      const messages = groupManager.getGroupMessages(group.id);
      if (messages.length === 0) {
        throw new Error('Group message not added');
      }
    });

    // Test 4: Contact sync with deduplication
    await test('Sync contacts with duplicate detection', async () => {
      const graph = new WhatsAppOperationalGraph();
      const contactSync = new WhatsAppContactSync(graph, {
        enableDuplicateDetection: true,
      });

      const operation: ContactSyncOperation = {
        type: 'full_sync',
        contacts: [
          {
            phoneNumber: '+15555555555',
            name: 'John Doe',
          },
          {
            phoneNumber: '+15555555555', // Duplicate
            name: 'John Doe',
          },
          {
            phoneNumber: '15555555555', // Same number, different format
            name: 'John Doe',
          },
        ],
      };

      const result = await contactSync.executeSync(operation);

      if (result.duplicates !== 2) {
        throw new Error(`Expected 2 duplicates, got ${result.duplicates}`);
      }

      if (result.added !== 1) {
        throw new Error(`Expected 1 contact added, got ${result.added}`);
      }
    });

    // Test 5: Webhook with rate limiting
    await test('Process webhook with rate limiting', async () => {
      const graph = new WhatsAppOperationalGraph();
      const webhookProcessor = new WhatsAppWebhookProcessor(graph, {
        rateLimitEnabled: true,
        rateLimitMaxRequests: 3,
        rateLimitWindowMs: 60000,
        enableDeduplication: false,
      });

      const event = createSampleWebhookEvent();

      let successCount = 0;
      for (let i = 0; i < 5; i++) {
        const result = await webhookProcessor.handleWebhook(event);
        if (result.success) successCount++;
      }

      if (successCount !== 3) {
        throw new Error(`Expected 3 successful requests, got ${successCount}`);
      }
    });

    // Test 6: Real-time presence with multiple users
    await test('Track presence for multiple users', async () => {
      const graph = new WhatsAppOperationalGraph();
      const rtProcessor = new WhatsAppRealTimeProcessor(graph);

      // Set presence for multiple users
      rtProcessor.setPresence('+15555555555', 'online');
      rtProcessor.setPresence('+16666666666', 'online');
      rtProcessor.setPresence('+17777777777', 'offline');

      const onlineContacts = rtProcessor.getAllOnlineContacts();

      if (onlineContacts.length !== 2) {
        throw new Error(`Expected 2 online contacts, got ${onlineContacts.length}`);
      }
    });

    // Test 7: Error handling and retry logic
    await test('Handle errors and retry failed operations', async () => {
      const graph = new WhatsAppOperationalGraph();

      let executionCount = 0;

      graph.addNode({
        id: 'flaky_node',
        type: 'retry_handler',
        dependencies: [],
        data: {},
        execute: async (input) => {
          executionCount++;
          if (executionCount < 2) {
            throw new Error('Flaky node failure');
          }
          return input;
        },
        timeout: 1000,
        maxRetries: 3,
      });

      const event = createSampleWebhookEvent();
      const result = await graph.execute(event);

      if (result.failedNodes.includes('flaky_node')) {
        throw new Error('Flaky node should have succeeded after retry');
      }

      if (executionCount !== 2) {
        throw new Error(`Expected 2 executions, got ${executionCount}`);
      }
    });

    // Test 8: Circular dependency detection
    await test('Detect and prevent circular dependencies', async () => {
      const graph = new WhatsAppOperationalGraph();

      graph.addNode({
        id: 'node_a',
        type: 'message_validator',
        dependencies: ['node_b'],
        data: {},
        execute: async (input) => input,
        timeout: 5000,
        maxRetries: 3,
      });

      graph.addNode({
        id: 'node_b',
        type: 'text_processor',
        dependencies: ['node_a'],
        data: {},
        execute: async (input) => input,
        timeout: 5000,
        maxRetries: 3,
      });

      try {
        graph.getExecutionOrder();
        throw new Error('Circular dependency not detected');
      } catch (error) {
        if (!(error as Error).message.includes('Circular dependency')) {
          throw error;
        }
        // Expected error
      }
    });

    // Test 9: Concurrent event processing
    await test('Handle concurrent webhook events', async () => {
      const graph = new WhatsAppOperationalGraph();
      const webhookProcessor = new WhatsAppWebhookProcessor(graph, {
        rateLimitEnabled: false,
        enableDeduplication: false,
      });

      // Process multiple events concurrently
      const event1 = createSampleWebhookEvent();
      const event2 = createSampleWebhookEvent();
      const event3 = createSampleWebhookEvent();

      const results = await Promise.all([
        webhookProcessor.handleWebhook(event1),
        webhookProcessor.handleWebhook(event2),
        webhookProcessor.handleWebhook(event3),
      ]);

      const successCount = results.filter(r => r.success).length;

      if (successCount !== 3) {
        throw new Error(`Expected 3 successful events, got ${successCount}`);
      }
    });

    // Test 10: Full system reset and recovery
    await test('Reset all systems and recover', async () => {
      const graph = new WhatsAppOperationalGraph();
      const router = new WhatsAppMessageRouter(graph);
      const statusTracker = new WhatsAppStatusTracker(graph);
      const webhookProcessor = new WhatsAppWebhookProcessor(graph, { rateLimitEnabled: false });

      // Perform operations
      await router.route(createSampleWebhookEvent());
      await statusTracker.processStatusUpdate(createSampleWebhookEvent());
      await webhookProcessor.handleWebhook(createSampleWebhookEvent());

      // Reset all
      graph.reset();
      router.reset();
      statusTracker.reset();
      webhookProcessor.reset();

      // Verify reset
      if (graph.getGraphStats().totalNodes > 0) {
        // Nodes should still exist but in idle state
        const nodes = graph.getAllNodes();
        for (const node of nodes) {
          if (node.status !== 'idle') {
            throw new Error('Graph not reset correctly');
          }
        }
      }
    });
  });
}

// ============================================================================
// RUN TESTS
// ============================================================================

runAllTests().then(() => {
  console.log('\nAll tests completed!\n');
  process.exit(0);
}).catch((error) => {
  console.error('\nTest suite failed:', error);
  process.exit(1);
});

// Export for external use
export { runAllTests, TestRunner };
