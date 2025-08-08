import crypto from 'crypto';
import { prisma } from './prisma';

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  hashedKey: string;
  prefix: string;
  userId: string;
  active: boolean;
  createdAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  rateLimit: number;
  dailyLimit: number;
  monthlyLimit: number;
}

export class ApiKeyManager {
  private static readonly KEY_PREFIX = 'mrpc';
  private static readonly KEY_LENGTH = 32;

  /**
   * Generate a new API key
   */
  static generateKey(): { key: string; hashedKey: string; prefix: string } {
    const randomBytes = crypto.randomBytes(this.KEY_LENGTH);
    const key = `${this.KEY_PREFIX}_${randomBytes.toString('hex')}`;
    const hashedKey = this.hashKey(key);
    const prefix = key.substring(0, 12) + '...';
    
    return { key, hashedKey, prefix };
  }

  /**
   * Hash an API key for storage
   */
  static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  /**
   * Validate an API key format
   */
  static isValidFormat(key: string): boolean {
    const pattern = new RegExp(`^${this.KEY_PREFIX}_[a-f0-9]{${this.KEY_LENGTH * 2}}$`);
    return pattern.test(key);
  }

  /**
   * Create a new API key for a user
   */
  static async create(
    userId: string,
    name: string,
    options?: {
      expiresIn?: number; // days
      rateLimit?: number; // requests per second
      dailyLimit?: number; // requests per day
      monthlyLimit?: number; // requests per month
    }
  ) {
    const { key, hashedKey, prefix } = this.generateKey();
    const expiresAt = options?.expiresIn
      ? new Date(Date.now() + options.expiresIn * 24 * 60 * 60 * 1000)
      : null;

    try {
      const apiKey = await prisma.apiKey.create({
        data: {
          name,
          key: hashedKey, // Store the hashed key
          userId,
          active: true,
          expiresAt,
          rateLimit: options?.rateLimit || 10,
          monthlyLimit: BigInt(options?.monthlyLimit || 100000),
        },
      });

      // Return the full key only on creation
      return { 
        ...apiKey, 
        key, // Return the actual key, not the hash
        prefix,
        dailyLimit: options?.dailyLimit || 10000,
      };
    } catch (error) {
      console.error('Error creating API key:', error);
      throw new Error('Failed to create API key');
    }
  }

  /**
   * Verify an API key and return the associated user
   */
  static async verify(key: string) {
    if (!this.isValidFormat(key)) {
      return null;
    }

    const hashedKey = this.hashKey(key);

    try {
      const apiKey = await prisma.apiKey.findUnique({
        where: { key: hashedKey },
        include: { user: true },
      });

      if (!apiKey || !apiKey.active) {
        return null;
      }

      // Check if key is expired
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        await prisma.apiKey.update({
          where: { id: apiKey.id },
          data: { active: false },
        });
        return null;
      }

      // Update last used timestamp
      await prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      });

      return {
        userId: apiKey.userId,
        keyId: apiKey.id,
        user: apiKey.user,
        rateLimit: apiKey.rateLimit,
        dailyLimit: 10000, // Default daily limit (not stored in DB)
        monthlyLimit: Number(apiKey.monthlyLimit) || 100000,
      };
    } catch (error) {
      console.error('Error verifying API key:', error);
      return null;
    }
  }

  /**
   * List all API keys for a user
   */
  static async list(userId: string) {
    try {
      const keys = await prisma.apiKey.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          key: true, // We'll generate prefix from this
          active: true,
          createdAt: true,
          lastUsedAt: true,
          expiresAt: true,
          rateLimit: true,
          monthlyLimit: true,
        },
      });

      // Add prefix and dailyLimit fields
      return keys.map(key => ({
        ...key,
        prefix: 'mrpc_' + key.key.substring(5, 12) + '...',
        key: undefined, // Don't expose the hashed key
        dailyLimit: 10000, // Default daily limit
        monthlyLimit: Number(key.monthlyLimit),
      }));
    } catch (error) {
      console.error('Error listing API keys:', error);
      return [];
    }
  }

  /**
   * Revoke an API key
   */
  static async revoke(userId: string, keyId: string) {
    try {
      const apiKey = await prisma.apiKey.updateMany({
        where: {
          id: keyId,
          userId,
        },
        data: {
          active: false,
        },
      });

      return apiKey.count > 0;
    } catch (error) {
      console.error('Error revoking API key:', error);
      return false;
    }
  }

  /**
   * Update API key settings
   */
  static async update(
    userId: string,
    keyId: string,
    data: {
      name?: string;
      rateLimit?: number;
      dailyLimit?: number;
      monthlyLimit?: number;
    }
  ) {
    try {
      const apiKey = await prisma.apiKey.updateMany({
        where: {
          id: keyId,
          userId,
        },
        data,
      });

      return apiKey.count > 0;
    } catch (error) {
      console.error('Error updating API key:', error);
      return false;
    }
  }
}