import { Expo, ExpoPushMessage, ExpoPushTicket } from "expo-server-sdk";

const expo = new Expo();

interface User {
  id: string;
  tokenExpo?: string;
}

interface NotificationData {
  shopId?: number;
  userId?: string;
  distance?: number;
  [key: string]: any; // Allow additional dynamic fields
}

interface SendNotificationResult {
  success: boolean;
  error?: string;
  tickets?: ExpoPushTicket[];
}

const customNotificationService = {
  async sendNotification(
    userIds: string[],
    title: string,
    message: string,
    data: NotificationData = {}
  ): Promise<SendNotificationResult> {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        strapi.log.warn("Danh sách userIds trống hoặc không hợp lệ.");
        return { success: false, error: "Danh sách userIds không hợp lệ." };
      }

      // Fetch users from the database
      const users: User[] = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters: { id: { $in: userIds } },
          fields: ["id", "tokenExpo"],
        }
      );

      if (!users || users.length === 0) {
        strapi.log.warn("Không tìm thấy người dùng hợp lệ.");
        return { success: false, error: "Không tìm thấy người dùng hợp lệ." };
      }

      // Filter valid users with valid Expo push tokens
      const validUsers = users.filter(
        (user) => user.tokenExpo && Expo.isExpoPushToken(user.tokenExpo)
      );

      if (validUsers.length === 0) {
        strapi.log.warn("Không có ExpoPushToken hợp lệ để gửi thông báo.");
        return { success: false, error: "Không có ExpoPushToken hợp lệ." };
      }

      // Prepare push notifications
      const messages: ExpoPushMessage[] = validUsers.map((user) => ({
        to: user.tokenExpo as string,
        sound: "default",
        title,
        body: message,
        data,
      }));

      // Chunk messages for Expo push notification service
      const chunks = expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          strapi.log.error("Lỗi khi gửi thông báo:", error);
        }
      }

      // Save the notification to the database
      try {
        await strapi.entityService.create("api::notification.notification", {
          data: {
            users: userIds,
            title,
            message,
            data: JSON.stringify(data),
            is_read: false,
            publishedAt: new Date(),
          },
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lưu thông báo vào cơ sở dữ liệu:", error);
      }

      return { success: true, tickets };
    } catch (error: any) {
      strapi.log.error("Lỗi trong customNotificationService:", error);
      return { success: false, error: error.message };
    }
  },
};

export default customNotificationService;
