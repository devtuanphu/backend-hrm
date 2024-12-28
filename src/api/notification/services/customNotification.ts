import { Expo } from "expo-server-sdk";

const expo = new Expo();

interface User {
  id: string;
  tokenExpo?: string; // tokenExpo có thể không tồn tại
}

const customNotificationService = {
  async sendNotification(
    userIds: string[],
    title: string,
    message: string,
    data: Record<string, any> = {}
  ): Promise<{ success: boolean; error?: string; tickets?: any[] }> {
    try {
      if (!Array.isArray(userIds) || userIds.length === 0) {
        strapi.log.warn("Danh sách userIds trống hoặc không hợp lệ.");
        return { success: false, error: "Danh sách userIds không hợp lệ." };
      }

      // Ép kiểu trả về của findMany
      const users = (await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters: { id: { $in: userIds } },
          fields: ["id", "tokenExpo"], // Lấy id và tokenExpo
        }
      )) as User[];

      if (!users || users.length === 0) {
        strapi.log.warn("Không tìm thấy người dùng hợp lệ.");
        return { success: false, error: "Không tìm thấy người dùng hợp lệ." };
      }

      const validUsers = users.filter(
        (user) => user.tokenExpo && Expo.isExpoPushToken(user.tokenExpo)
      );

      if (validUsers.length === 0) {
        strapi.log.warn("Không có ExpoPushToken hợp lệ để gửi thông báo.");
        return { success: false, error: "Không có ExpoPushToken hợp lệ." };
      }

      const messages = validUsers.map((user) => ({
        to: user.tokenExpo as string,
        sound: "default",
        title: title,
        body: message,
        data,
        ttl: 86400,
      }));

      const chunks = expo.chunkPushNotifications(messages);
      const tickets: any[] = [];
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          strapi.log.error("Lỗi khi gửi thông báo:", error);
        }
      }

      for (const user of validUsers) {
        try {
          await strapi.entityService.create("api::notification.notification", {
            data: {
              user: user.id,
              title,
              message,
              data: JSON.stringify(data),
            },
          });
        } catch (error) {
          strapi.log.error(`Lỗi khi lưu thông báo cho user ${user.id}:`, error);
        }
      }

      return { success: true, tickets };
    } catch (error) {
      strapi.log.error("Lỗi trong customNotificationService:", error);
      return { success: false, error: error.message };
    }
  },
};

export default customNotificationService;
