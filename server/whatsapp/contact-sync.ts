/**
 * WhatsApp Contact Synchronization System
 * 
 * Handles contact data sync through the operational graph with:
 * - Full and incremental sync
 * - Duplicate detection and merging
 * - Contact validation
 * - Contact metadata management
 * - Sync conflict resolution
 */

import { WhatsAppOperationalGraph, ContactSyncOperation } from './op-graph';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface WhatsAppContact {
  id: string;
  phoneNumber: string;
  name?: string;
  profilePictureUrl?: string;
  status: 'active' | 'blocked' | 'deleted';
  metadata: {
    lastSeen?: number;
    lastMessageTimestamp?: number;
    messageCount: number;
    isBusiness?: boolean;
    businessName?: string;
    labels?: string[];
    customFields?: Record<string, any>;
  };
  createdAt: number;
  updatedAt: number;
}

export interface ContactSyncResult {
  success: boolean;
  added: number;
  updated: number;
  deleted: number;
  duplicates: number;
  conflicts: number;
  duration: number;
  errors: string[];
}

export interface ContactSyncConfig {
  enableAutoSync: boolean;
  syncInterval: number; // in milliseconds
  enableDuplicateDetection: boolean;
  enableConflictResolution: boolean;
  maxRetries: number;
  batchSize: number;
}

export type SyncConflictResolution = 'keep_newest' | 'keep_existing' | 'merge' | 'manual';

// ============================================================================
// CONTACT SYNC MANAGER CLASS
// ============================================================================

export class WhatsAppContactSync {
  private graph: WhatsAppOperationalGraph;
  private contacts: Map<string, WhatsAppContact> = new Map(); // phoneNumber -> contact
  private syncHistory: ContactSyncResult[] = [];
  private syncInProgress: boolean = false;
  private config: ContactSyncConfig;
  private eventListeners: Map<string, Set<Function>> = new Map();

  constructor(graph: WhatsAppOperationalGraph, config?: Partial<ContactSyncConfig>) {
    this.graph = graph;
    this.config = {
      enableAutoSync: config?.enableAutoSync ?? true,
      syncInterval: config?.syncInterval ?? 3600000, // 1 hour
      enableDuplicateDetection: config?.enableDuplicateDetection ?? true,
      enableConflictResolution: config?.enableConflictResolution ?? true,
      maxRetries: config?.maxRetries ?? 3,
      batchSize: config?.batchSize ?? 100,
    };

    // Start auto-sync if enabled
    if (this.config.enableAutoSync) {
      this.startAutoSync();
    }
  }

  // ============================================================================
  // SYNC OPERATIONS
  // ============================================================================

  async executeSync(operation: ContactSyncOperation): Promise<ContactSyncResult> {
    const startTime = Date.now();

    try {
      this.syncInProgress = true;

      let result: ContactSyncResult;

      switch (operation.type) {
        case 'full_sync':
          result = await this.fullSync(operation);
          break;
        case 'incremental_sync':
          result = await this.incrementalSync(operation);
          break;
        case 'single_contact':
          result = await this.syncSingleContact(operation);
          break;
        default:
          throw new Error(`Unknown sync operation type: ${operation.type}`);
      }

      result.duration = Date.now() - startTime;
      this.syncHistory.push(result);

      // Trim sync history
      if (this.syncHistory.length > 100) {
        this.syncHistory = this.syncHistory.slice(-100);
      }

      this.emit('sync_completed', { operation, result });
      return result;

    } catch (error) {
      console.error('Error executing contact sync:', error);
      const result: ContactSyncResult = {
        success: false,
        added: 0,
        updated: 0,
        deleted: 0,
        duplicates: 0,
        conflicts: 0,
        duration: Date.now() - startTime,
        errors: [(error as Error).message],
      };

      this.syncHistory.push(result);
      this.emit('sync_failed', { operation, error: (error as Error).message });
      return result;

    } finally {
      this.syncInProgress = false;
    }
  }

