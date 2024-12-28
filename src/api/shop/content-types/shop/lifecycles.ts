const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

module.exports = {
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
