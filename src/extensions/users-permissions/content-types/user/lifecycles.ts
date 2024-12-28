import { sendEmail } from "../../../../services/email";
import { emailTemplate } from "../../../../template/emailTemplate";

module.exports = {
  async afterCreate(event: { result: any }) {
    console.log("Lifecycle file loaded");
    console.log("afterCreate event:", event);

    const { result } = event; // `result` là dữ liệu của user vừa được tạo
    console.log("User vừa được tạo:", result);

    if (result && result.email) {
      try {
        // Tạo mã xác thực
        const verificationCode = Math.floor(100000 + Math.random() * 900000);

        // Sử dụng email template
        const htmlContent = emailTemplate(
          result.username || result.email,
          verificationCode
        );

        // Gửi email mã xác thực
        await sendEmail({
          to: result.email,
          subject: "Xác thực tài khoản TimeSo",
          html: htmlContent, // Gửi email với nội dung HTML
        });

        // Cập nhật user với mã xác thực
        await strapi.entityService.update(
          "plugin::users-permissions.user", // Chỉ định loại model
          result.id, // ID của user
          {
            data: {
              verificationCode, // Thêm mã xác thực vào user
            },
          }
        );

        strapi.log.info(`Email mã xác thực đã được gửi tới ${result.email}`);
      } catch (error) {
        strapi.log.error("Lỗi khi gửi email hoặc lưu mã xác thực:", error);
      }
    }
  },
};
