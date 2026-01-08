/**
 * WhatsApp Group Management System
 * 
 * Handles group operations through the operational graph with:
 * - Group creation and management
 * - Member addition/removal
 * - Admin permissions
 * - Group metadata updates
 * - Message broadcasting
 */

import { WhatsAppOperationalGraph, GroupOperation, WhatsAppMessage } from './op-graph';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WhatsAppGroup {
  id: string;
  name: string;
  description?: string;
  profilePictureUrl?: string;
  isLocked: boolean;
  isAnnouncementOnly: boolean;
  inviteLink?: string;
  participants: GroupParticipant[];
  admins: string[]; // participant IDs
  createdAt: number;
  updatedAt: number;
  metadata: {
    createdBy: string;
    memberCount: number;
    messageCount: number;
    lastActivity?: number;
  };
}

export interface GroupParticipant {
  phoneNumber: string;
  name?: string;
  role: 'admin' | 'member';
  joinedAt: number;
  isAdmin: boolean;
}

export interface GroupMessage {
  id: string;
  groupId: string;
  senderId: string;
  content: string;
  type: 'text' | 'media' | 'location' | 'contact';
  timestamp: number;
  metadata?: {
    replyToId?: string;
    mentionedParticipants?: string[];
  };
}

export interface GroupManagementConfig {
  maxGroupSize: number;
  maxAdmins: number;
  allowMemberAdd: boolean;
  allowMemberRemove: boolean;
  requireAdminApproval: boolean;
}

// ============================================================================
// GROUP MANAGER CLASS
// ============================================================================

export class WhatsAppGroupManager {
  private graph: WhatsAppOperationalGraph;
  private groups: Map<string, WhatsAppGroup> = new Map();
  private groupMessages: Map<string, GroupMessage[]> = new Map();
  private config: GroupManagementConfig;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(graph: WhatsAppOperationalGraph, config?: Partial<GroupManagementConfig>) {
    this.graph = graph;
    this.config = {
      maxGroupSize: config?.maxGroupSize ?? 1024,
      maxAdmins: config?.maxAdmins ?? 256,
      allowMemberAdd: config?.allowMemberAdd ?? true,
      allowMemberRemove: config?.allowMemberRemove ?? true,
      requireAdminApproval: config?.requireAdminApproval ?? false,
    };
  }

  // ============================================================================
  // GROUP OPERATIONS
  // ============================================================================

  async executeOperation(operation: GroupOperation): Promise<WhatsAppGroup | null> {
    try {
      switch (operation.type) {
        case 'create':
          return await this.createGroup(operation);
        case 'add_member':
          return await this.addMember(operation);
        case 'remove_member':
          return await this.removeMember(operation);
        case 'update_metadata':
          return await this.updateMetadata(operation);
        case 'delete':
          return await this.deleteGroup(operation);
        default:
          throw new Error(`Unknown operation type: ${operation.type}`);
      }
    } catch (error) {
      console.error('Error executing group operation:', error);
      this.emit('operation_failed', { operation, error: (error as Error).message });
      throw error;
    }
  }

  private async createGroup(operation: GroupOperation): Promise<WhatsAppGroup> {
    const { groupName } = operation;

    if (!groupName) {
      throw new Error('Group name is required for creation');
    }

    const groupId = this.generateGroupId();
    const creatorId = operation.metadata?.createdBy || 'system';

    const group: WhatsAppGroup = {
      id: groupId,
      name: groupName,
      description: operation.metadata?.description,
      profilePictureUrl: operation.metadata?.profilePictureUrl,
      isLocked: operation.metadata?.isLocked ?? false,
      isAnnouncementOnly: operation.metadata?.isAnnouncementOnly ?? false,
      participants: [],
      admins: [creatorId],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        createdBy: creatorId,
        memberCount: 1,
        messageCount: 0,
      },
    };

    // Add creator as participant
    group.participants.push({
      phoneNumber: creatorId,
      name: operation.metadata?.creatorName,
      role: 'admin',
      joinedAt: Date.now(),
      isAdmin: true,
    });

    this.groups.set(groupId, group);
    this.groupMessages.set(groupId, []);
    
