import { factories } from "@strapi/strapi";

export default factories.createCoreController(
  "api::shop.shop",
  ({ strapi }) => ({
    async addCheckIn(ctx) {
      try {
        const { id } = ctx.params; // Lấy ID của shop từ route
        const { checkIn } = ctx.request.body; // Dữ liệu check-in được gửi lên

        if (!checkIn) {
          return ctx.badRequest("Missing checkIn data");
        }

        // Lấy thông tin shop hiện tại
        const shop = await strapi.entityService.findOne("api::shop.shop", id, {
          populate: { checkIn: true },
        });

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Thêm dữ liệu mới vào mảng checkIn
        const updatedCheckIn = shop.checkIn
          ? [...shop.checkIn, checkIn]
          : [checkIn];

        // Cập nhật lại shop
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          id,
          {
            data: { checkIn: updatedCheckIn },
          }
        );

        return ctx.send(updatedShop); // Trả về kết quả
      } catch (err) {
        strapi.log.error(err);
        return ctx.internalServerError("Something went wrong");
      }
    },
    async validateQr(ctx) {
      try {
        const { shop_id, qr_data } = ctx.request.body;

        // Parse dữ liệu quét từ QR
        const parsedData = JSON.parse(qr_data);

        // Kiểm tra xem shop_id có khớp với id từ QR không
        if (shop_id === parsedData.id) {
          return ctx.send({ status: 200, message: "OK", valid: true });
        }

        // Không khớp
        return ctx.send({
          status: 400,
          message: "Invalid QR Code",
          valid: false,
        });
      } catch (error) {
        console.error(error);
        return ctx.send({ status: 500, message: "Internal Server Error" });
      }
    },
  })
);
