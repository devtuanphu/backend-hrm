// src/extensions/users-permissions/strapi-server.js
const user = require("./content-types/user");
import { forgotPassWord } from "../../template/forgotPassword";
import { sendEmail } from "../../services/email";
module.exports = (plugin) => {
  plugin.routes["content-api"].routes.push(
    {
      method: "POST",
      path: "/verify-email",
      handler: "user.verifyEmail",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/forgot-password",
      handler: "user.forgotPassword",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/verify-reset-token",
      handler: "user.verifyResetToken",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/add-task",
      handler: "user.addTask",
      config: {
        policies: [], // Thêm policies nếu cần
        middlewares: [], // Thêm middleware nếu cần
      },
    },
    {
      method: "GET",
      path: "/tasks/:userId",
      handler: "user.getTasksByUserId",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/update-progress",
      handler: "user.updateProgress",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/update-token",
      handler: "user.updateExpoPushToken",
      config: {
        policies: [],
        middlewares: [],
      },
    }
  );

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
  plugin.controllers.user.forgotPassword = async (ctx) => {
    const { email } = ctx.request.body;

    if (!email) {
      return ctx.badRequest("Email là bắt buộc.");
    }

    try {
      // Tìm user bằng email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email },
        });

      if (!user) {
        return ctx.notFound("Không tìm thấy người dùng với email này.");
      }

      // Tạo mã xác thực ngẫu nhiên
      const verificationCode = Math.floor(
        100000 + Math.random() * 900000
      ).toString(); // 6 chữ số

      // Lưu mã xác thực vào trường resetPasswordToken của user
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        user.id,
        {
          data: { resetPasswordToken: verificationCode },
        }
      );

      // Sử dụng service sendEmail để gửi mã xác thực
      const htmlContent = forgotPassWord(
        user.username || user.email,
        verificationCode
      );
      await sendEmail({
        to: email,
        subject: "Mã xác thực đặt lại mật khẩu",
        html: htmlContent,
      });

      // Trả về cả thông báo và ID của user
      return ctx.send({
        message: "Mã xác thực đã được gửi đến email của bạn.",
        userId: user.id, // Trả về ID của người dùng
      });
    } catch (error) {
      strapi.log.error("Lỗi gửi mã xác thực:", error);
      return ctx.internalServerError("Đã xảy ra lỗi khi thực hiện yêu cầu.");
    }
  };

  plugin.controllers.user.verifyResetToken = async (ctx) => {
    const { email, token } = ctx.request.body;

    if (!email || !token) {
      return ctx.badRequest("Email và mã xác thực là bắt buộc.");
    }

    try {
      // Tìm user bằng email và mã xác thực
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { email, resetPasswordToken: token },
        });

      if (!user) {
        return ctx.notFound("Mã xác thực không hợp lệ hoặc đã hết hạn.");
      }

      // Mã xác thực hợp lệ
      return ctx.send({ message: "Mã xác thực hợp lệ." });
    } catch (error) {
      strapi.log.error("Lỗi xác minh mã:", error);
      return ctx.internalServerError("Đã xảy ra lỗi khi xác minh mã.");
    }
  };
  plugin.controllers.user.addTask = async (ctx) => {
    const { userId, task } = ctx.request.body; // Lấy userId và thông tin task từ body request

    if (!userId || !task) {
      return ctx.badRequest("User ID và thông tin nhiệm vụ là bắt buộc.");
    }

    try {
      // Lấy thông tin user hiện tại
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        userId,
        { populate: ["Task"] } // Populate mảng Task
      );

      if (!user) {
        return ctx.notFound("Không tìm thấy người dùng.");
      }

      // Thêm task mới vào mảng Task hiện tại
      const updatedTasks = [...(user.Task || []), task];

      // Cập nhật lại user với mảng Task mới
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        userId,
        {
          data: { Task: updatedTasks },
        }
      );

      return ctx.send({
        message: "Thêm nhiệm vụ thành công.",
        Task: updatedTasks, // Trả về danh sách Task sau khi cập nhật
      });
    } catch (error) {
      strapi.log.error("Lỗi khi thêm nhiệm vụ:", error);
      return ctx.internalServerError("Đã xảy ra lỗi khi thêm nhiệm vụ.");
    }
  };
  plugin.controllers.user.getTasksByUserId = async (ctx) => {
    const { userId } = ctx.params;

    if (!userId) {
      return ctx.badRequest("User ID is required.");
    }

    try {
      // Fetch the user by ID, including the tasks field
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: userId },
          populate: ["Task"],
        });

      if (!user) {
        return ctx.notFound("User not found.");
      }

      return ctx.send({
        success: true,
        tasks: user.Task || [], // Return the tasks array or an empty array if none
      });
    } catch (error) {
      strapi.log.error("Error fetching tasks by user ID:", error);
      return ctx.internalServerError("An error occurred while fetching tasks.");
    }
  };
  plugin.controllers.user.updateProgress = async (ctx) => {
    const { userId, taskId, progress } = ctx.request.body;

    if (!userId || !taskId || progress === undefined) {
      return ctx.badRequest("User ID, Task ID, và progress là bắt buộc.");
    }

    if (progress < 0 || progress > 100) {
      return ctx.badRequest(
        "Giá trị progress phải nằm trong khoảng từ 0 đến 100."
      );
    }

    try {
      // Lấy user và populate Task
      const user = await strapi.entityService.findOne(
        "plugin::users-permissions.user",
        userId,
        { populate: ["Task"] }
      );

      if (!user) {
        return ctx.notFound("Không tìm thấy người dùng.");
      }

      // Tìm task cần cập nhật
      const taskIndex = user.Task.findIndex((task) => task.id === taskId);
      if (taskIndex === -1) {
        return ctx.notFound("Không tìm thấy nhiệm vụ.");
      }

      // Cập nhật progress cho task
      user.Task[taskIndex].progess = progress;

      // Lưu lại mảng Task đã cập nhật
      await strapi.entityService.update(
        "plugin::users-permissions.user",
        userId,
        {
          data: { Task: user.Task },
        }
      );

      return ctx.send({
        success: true,
        message: "Cập nhật progress thành công.",
        task: user.Task[taskIndex],
      });
    } catch (error) {
      strapi.log.error("Lỗi khi cập nhật progress:", error);
      return ctx.internalServerError("Đã xảy ra lỗi khi cập nhật progress.");
    }
  };

  plugin.controllers.user.updateExpoPushToken = async (ctx) => {
    const { userId, tokenExpo } = ctx.request.body;

    if (!userId || !tokenExpo) {
      return ctx.badRequest("userId và ExpoPushToken là bắt buộc!");
    }

    try {
      // Kiểm tra xem user có tồn tại không
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({
          where: { id: userId },
        });

      if (!user) {
        return ctx.notFound("Người dùng không tồn tại!");
      }

      // Cập nhật ExpoPushToken cho người dùng
      await strapi.query("plugin::users-permissions.user").update({
        where: { id: userId },
        data: { tokenExpo },
      });

      return ctx.send({
        message: "ExpoPushToken đã được cập nhật thành công!",
      });
    } catch (error) {
      console.error("Lỗi khi cập nhật ExpoPushToken:", error);
      return ctx.internalServerError("Không thể cập nhật ExpoPushToken!");
    }
  };
  return plugin;
};
