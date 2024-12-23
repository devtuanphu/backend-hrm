const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

module.exports = {
  // async beforeCreate(event) {
  //   const { data } = event.params;

  //   // Lấy email từ client để tìm owner
  //   const { email, name, location } = data;

  //   if (!email) {
  //     throw new Error("Email không được cung cấp.");
  //   }

  //   try {
  //     // 1. Tìm user trong users-permissions dựa trên email
  //     const user = await strapi
  //       .query("plugin::users-permissions.user")
  //       .findOne({ where: { email } });

  //     if (!user) {
  //       throw new Error("Không tìm thấy user tương ứng với email đã cung cấp.");
  //     }

  //     // 2. Gán owner là user tìm thấy
  //     data.owner = user.id;

  //     // 3. Tạo nội dung QR Code dựa trên name, location, và owner
  //     const qrContent = JSON.stringify({
  //       name: data.name,
  //       location: data.location,
  //       owner: user.username,
  //     });

  //     // 4. Tạo QR Code và lưu tạm vào file
  //     const qrImagePath = path.join(__dirname, "temp-qr.png"); // Đường dẫn tạm
  //     await QRCode.toFile(qrImagePath, qrContent);

  //     // 5. Upload ảnh QR Code vào Strapi Media Library
  //     const uploadResponse = await strapi.plugins[
  //       "upload"
  //     ].services.upload.upload({
  //       data: {},
  //       files: {
  //         path: qrImagePath,
  //         name: "shop-qrcode.png",
  //         type: "image/png", // MIME type
  //         size: fs.statSync(qrImagePath).size,
  //       },
  //     });

  //     // 6. Gán file đã upload vào trường qrCode
  //     if (uploadResponse && uploadResponse[0]) {
  //       data.qrCode = uploadResponse[0].id;
  //     }

  //     // Xóa file tạm sau khi upload thành công
  //     fs.unlinkSync(qrImagePath);

  //     strapi.log.info(`Shop QR Code đã được tạo và upload thành công.`);
  //   } catch (error) {
  //     strapi.log.error("Lỗi khi tạo QR Code hoặc gán owner:", error.message);
  //     throw new Error("Lỗi khi tạo shop. Vui lòng thử lại.");
  //   }
  // },
  async afterCreate(event) {
    const { result, params } = event;

    // Kiểm tra dữ liệu của shop
    if (!result || !result.id) {
      throw new Error("Không thể tạo QR Code vì shop chưa được lưu.");
    }

    try {
      const { name, location, owner } = result;

      // Tạo nội dung QR Code (bao gồm `id`)
      const qrContent = JSON.stringify({
        id: result.id,
        name: name || "No name",
        location: location || "No location",
        owner: owner || "Unknown owner",
      });

      // Tạo file QR Code
      const qrImagePath = path.join(__dirname, "temp-qr.png");
      await QRCode.toFile(qrImagePath, qrContent);

      // Upload file lên Strapi Media Library
      const uploadResponse = await strapi.plugins.upload.services.upload.upload(
        {
          data: {},
          files: {
            path: qrImagePath,
            name: `shop-${result.id}-qrcode.png`,
            type: "image/png",
            size: fs.statSync(qrImagePath).size,
          },
        }
      );

      if (uploadResponse && uploadResponse[0]) {
        // Gán QR Code vào bản ghi
        await strapi.entityService.update("api::shop.shop", result.id, {
          data: { qrCode: uploadResponse[0].id },
        });
      }

      // Xóa file tạm
      fs.unlinkSync(qrImagePath);
      strapi.log.info(
        `QR Code đã được tạo và upload thành công cho shop ID: ${result.id}`
      );
    } catch (error) {
      strapi.log.error("Lỗi khi tạo QR Code:", error.message);
      throw new Error("Lỗi khi tạo shop. Vui lòng thử lại.");
    }
  },
};
