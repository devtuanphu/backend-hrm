import { factories } from "@strapi/strapi";
import dayjs from "dayjs";
import customNotificationService from "../../notification/services/customNotification";
import Expo from "expo-server-sdk";

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
        const { id } = ctx.params; // ID của shop
        const { checkIn } = ctx.request.body; // Dữ liệu check-in từ body

        if (!checkIn) {
          return ctx.badRequest("Missing checkIn data");
        }

        // Lấy thông tin shop
        const shop = await strapi.entityService.findOne("api::shop.shop", id, {
          populate: { checkIn: true, owner: true },
        });

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        const shopLatitude = parseFloat(shop.latitude);
        const shopLongitude = parseFloat(shop.longitude);
        const space = shop.space || 100; // Khoảng cách cho phép, mặc định 100m

        const checkInLatitude = parseFloat(checkIn.latitude);
        const checkInLongitude = parseFloat(checkIn.longitude);

        // Tính khoảng cách
        const distance = haversineDistance(
          shopLatitude,
          shopLongitude,
          checkInLatitude,
          checkInLongitude
        );

        const isLocation = distance <= space;

        // Cập nhật dữ liệu check-in
        const updatedCheckIn = shop.checkIn
          ? [
              ...shop.checkIn,
              { ...checkIn, isLocation, distance: distance.toFixed(2) },
            ]
          : [{ ...checkIn, isLocation, distance: distance.toFixed(2) }];

        await strapi.entityService.update("api::shop.shop", id, {
          data: { checkIn: updatedCheckIn },
        });

        const userId = checkIn.userId;
        const ownerId = shop.owner?.id; // Chủ shop

        // Thông báo cho từng trường hợp
        if (isLocation) {
          // Gửi thông báo thành công cho người check-in
          await customNotificationService.sendNotification(
            [userId],
            "Check-in thành công",
            `Bạn đã check-in thành công tại cửa hàng ${shop.name}.`,
            { shopId: Number(shop.id), distance }
          );
        } else {
          // Gửi thông báo lỗi cho người check-in
          await customNotificationService.sendNotification(
            [userId],
            "Check-in không thành công",
            `Bạn đã check-in sai vị trí. Vui lòng đến khu vực cửa hàng ${shop.name} để thực hiện check-in.`,
            { shopId: Number(shop.id), distance }
          );

          // Gửi cảnh báo cho chủ cửa hàng
          if (ownerId) {
            const user = await strapi.entityService.findOne(
              "plugin::users-permissions.user",
              userId
            );
            const userName = user?.name || "Nhân viên không xác định";

            await customNotificationService.sendNotification(
              [ownerId.toString()],
              "Cảnh báo check-in sai vị trí",
              `${userName} đã check-in sai vị trí tại cửa hàng ${shop.name}.`,
              { shopId: Number(shop.id), userId, distance }
            );
          }
        }

        return ctx.send({ success: true });
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