  private async fullSync(operation: ContactSyncOperation): Promise<ContactSyncResult> {
    const errors: string[] = [];
    let added = 0;
    let updated = 0;
    let deleted = 0;
    let duplicates = 0;
    let conflicts = 0;

    if (!operation.contacts) {
      throw new Error('Contacts array is required for full sync');
    }

    // Clear existing contacts for full sync (or mark for deletion)
    const existingPhoneNumbers = Array.from(this.contacts.keys());

    for (const contactData of operation.contacts) {
      try {
        const result = await this.syncContact(contactData);
        
        if (result.action === 'added') {
          added++;
        } else if (result.action === 'updated') {
          updated++;
        } else if (result.action === 'duplicate') {
          duplicates++;
        } else if (result.action === 'conflict') {
          conflicts++;
        }

      } catch (error) {
        errors.push(`Failed to sync contact ${contactData.phoneNumber}: ${(error as Error).message}`);
      }
    }

    // Delete contacts not in new sync
    for (const phoneNumber of existingPhoneNumbers) {
      const existsInNewSync = operation.contacts?.some(c => c.phoneNumber === phoneNumber);
      if (!existsInNewSync) {
        await this.deleteContact(phoneNumber);
        deleted++;
      }
    }

    return {
      success: errors.length === 0,
      added,
      updated,
      deleted,
      duplicates,
      conflicts,
      duration: 0, // Will be set by executeSync
      errors,
    };
  }

  private async incrementalSync(operation: ContactSyncOperation): Promise<ContactSyncResult> {
    const errors: string[] = [];
    let added = 0;
    let updated = 0;
    let deleted = 0;
    let duplicates = 0;
    let conflicts = 0;

    if (!operation.contacts) {
      throw new Error('Contacts array is required for incremental sync');
    }

    for (const contactData of operation.contacts) {
      try {
        const result = await this.syncContact(contactData);
        
        if (result.action === 'added') {
          added++;
        } else if (result.action === 'updated') {
          updated++;
        } else if (result.action === 'duplicate') {
          duplicates++;
        } else if (result.action === 'conflict') {
          conflicts++;
        }

      } catch (error) {
        errors.push(`Failed to sync contact ${contactData.phoneNumber}: ${(error as Error).message}`);
      }
    }

    return {
      success: errors.length === 0,
      added,
      updated,
      deleted,
      duplicates,
      conflicts,
      duration: 0,
      errors,
    };
  }

  private async syncSingleContact(operation: ContactSyncOperation): Promise<ContactSyncResult> {
    const errors: string[] = [];
    let added = 0;
    let updated = 0;
    let deleted = 0;
    let duplicates = 0;
    let conflicts = 0;

    if (!operation.phone) {
      throw new Error('Phone number is required for single contact sync');
    }

    try {
      const contactData = operation.contacts?.[0] || {
        phoneNumber: operation.phone,
      };

      const result = await this.syncContact(contactData);
      
      if (result.action === 'added') {
        added++;
      } else if (result.action === 'updated') {
        updated++;
      } else if (result.action === 'duplicate') {
        duplicates++;
      } else if (result.action === 'conflict') {
        conflicts++;
      }

    } catch (error) {
      errors.push(`Failed to sync contact ${operation.phone}: ${(error as Error).message}`);
    }

    return {
      success: errors.length === 0,
      added,
      updated,
      deleted,
      duplicates,
      conflicts,
      duration: 0,
      errors,
    };
  }

