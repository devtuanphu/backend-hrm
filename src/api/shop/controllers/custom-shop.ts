import { factories } from "@strapi/strapi";
import dayjs from "dayjs";

const haversineDistance = (lat1, lon1, lat2, lon2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371e3; // Bán kính Trái Đất tính bằng mét

  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const Δφ = toRad(lat2 - lat1);
  const Δλ = toRad(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Khoảng cách tính bằng mét
};

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

        // Lấy tọa độ của shop và khoảng cách sai số (space)
        const shopLatitude = parseFloat(shop.latitude);
        const shopLongitude = parseFloat(shop.longitude);
        const space = shop.space; // Đảm bảo space là số

        // Lấy tọa độ check-in
        const checkInLatitude = parseFloat(checkIn.latitude);
        const checkInLongitude = parseFloat(checkIn.longitude);

        // Tính khoảng cách giữa hai tọa độ
        const distance = haversineDistance(
          shopLatitude,
          shopLongitude,
          checkInLatitude,
          checkInLongitude
        );

        // Cập nhật isLocation dựa trên khoảng cách
        const isLocation = distance <= space;

        // Cập nhật check-in với thông tin isLocation và distance
        const updatedCheckIn = shop.checkIn
          ? [
              ...shop.checkIn,
              { ...checkIn, isLocation, distance: distance.toFixed(2) },
            ]
          : [{ ...checkIn, isLocation, distance: distance.toFixed(2) }];

        // Cập nhật lại thông tin của shop
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
    async getCheckInsByDate(ctx) {
      try {
        const { id } = ctx.params; // ID của shop
        const { date } = ctx.query; // Ngày được truyền vào từ query

        if (!date) {
          return ctx.badRequest("Ngày không được cung cấp!");
        }

        const shop = await strapi.entityService.findOne("api::shop.shop", id, {
          populate: { checkIn: true },
        });

        if (!shop) {
          return ctx.notFound("Shop không tồn tại!");
        }

        const checkInData = shop.checkIn || [];

        // Lọc danh sách check-in theo ngày
        const filteredCheckIns = checkInData.filter((checkIn) =>
          dayjs(checkIn.time).isSame(dayjs(date), "day")
        );

        ctx.send(filteredCheckIns);
      } catch (error) {
        strapi.log.error(error);
        return ctx.internalServerError(
          "Đã xảy ra lỗi khi lấy danh sách check-in!"
        );
      }
    },
  })
);
