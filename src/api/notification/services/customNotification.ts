import { Expo } from "expo-server-sdk";

const expo = new Expo();

const customNotificationService = {
  async sendNotification(
    userIds: string[],
    title: string,
    message: string,
    data = {}
  ) {
    try {
      // Lấy danh sách tokenExpo của người dùng từ cơ sở dữ liệu
      const users = await strapi.entityService.findMany(
        "plugin::users-permissions.user",
        {
          filters: { id: { $in: userIds } },
          fields: ["tokenExpo"],
        }
      );

      const pushTokens = users
        .map((user) => user.tokenExpo)
        .filter((token) => Expo.isExpoPushToken(token));

      if (pushTokens.length === 0) {
        strapi.log.warn("Không có ExpoPushToken hợp lệ để gửi thông báo.");
        return;
      }

      // Tạo danh sách thông báo
      const messages = pushTokens.map((token) => ({
        to: token,
        sound: "default",
        title: title,
        body: message,
        data,
        ttl: 86400,
      }));

      // Gửi thông báo qua Expo
      const chunks = expo.chunkPushNotifications(messages);
      const tickets = [];
      for (const chunk of chunks) {
        try {
          const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          strapi.log.error("Lỗi khi gửi thông báo:", error);
        }
      }

      // Lưu thông báo vào cơ sở dữ liệu
      for (const userId of userIds) {
        await strapi.entityService.create("api::notification.notification", {
          data: {
            user: userId,
            title,
            message,
            data,
          },
        });
      }

      return { success: true, tickets };
    } catch (error) {
      strapi.log.error("Lỗi trong customNotificationService:", error);
      return { success: false, error: error.message };
    }
  },
};

export default customNotificationService;
