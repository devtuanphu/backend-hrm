// src/extensions/users-permissions/strapi-server.js
const user = require("./content-types/user");

module.exports = (plugin) => {
  plugin.contentTypes.user = user;
  plugin.routes["content-api"].routes.push({
    method: "POST",
    path: "/verify-email",
    handler: "user.verifyEmail",
    config: {
      policies: [],
      middlewares: [],
    },
  });

  plugin.controllers.user.verifyEmail = async (ctx) => {
    const { email, verificationCode } = ctx.request.body;

    if (!email || !verificationCode) {
      return ctx.badRequest("Email và mã xác thực là bắt buộc.");
    }

    try {
      // Tìm user bằng email và mã xác thực
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email, verificationCode },
        });

      if (!user) {
        return ctx.notFound(
          "Không tìm thấy người dùng hoặc mã xác thực không hợp lệ."
        );
      }

      // Cập nhật trạng thái user
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        user.id,
        {
          data: { confirmed: true, blocked: false },
        }
      );

      return ctx.send({ message: "Xác thực thành công." });
    } catch (error) {
      strapi.log.error("Lỗi xác thực email:", error);
      return ctx.internalServerError("Đã xảy ra lỗi khi xác thực.");
    }
  };
  //...

  return plugin;
};
