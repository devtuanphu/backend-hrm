import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::notification.notification",
  ({ strapi }) => ({
    async getUserNotifications(ctx) {
      try {
        const { userId } = ctx.params;

        if (!userId) {
          return ctx.badRequest("Thiếu userId.");
        }

        // Fetch notifications with the specified userId
        const notifications = await strapi.entityService.findMany(
          "api::notification.notification",
          {
            filters: { users: { id: userId } },
            sort: { createdAt: "desc" },
            populate: ["users"],
          }
        );

        if (!notifications || notifications.length === 0) {
          return ctx.notFound("Không có thông báo nào cho người dùng này.");
        }

        return ctx.send({
          success: true,
          data: notifications,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy thông báo theo user:", error);
        return ctx.internalServerError("Đã xảy ra lỗi khi lấy thông báo.");
      }
    },
  })
);
