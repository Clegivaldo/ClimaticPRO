import * as admin from 'firebase-admin';
import { prisma } from '../utils/prisma';
import { Platform } from '@prisma/client';

/**
 * Service for managing Firebase Cloud Messaging (FCM) notifications
 * Requirement 7.7: Push notifications via FCM
 */

let fcmInitialized = false;

/**
 * Initialize Firebase Admin SDK
 * Requires GOOGLE_APPLICATION_CREDENTIALS environment variable
 */
export function initFCM() {
  try {
    if (process.env['GOOGLE_APPLICATION_CREDENTIALS'] || process.env['FIREBASE_CONFIG']) {
      admin.initializeApp();
      fcmInitialized = true;
      console.log('FCM initialized successfully');
    } else {
      console.warn('FCM not initialized: Missing credentials. Notifications will be mocked.');
    }
  } catch (error) {
    console.error('Error initializing FCM:', error);
  }
}

/**
 * Register or update an FCM token for a user
 */
export async function registerFCMToken(userId: string, token: string, platform: Platform) {
  return prisma.fCMToken.upsert({
    where: { token },
    create: {
      userId,
      token,
      platform
    },
    update: {
      userId,
      platform,
      updatedAt: new Date()
    }
  });
}

/**
 * Remove an FCM token (e.g., on logout)
 */
export async function removeFCMToken(token: string) {
  return prisma.fCMToken.deleteMany({
    where: { token }
  });
}

/**
 * Send a notification to all devices of a user
 */
export async function sendUserNotification(
  userId: string, 
  title: string, 
  body: string, 
  data?: Record<string, string>
) {
  const tokens = await prisma.fCMToken.findMany({
    where: { userId },
    select: { token: true }
  });

  if (tokens.length === 0) {
    console.log(`No FCM tokens found for user ${userId}. Skipping notification.`);
    return;
  }

  const tokenList = tokens.map(t => t.token);

  if (!fcmInitialized) {
    console.log(`[MOCK NOTIFICATION] To User ${userId}: ${title} - ${body}`, data);
    return;
  }

  try {
    const message: admin.messaging.MulticastMessage = {
      tokens: tokenList,
      notification: {
        title,
        body
      },
      data: data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'alerts'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    // Clean up invalid tokens
    if (response.failureCount > 0) {
      const invalidTokens: string[] = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const error = resp.error;
          if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(tokenList[idx]);
          }
        }
      });

      if (invalidTokens.length > 0) {
        await prisma.fCMToken.deleteMany({
          where: { token: { in: invalidTokens } }
        });
      }
    }

    return response;
  } catch (error) {
    console.error('Error sending FCM notification:', error);
  }
}