  private async syncContact(
    contactData: any
  ): Promise<{ action: 'added' | 'updated' | 'duplicate' | 'conflict'; contact: WhatsAppContact | null }> {
    const phoneNumber = this.normalizePhoneNumber(contactData.phoneNumber);

    // Check if contact exists
    const existingContact = this.contacts.get(phoneNumber);

    if (!existingContact) {
      // Add new contact
      const newContact: WhatsAppContact = {
        id: this.generateContactId(),
        phoneNumber,
        name: contactData.name,
        profilePictureUrl: contactData.profilePictureUrl,
        status: 'active',
        metadata: {
          lastSeen: contactData.lastSeen,
          messageCount: 0,
          isBusiness: contactData.isBusiness,
          businessName: contactData.businessName,
          labels: contactData.labels || [],
          customFields: contactData.customFields || {},
        },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.contacts.set(phoneNumber, newContact);
      this.emit('contact_added', { contact: newContact });
      
      return { action: 'added', contact: newContact };
    }

    // Handle existing contact
    if (this.config.enableDuplicateDetection) {
      // Check if this is a duplicate
      if (this.isDuplicate(existingContact, contactData)) {
        return { action: 'duplicate', contact: existingContact };
      }

      // Check for conflict
      if (this.config.enableConflictResolution && this.hasConflict(existingContact, contactData)) {
        const resolution = await this.resolveConflict(existingContact, contactData);
        if (resolution.action === 'merge') {
          const mergedContact = this.mergeContacts(existingContact, contactData);
          this.contacts.set(phoneNumber, mergedContact);
          this.emit('contact_merged', { contact: mergedContact });
          return { action: 'updated', contact: mergedContact };
        }
        
        if (resolution.action === 'keep_existing') {
          return { action: 'conflict', contact: existingContact };
        }
      }
    }

    // Update existing contact
    const updatedContact: WhatsAppContact = {
      ...existingContact,
      name: contactData.name || existingContact.name,
      profilePictureUrl: contactData.profilePictureUrl || existingContact.profilePictureUrl,
      status: contactData.status || existingContact.status,
      metadata: {
        ...existingContact.metadata,
        lastSeen: contactData.lastSeen || existingContact.metadata.lastSeen,
        isBusiness: contactData.isBusiness ?? existingContact.metadata.isBusiness,
        businessName: contactData.businessName || existingContact.metadata.businessName,
        labels: contactData.labels || existingContact.metadata.labels,
        customFields: { ...existingContact.metadata.customFields, ...contactData.customFields },
      },
      updatedAt: Date.now(),
    };

    this.contacts.set(phoneNumber, updatedContact);
    this.emit('contact_updated', { contact: updatedContact, previous: existingContact });
    
    return { action: 'updated', contact: updatedContact };
  }

  // ============================================================================
  // DUPLICATE DETECTION
  // ============================================================================

  private isDuplicate(contact: WhatsAppContact, data: any): boolean {
    // Check phone number (normalized)
    if (this.normalizePhoneNumber(contact.phoneNumber) === this.normalizePhoneNumber(data.phoneNumber)) {
      return true;
    }

    // Check name similarity
    if (contact.name && data.name && contact.name === data.name) {
      return true;
    }

    return false;
  }

  // ============================================================================
  // CONFLICT RESOLUTION
  // ============================================================================

  private hasConflict(contact: WhatsAppContact, data: any): boolean {
    // Check if data has conflicting values
    const hasNameConflict = data.name && contact.name && data.name !== contact.name;
    const hasStatusConflict = data.status && contact.status && data.status !== contact.status;

    return hasNameConflict || hasStatusConflict;
  }

  private async resolveConflict(
    contact: WhatsAppContact,
    data: any
  ): Promise<{ action: 'keep_existing' | 'keep_newest' | 'merge'; resolution: SyncConflictResolution }> {
    // Default resolution strategy
    const resolution: SyncConflictResolution = 'keep_newest';

    if (resolution === 'keep_newest') {
      // Compare timestamps
      const dataTimestamp = data.updatedAt || Date.now();
      return dataTimestamp > contact.updatedAt
        ? { action: 'keep_newest', resolution }
        : { action: 'keep_existing', resolution };
    }

    if (resolution === 'merge') {
      return { action: 'merge', resolution };
    }

    return { action: 'keep_existing', resolution };
  }

  private mergeContacts(contact: WhatsAppContact, data: any): WhatsAppContact {
    return {
      ...contact,
      name: data.name || contact.name,
      profilePictureUrl: data.profilePictureUrl || contact.profilePictureUrl,
      metadata: {
        ...contact.metadata,
        lastSeen: Math.max(contact.metadata.lastSeen || 0, data.lastSeen || 0),
        isBusiness: data.isBusiness ?? contact.metadata.isBusiness,
        businessName: data.businessName || contact.metadata.businessName,
        labels: [...new Set([...(contact.metadata.labels || []), ...(data.labels || [])])],
        customFields: { ...contact.metadata.customFields, ...data.customFields },
      },
      updatedAt: Date.now(),
    };
  }

  // ============================================================================
  // CONTACT MANAGEMENT
  // ============================================================================

  getContact(phoneNumber: string): WhatsAppContact | undefined {
    return this.contacts.get(this.normalizePhoneNumber(phoneNumber));
  }

  getAllContacts(): WhatsAppContact[] {
    return Array.from(this.contacts.values());
  }

  getContactsByStatus(status: 'active' | 'blocked' | 'deleted'): WhatsAppContact[] {
    return Array.from(this.contacts.values()).filter(c => c.status === status);
  }

  async deleteContact(phoneNumber: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);
    const contact = this.contacts.get(normalizedPhone);

    if (!contact) {
      return false;
    }

    this.contacts.delete(normalizedPhone);
    this.emit('contact_deleted', { phoneNumber: normalizedPhone, contact });
    return true;
  }

