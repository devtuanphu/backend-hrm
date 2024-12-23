const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

module.exports = {
  async beforeCreate(event) {
    const { data } = event.params;

    // Lấy email từ client để tìm owner
    const { email, name, location } = data;

    if (!email) {
      throw new Error("Email không được cung cấp.");
    }

    try {
      // 1. Tìm user trong users-permissions dựa trên email
      const user = await strapi
        .query("plugin::users-permissions.user")
        .findOne({ where: { email } });

      if (!user) {
        throw new Error("Không tìm thấy user tương ứng với email đã cung cấp.");
      }

      // 2. Gán owner là user tìm thấy
      data.owner = user.id;

      // 3. Tạo nội dung QR Code dựa trên name, location, và owner
      const qrContent = JSON.stringify({
        name: data.name,
        location: data.location,
        owner: user.username,
        id: data.id,
      });

      // 4. Tạo QR Code và lưu tạm vào file
      const qrImagePath = path.join(__dirname, "temp-qr.png"); // Đường dẫn tạm
      await QRCode.toFile(qrImagePath, qrContent);

      // 5. Upload ảnh QR Code vào Strapi Media Library
      const uploadResponse = await strapi.plugins[
        "upload"
      ].services.upload.upload({
        data: {},
        files: {
          path: qrImagePath,
          name: "shop-qrcode.png",
          type: "image/png", // MIME type
          size: fs.statSync(qrImagePath).size,
        },
      });

      // 6. Gán file đã upload vào trường qrCode
      if (uploadResponse && uploadResponse[0]) {
        data.qrCode = uploadResponse[0].id;
      }

      // Xóa file tạm sau khi upload thành công
      fs.unlinkSync(qrImagePath);

      strapi.log.info(`Shop QR Code đã được tạo và upload thành công.`);
    } catch (error) {
      strapi.log.error("Lỗi khi tạo QR Code hoặc gán owner:", error.message);
      throw new Error("Lỗi khi tạo shop. Vui lòng thử lại.");
    }
  },
};