    this.emit('group_created', { group });
    return group;
  }

  private async addMember(operation: GroupOperation): Promise<WhatsAppGroup | null> {
    const { groupId, participantPhone } = operation;

    if (!groupId || !participantPhone) {
      throw new Error('Group ID and participant phone are required');
    }

    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Check if already a member
    const existingMember = group.participants.find(
      p => p.phoneNumber === participantPhone
    );
    if (existingMember) {
      this.emit('member_exists', { groupId, participantPhone });
      return group;
    }

    // Check max group size
    if (group.participants.length >= this.config.maxGroupSize) {
      throw new Error(`Group size limit (${this.config.maxGroupSize}) reached`);
    }

    // Check if approval required
    if (this.config.requireAdminApproval) {
      this.emit('member_approval_required', { groupId, participantPhone });
      return group;
    }

    // Add member
    const participant: GroupParticipant = {
      phoneNumber: participantPhone,
      name: operation.metadata?.participantName,
      role: 'member',
      joinedAt: Date.now(),
      isAdmin: false,
    };

    group.participants.push(participant);
    group.metadata.memberCount = group.participants.length;
    group.updatedAt = Date.now();

    this.groups.set(groupId, group);
    this.emit('member_added', { groupId, participant });
    
    return group;
  }

  private async removeMember(operation: GroupOperation): Promise<WhatsAppGroup | null> {
    const { groupId, participantPhone } = operation;

    if (!groupId || !participantPhone) {
      throw new Error('Group ID and participant phone are required');
    }

    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Check if member exists
    const memberIndex = group.participants.findIndex(
      p => p.phoneNumber === participantPhone
    );
    if (memberIndex === -1) {
      throw new Error(`Participant ${participantPhone} not found in group`);
    }

    const member = group.participants[memberIndex];

    // Check permissions (admin can't remove other admins)
    if (member.isAdmin && !operation.metadata?.isSuperAdmin) {
      throw new Error('Cannot remove admin without super admin privileges');
    }

    // Remove member
    group.participants.splice(memberIndex, 1);
    group.metadata.memberCount = group.participants.length;
    group.updatedAt = Date.now();

    this.groups.set(groupId, group);
    this.emit('member_removed', { groupId, participantPhone, member });
    
    return group;
  }

  private async updateMetadata(operation: GroupOperation): Promise<WhatsAppGroup | null> {
    const { groupId } = operation;

    if (!groupId) {
      throw new Error('Group ID is required');
    }

    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Update fields
    if (operation.metadata?.groupName) {
      group.name = operation.metadata.groupName;
    }

    if (operation.metadata?.description !== undefined) {
      group.description = operation.metadata.description;
    }

    if (operation.metadata?.profilePictureUrl !== undefined) {
      group.profilePictureUrl = operation.metadata.profilePictureUrl;
    }

    if (operation.metadata?.isLocked !== undefined) {
      group.isLocked = operation.metadata.isLocked;
    }

    if (operation.metadata?.isAnnouncementOnly !== undefined) {
      group.isAnnouncementOnly = operation.metadata.isAnnouncementOnly;
    }

    group.updatedAt = Date.now();
    this.groups.set(groupId, group);

    this.emit('group_metadata_updated', { groupId, group });
    return group;
  }

  private async deleteGroup(operation: GroupOperation): Promise<WhatsAppGroup | null> {
    const { groupId } = operation;

    if (!groupId) {
      throw new Error('Group ID is required');
    }

    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Delete group
    this.groups.delete(groupId);
    this.groupMessages.delete(groupId);

    this.emit('group_deleted', { groupId, group });
    return null;
  }

  // ============================================================================
  // GROUP MANAGEMENT
  // ============================================================================

  getGroup(groupId: string): WhatsAppGroup | undefined {
    return this.groups.get(groupId);
  }

  getAllGroups(): WhatsAppGroup[] {
    return Array.from(this.groups.values());
  }

  getGroupsByParticipant(phoneNumber: string): WhatsAppGroup[] {
    return Array.from(this.groups.values()).filter(group =>
      group.participants.some(p => p.phoneNumber === phoneNumber)
    );
  }

  // ============================================================================
  // MEMBER MANAGEMENT
  // ============================================================================

  getParticipants(groupId: string): GroupParticipant[] | undefined {
    const group = this.groups.get(groupId);
    return group?.participants;
  }

  getAdmins(groupId: string): GroupParticipant[] | undefined {
    const group = this.groups.get(groupId);
    return group?.participants.filter(p => p.isAdmin);
  }

  isAdmin(groupId: string, phoneNumber: string): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;

    return group.participants.some(
      p => p.phoneNumber === phoneNumber && p.isAdmin
    );
  }

  async makeAdmin(groupId: string, phoneNumber: string): Promise<WhatsAppGroup | null> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Check max admins
    const currentAdmins = group.participants.filter(p => p.isAdmin);
    if (currentAdmins.length >= this.config.maxAdmins) {
      throw new Error(`Max admin limit (${this.config.maxAdmins}) reached`);
    }

    // Find participant
    const participant = group.participants.find(p => p.phoneNumber === phoneNumber);
    if (!participant) {
      throw new Error(`Participant ${phoneNumber} not found`);
    }

    // Make admin
    participant.isAdmin = true;
    participant.role = 'admin';
    group.admins.push(phoneNumber);
    group.updatedAt = Date.now();

    this.groups.set(groupId, group);
    this.emit('admin_promoted', { groupId, phoneNumber });
    
    return group;
  }

  async revokeAdmin(groupId: string, phoneNumber: string): Promise<WhatsAppGroup | null> {
    const group = this.groups.get(groupId);
    if (!group) {
      throw new Error(`Group ${groupId} not found`);
    }

    // Find participant
    const participant = group.participants.find(p => p.phoneNumber === phoneNumber);
    if (!participant) {
      throw new Error(`Participant ${phoneNumber} not found`);
    }

    if (!participant.isAdmin) {
      throw new Error('Participant is not an admin');
    }

    // Revoke admin
    participant.isAdmin = false;
    participant.role = 'member';
    group.admins = group.admins.filter(id => id !== phoneNumber);
    group.updatedAt = Date.now();

    this.groups.set(groupId, group);
    this.emit('admin_revoked', { groupId, phoneNumber });
    
    return group;
  }

  // ============================================================================
  // GROUP MESSAGES
  // ============================================================================

  async addGroupMessage(message: WhatsAppMessage): Promise<GroupMessage> {
    if (!message.metadata?.groupId) {
      throw new Error('Group ID is required for group messages');
    }

    const groupId = message.metadata.groupId;
    const messages = this.groupMessages.get(groupId) || [];

    const groupMessage: GroupMessage = {
      id: message.id,
      groupId,
      senderId: message.from,
      content: message.content,
      type: message.type as any,
      timestamp: message.timestamp,
      metadata: {
        replyToId: message.metadata?.replyToId,
      },
    };

    messages.push(groupMessage);
    this.groupMessages.set(groupId, messages);

    // Update group metadata
    const group = this.groups.get(groupId);
    if (group) {
      group.metadata.messageCount = messages.length;
      group.metadata.lastActivity = Date.now();
      group.updatedAt = Date.now();
      this.groups.set(groupId, group);
    }

    this.emit('group_message_added', { groupId, message: groupMessage });
    return groupMessage;
  }

  getGroupMessages(groupId: string, limit?: number): GroupMessage[] {
    const messages = this.groupMessages.get(groupId) || [];
    return limit ? messages.slice(-limit) : messages;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private generateGroupId(): string {
    return `group_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): {
    totalGroups: number;
    totalParticipants: number;
    totalMessages: number;
    averageGroupSize: number;
  } {
    const groups = Array.from(this.groups.values());
    const totalParticipants = groups.reduce((sum, g) => sum + g.metadata.memberCount, 0);
    const totalMessages = Array.from(this.groupMessages.values()).reduce(
      (sum, msgs) => sum + msgs.length,
      0
    );

    return {
      totalGroups: groups.length,
      totalParticipants,
      totalMessages,
      averageGroupSize: groups.length > 0 ? totalParticipants / groups.length : 0,
    };
  }

  updateConfig(config: Partial<GroupManagementConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  getConfig(): GroupManagementConfig {
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
          console.error(`Error in group manager event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  clearGroup(groupId: string): void {
    this.groups.delete(groupId);
    this.groupMessages.delete(groupId);
    this.emit('group_cleared', { groupId });
  }

  reset(): void {
    this.groups.clear();
    this.groupMessages.clear();
    this.emit('manager_reset', {});
  }
}