  async blockContact(phoneNumber: string): Promise<boolean> {
    const contact = this.getContact(phoneNumber);
    if (!contact) {
      return false;
    }

    contact.status = 'blocked';
    contact.updatedAt = Date.now();
    this.contacts.set(this.normalizePhoneNumber(phoneNumber), contact);
    this.emit('contact_blocked', { contact });
    return true;
  }

  async unblockContact(phoneNumber: string): Promise<boolean> {
    const contact = this.getContact(phoneNumber);
    if (!contact) {
      return false;
    }

    contact.status = 'active';
    contact.updatedAt = Date.now();
    this.contacts.set(this.normalizePhoneNumber(phoneNumber), contact);
    this.emit('contact_unblocked', { contact });
    return true;
  }

  // ============================================================================
  // AUTO SYNC
  // ============================================================================

  private startAutoSync(): void {
    setInterval(async () => {
      if (!this.syncInProgress) {
        try {
          await this.executeSync({
            type: 'incremental_sync',
            lastSyncTimestamp: this.getLastSyncTimestamp(),
          });
        } catch (error) {
          console.error('Auto-sync error:', error);
        }
      }
    }, this.config.syncInterval);
  }

  private getLastSyncTimestamp(): number | undefined {
    if (this.syncHistory.length === 0) {
      return undefined;
    }
    const lastSync = this.syncHistory[this.syncHistory.length - 1];
    return Date.now() - lastSync.duration;
  }

  stopAutoSync(): void {
    // Note: In a real implementation, you'd need to track the interval ID
    this.config.enableAutoSync = false;
    this.emit('auto_sync_stopped', {});
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let normalized = phoneNumber.replace(/\D/g, '');

    // Add country code if missing (default to +1 for US)
    if (normalized.length === 10) {
      normalized = '1' + normalized;
    }

    return normalized;
  }

  private generateContactId(): string {
    return `contact_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getSyncHistory(): ContactSyncResult[] {
    return [...this.syncHistory];
  }

  getStats(): {
    totalContacts: number;
    activeContacts: number;
    blockedContacts: number;
    deletedContacts: number;
    lastSyncTime: number | null;
    syncInProgress: boolean;
  } {
    const contacts = Array.from(this.contacts.values());

    return {
      totalContacts: contacts.length,
      activeContacts: contacts.filter(c => c.status === 'active').length,
      blockedContacts: contacts.filter(c => c.status === 'blocked').length,
      deletedContacts: contacts.filter(c => c.status === 'deleted').length,
      lastSyncTime: this.syncHistory.length > 0
        ? Date.now() - this.syncHistory[this.syncHistory.length - 1].duration
        : null,
      syncInProgress: this.syncInProgress,
    };
  }

  updateConfig(config: Partial<ContactSyncConfig>): void {
    this.config = { ...this.config, ...config };
    this.emit('config_updated', this.config);
  }

  getConfig(): ContactSyncConfig {
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
          console.error(`Error in contact sync event listener for ${event}:`, error);
        }
      });
    }
  }

  // ============================================================================
  // CLEANUP
  // ============================================================================

  async clearDeletedContacts(): Promise<number> {
    const deletedContacts: string[] = [];

    for (const [phoneNumber, contact] of this.contacts.entries()) {
      if (contact.status === 'deleted') {
        deletedContacts.push(phoneNumber);
      }
    }

    for (const phoneNumber of deletedContacts) {
      this.contacts.delete(phoneNumber);
    }

    this.emit('deleted_contacts_cleared', { count: deletedContacts.length });
    return deletedContacts.length;
  }

  reset(): void {
    this.contacts.clear();
    this.syncHistory = [];
    this.syncInProgress = false;
    this.emit('sync_reset', {});
  }
}
