import { factories } from "@strapi/strapi";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
import customNotificationService from "../../notification/services/customNotification";
import Expo from "expo-server-sdk";
import { GetValues } from "@strapi/types/dist/types/core/attributes";

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
const updateEmployeeStatus = async (
  strapi: any,
  shiftId: number,
  userId: number,
  status: "Approved" | "Rejected"
) => {
  await strapi.entityService.update("api::shift.shift", shiftId, {
    data: {
      employeeStatuses: [
        {
          user: userId,
          status,
          registeredAt: new Date(),
        },
      ],
    },
  });
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

        const shop = await strapi.entityService.findOne("api::shop.shop", id, {
          populate: { checkIn: true, owner: true },
        });

        if (!shop) {
          return ctx.notFound("Shop not found");
        }
        const { typeCheckIn } = shop;

        if (!typeCheckIn) {
          return ctx.badRequest("Cửa hàng chưa chọn hình thức chấm công.");
        }

        const shopLatitude = parseFloat(shop.latitude);
        const shopLongitude = parseFloat(shop.longitude);
        const space = shop.space || 100;

        const checkInLatitude = parseFloat(checkIn.latitude);
        const checkInLongitude = parseFloat(checkIn.longitude);

        const distance = haversineDistance(
          shopLatitude,
          shopLongitude,
          checkInLatitude,
          checkInLongitude
        );

        const isLocation = distance <= space;

        const today = new Date(checkIn.time);
        today.setHours(0, 0, 0, 0);

        const todayCheckIns = shop.checkIn.filter(
          (c) =>
            c.userId === checkIn.userId &&
            new Date(c.time).toDateString() === today.toDateString()
        );

        const isCheckOut = todayCheckIns.length % 2 !== 0;

        let wageToAdd = 0;

        // if (isCheckOut) {
        //   const lastCheckIn = todayCheckIns[todayCheckIns.length - 1];
        //   const checkOutTime = new Date(checkIn.time);
        //   const checkInTime = new Date(lastCheckIn.time);
        //   const workedHours =
        //     (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60 * 60);

        //   const user = await strapi.entityService.findOne(
        //     "plugin::users-permissions.user",
        //     checkIn.userId,
        //     { populate: ["wage"] }
        //   );

        //   if (!user) {
        //     return ctx.notFound("User not found");
        //   }

        //   const userRate = parseFloat(user.rate?.toString() || "0");
        //   wageToAdd = workedHours * userRate;

        //   const currentMonthStart = new Date(
        //     today.getFullYear(),
        //     today.getMonth(),
        //     2
        //   );
        //   const currentMonthEnd = new Date(
        //     today.getFullYear(),
        //     today.getMonth() + 1,
        //     1
        //   );

        //   const formattedCheckInTime = new Date(checkIn.time).getTime();

        //   let wageEntry = user.wage.find((w) => {
        //     const startDay = new Date(w.startDay).getTime();
        //     const endDay = new Date(w.endDay).getTime();
        //     return (
        //       formattedCheckInTime >= startDay && formattedCheckInTime <= endDay
        //     );
        //   });

        //   if (!wageEntry) {
        //     // Tạo bản ghi wage mới nếu chưa tồn tại trong tháng này
        //     wageEntry = {
        //       id: user.wage.length + 1, // Assuming id is a sequential number
        //       wage: wageToAdd,
        //       startDay: currentMonthStart.toISOString(),
        //       endDay: currentMonthEnd.toISOString(),
        //     };
        //     user.wage.push(wageEntry);
        //   } else {
        //     // Nếu đã có, cộng dồn wage
        //     wageEntry.wage += wageToAdd;
        //   }

        //   await strapi.entityService.update(
        //     "plugin::users-permissions.user",
        //     user.id,
        //     {
        //       data: {
        //         wage: user.wage.map((w) => ({
        //           wage: w.wage,
        //           startDay: w.startDay,
        //           endDay: w.endDay,
        //         })),
        //       },
        //     }
        //   );

        //   console.log(`Lương thêm: ${wageToAdd} cho userId: ${checkIn.userId}`);
        // }
        // **Trường hợp typeCheckIn là "hours"**
        if (typeCheckIn === "hours") {
          const isCheckOut = todayCheckIns.length % 2 !== 0;

          if (isCheckOut) {
            const lastCheckIn = todayCheckIns[todayCheckIns.length - 1];
            const checkOutTime = new Date(checkIn.time);
            const checkInTime = new Date(lastCheckIn.time);
            const workedHours =
              (checkOutTime.getTime() - checkInTime.getTime()) /
              (1000 * 60 * 60);

            const user = await strapi.entityService.findOne(
              "plugin::users-permissions.user",
              checkIn.userId,
              { populate: ["wage"] }
            );

            if (!user) {
              return ctx.notFound("User not found");
            }

            const userRate = parseFloat(user.rate?.toString() || "0");
            wageToAdd = workedHours * userRate;

            const currentMonthStart = new Date(
              today.getFullYear(),
              today.getMonth(),
              2
            );
            const currentMonthEnd = new Date(
              today.getFullYear(),
              today.getMonth() + 1,
              1
            );

            const formattedCheckInTime = new Date(checkIn.time).getTime();

            let wageEntry = user.wage.find((w) => {
              const startDay = new Date(w.startDay).getTime();
              const endDay = new Date(w.endDay).getTime();
              return (
                formattedCheckInTime >= startDay &&
                formattedCheckInTime <= endDay
              );
            });

            if (!wageEntry) {
              wageEntry = {
                id: user.wage.length + 1,
                wage: wageToAdd,
                startDay: currentMonthStart.toISOString(),
                endDay: currentMonthEnd.toISOString(),
              };
              user.wage.push(wageEntry);
            } else {
              wageEntry.wage += wageToAdd;
            }

            await strapi.entityService.update(
              "plugin::users-permissions.user",
              user.id,
              {
                data: {
                  wage: user.wage.map((w) => ({
                    wage: w.wage,
                    startDay: w.startDay,
                    endDay: w.endDay,
                  })),
                },
              }
            );

            console.log(
              `Lương thêm: ${wageToAdd} cho userId: ${checkIn.userId}`
            );
          }
        }

        // **Trường hợp typeCheckIn là "day" hoặc "shift"**
        else if (typeCheckIn === "day" || typeCheckIn === "shift") {
          console.log(`Chấm công theo ${typeCheckIn}`);
          const user = await strapi.entityService.findOne(
            "plugin::users-permissions.user",
            checkIn.userId,
            { populate: ["wage"] }
          );

          if (!user) {
            return ctx.notFound("User not found");
          }

          const userRate = parseFloat(user.rate?.toString() || "0");
          wageToAdd = userRate; // Thêm thẳng vào lương, xem như 1 công

          const currentMonthStart = new Date(
            today.getFullYear(),
            today.getMonth(),
            2
          );
          const currentMonthEnd = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            1
          );

          let wageEntry = user.wage.find((w) => {
            const startDay = new Date(w.startDay).getTime();
            const endDay = new Date(w.endDay).getTime();
            return today.getTime() >= startDay && today.getTime() <= endDay;
          });

          if (!wageEntry) {
            wageEntry = {
              id: user.wage.length + 1,
              wage: wageToAdd,
              startDay: currentMonthStart.toISOString(),
              endDay: currentMonthEnd.toISOString(),
            };
            user.wage.push(wageEntry);
          } else {
            wageEntry.wage += wageToAdd;
          }

          await strapi.entityService.update(
            "plugin::users-permissions.user",
            user.id,
            {
              data: {
                wage: user.wage.map((w) => ({
                  wage: w.wage,
                  startDay: w.startDay,
                  endDay: w.endDay,
                })),
              },
            }
          );

          console.log(
            `Lương cố định: ${wageToAdd} cho userId: ${checkIn.userId}`
          );
        }

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
        const ownerId = shop.owner?.id;

        if (isLocation) {
          await customNotificationService.sendNotification(
            [userId],
            "Check-in thành công",
            `Bạn đã check-in thành công tại cửa hàng ${shop.name}.`,
            { shopId: Number(shop.id), distance }
          );
        } else {
          await customNotificationService.sendNotification(
            [userId],
            "Check-in không thành công",
            `Bạn đã check-in sai vị trí.`,
            { shopId: Number(shop.id), distance }
          );

          if (ownerId) {
            const user = await strapi.entityService.findOne(
              "plugin::users-permissions.user",
              userId
            );
            const userName = user?.name || "Nhân viên không xác định";

            await customNotificationService.sendNotification(
              [ownerId.toString()],
              "Cảnh báo check-in sai vị trí",
              `${userName} đã check-in sai vị trí.`,
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
    async addShiftDaily(ctx) {
      try {
        const { shopId } = ctx.params; // ID của shop
        const { shiftDaily } = ctx.request.body; // Dữ liệu ca mẫu trong ngày
        console.log("shiftDaily", shiftDaily);

        if (
          !shiftDaily ||
          !Array.isArray(shiftDaily) ||
          shiftDaily.length === 0
        ) {
          return ctx.badRequest("Dữ liệu ca mẫu trong ngày không hợp lệ.");
        }

        // Tìm shop cần thêm shiftDaily
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: { shiftDaily: true },
          }
        );

        if (!shop) {
          return ctx.notFound("Cửa hàng không tồn tại.");
        }

        // Cập nhật danh sách ca mẫu trong ngày
        const updatedShiftDaily = shop.shiftDaily
          ? [...shop.shiftDaily, ...shiftDaily]
          : [...shiftDaily];

        // Cập nhật vào shop
        await strapi.entityService.update("api::shop.shop", shopId, {
          data: { shiftDaily: updatedShiftDaily },
        });

        return ctx.send({
          message: "Thêm ca mẫu trong ngày thành công!",
          shiftDaily: updatedShiftDaily,
        });
      } catch (error) {
        strapi.log.error("Lỗi thêm ca mẫu trong ngày:", error);
        return ctx.internalServerError(
          "Có lỗi xảy ra khi thêm ca mẫu trong ngày."
        );
      }
    },
    async getShiftDaily(ctx) {
      try {
        const { shopId } = ctx.params; // ID của shop

        // Lấy thông tin shop và populate shiftDaily
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: {
              shiftDaily: {
                populate: { skills: true }, // Populate thêm chi tiết skills
              },
            },
          }
        );

        if (!shop) {
          return ctx.notFound("Cửa hàng không tồn tại.");
        }

        return ctx.send({
          message: "Lấy danh sách ca mẫu trong ngày thành công!",
          shiftDaily: shop.shiftDaily || [],
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy danh sách ca mẫu:", error);
        return ctx.internalServerError(
          "Có lỗi xảy ra khi lấy danh sách ca mẫu."
        );
      }
    },
    async updateConfigShiftCycle(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy ID của shop từ params
        const { repeatCycle, remindDays } = ctx.request.body; // Lấy dữ liệu từ body request

        // Kiểm tra dữ liệu đầu vào
        const validRepeatCycles = ["weekly", "monthly"];
        if (
          !validRepeatCycles.includes(repeatCycle) ||
          remindDays === undefined
        ) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ và hợp lệ thông tin cấu hình chu kỳ."
          );
        }

        if (
          (repeatCycle === "weekly" && (remindDays < 0 || remindDays > 6)) ||
          (repeatCycle === "monthly" && (remindDays < 1 || remindDays > 31))
        ) {
          return ctx.badRequest("Ngày nhắc nhở không hợp lệ.");
        }

        // Cập nhật configShift của shop
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              configShift: {
                repeatCycle,
                remindDays,
              },
            },
            populate: ["configShift"], // Thêm populate để lấy đầy đủ thông tin
          }
        );

        return ctx.send({
          message: "Cập nhật thông tin chu kỳ thành công!",
          configShift: updatedShop.configShift,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi cập nhật thông tin chu kỳ:", error);
        return ctx.internalServerError(
          "Có lỗi xảy ra khi cập nhật thông tin chu kỳ."
        );
      }
    },
    async getConfigShiftCycle(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy ID của shop từ request params

        // Lấy thông tin shop và populate configShift
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: { configShift: true },
          }
        );

        if (!shop) {
          return ctx.notFound("Cửa hàng không tồn tại.");
        }

        const { configShift } = shop;

        if (!configShift) {
          return ctx.notFound("Cấu hình chu kỳ không tồn tại.");
        }

        return ctx.send({
          message: "Lấy thông tin chu kỳ thành công!",
          repeatCycle: configShift.repeatCycle || "Không xác định",
          remindDays: configShift.remindDays || "Không có ngày nhắc nhở",
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy thông tin chu kỳ:", error);
        return ctx.internalServerError(
          "Có lỗi xảy ra khi lấy thông tin chu kỳ."
        );
      }
    },
    async getShiftShopByDate(ctx) {
      try {
        const { shopId, date } = ctx.params;

        // Kiểm tra nếu thiếu tham số
        if (!shopId || !date) {
          return ctx.badRequest("Vui lòng cung cấp đầy đủ shopId và ngày.");
        }

        // Đảm bảo định dạng ngày là chuẩn YYYY-MM-DD
        const formattedDate = new Date(date).toISOString().split("T")[0];

        // Tìm các shift theo shopId và ngày
        const shifts = await strapi.entityService.findMany("api::shift.shift", {
          filters: {
            shop: { id: shopId },
            date: formattedDate,
          },
          populate: {
            skills: true, // Lấy danh sách kỹ năng
            shop: true, // Lấy thông tin shop
            employeeStatuses: {
              populate: {
                user: true, // Thêm thông tin chi tiết nhân viên
              },
            }, // Lấy danh sách trạng thái nhân viên và populate thông tin chi tiết nhân viên
          },
          sort: { startTime: "asc" }, // Sắp xếp theo thời gian bắt đầu
        });

        // Kiểm tra nếu không có shift
        if (shifts.length === 0) {
          return ctx.notFound(
            `Không tìm thấy ca làm việc nào cho ngày ${formattedDate}.`
          );
        }

        return ctx.send({
          message: `Danh sách ca làm việc cho ngày ${formattedDate}.`,
          data: shifts,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy danh sách shift:", error);
        return ctx.internalServerError(
          "Có lỗi xảy ra khi lấy danh sách shift."
        );
      }
    },
    async registerShiftByDate(ctx) {
      try {
        const { shiftId, userId, date } = ctx.request.body;

        // Kiểm tra nếu thiếu tham số
        if (!shiftId || !userId || !date) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ thông tin shiftId, userId và ngày."
          );
        }

        // Đảm bảo định dạng ngày là chuẩn YYYY-MM-DD
        const formattedDate = new Date(date).toISOString().split("T")[0];

        // Tìm shift theo shiftId và ngày
        const shift = await strapi.entityService.findOne(
          "api::shift.shift",
          shiftId,
          {
            populate: {
              employeeStatuses: {
                populate: { user: true },
              },
            },
          }
        );

        if (!shift || shift.date !== formattedDate) {
          return ctx.notFound(
            "Không tìm thấy ca làm việc hoặc ca làm việc không đúng ngày."
          );
        }

        // Kiểm tra số lượng nhân viên đã được "Approved"
        const approvedCount = shift.employeeStatuses.filter(
          (status) => status.status === "Approved"
        ).length;

        if (approvedCount >= shift.maxEmployees) {
          return ctx.conflict(
            "Ca làm việc đã đạt số lượng nhân viên được duyệt tối đa."
          );
        }

        // Kiểm tra nếu nhân viên đã đăng ký ca làm việc này
        const isAlreadyRegistered = shift.employeeStatuses.some(
          (status) => status.user.id === userId
        );

        if (isAlreadyRegistered) {
          return ctx.conflict("Bạn đã đăng ký ca làm việc này trước đó.");
        }

        // Thêm trạng thái đăng ký mới với trạng thái "Pending"
        const newEmployeeStatus = {
          user: userId,
          status: "Pending" as const, // Trạng thái chờ duyệt
          registeredAt: new Date(),
        };

        await strapi.entityService.update("api::shift.shift", shiftId, {
          data: {
            employeeStatuses: [...shift.employeeStatuses, newEmployeeStatus],
          },
        });

        return ctx.send({
          message:
            "Đăng ký ca làm việc thành công. Vui lòng chờ duyệt từ chủ shop.",
          data: newEmployeeStatus,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi đăng ký ca làm việc:", error);
        return ctx.internalServerError(
          "Có lỗi xảy ra khi đăng ký ca làm việc."
        );
      }
    },
    async updateStatusEmployeeShift(ctx) {
      try {
        const { shiftId, userId, status } = ctx.request.body;

        // Kiểm tra nếu thiếu tham số
        if (!shiftId || !userId || !status) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ shiftId, userId và status."
          );
        }

        // Kiểm tra trạng thái hợp lệ
        const validStatuses = ["Pending", "Approved", "Rejected"];
        if (!validStatuses.includes(status)) {
          return ctx.badRequest("Trạng thái không hợp lệ.");
        }

        // Tìm shift và kiểm tra tồn tại
        const shift = await strapi.entityService.findOne(
          "api::shift.shift",
          shiftId,
          {
            populate: { employeeStatuses: { populate: { user: true } } },
          }
        );

        if (!shift) {
          return ctx.notFound(`Không tìm thấy ca làm việc với ID ${shiftId}.`);
        }

        // Tìm trạng thái hiện tại của user trong shift
        const existingStatus = shift.employeeStatuses.find(
          (es) => es.user.id === userId
        );

        if (!existingStatus) {
          return ctx.notFound(
            `Người dùng với ID ${userId} chưa đăng ký ca làm này.`
          );
        }

        // Nếu trạng thái chuyển thành "Approved", kiểm tra số lượng maxEmployees
        if (status === "Approved") {
          const approvedCount = shift.employeeStatuses.filter(
            (es) => es.status === "Approved"
          ).length;

          if (approvedCount >= shift.maxEmployees) {
            return ctx.badRequest("Số nhân viên được duyệt đã đạt tối đa.");
          }
        }

        // Cập nhật trạng thái mới
        const updatedEmployeeStatuses = shift.employeeStatuses.map((es) =>
          es.user.id === userId
            ? { ...es, status, registeredAt: new Date() }
            : es
        );

        // Cập nhật shift trong Strapi
        await strapi.entityService.update("api::shift.shift", shiftId, {
          data: {
            employeeStatuses: updatedEmployeeStatuses,
          },
        });

        let message = `Trạng thái của nhân viên ${existingStatus.user.username} đã được cập nhật thành ${status}.`;
        if (status === "Rejected") {
          message = `Yêu cầu đăng ký của nhân viên ${existingStatus.user.username} đã bị từ chối.`;
        } else if (status === "Pending") {
          message = `Yêu cầu đăng ký của nhân viên ${existingStatus.user.username} đang ở trạng thái chờ duyệt.`;
        }

        return ctx.send({
          success: true,
          message,
        });
      } catch (error) {
        strapi.log.error(
          "Lỗi khi cập nhật trạng thái nhân viên trong ca làm:",
          error
        );
        return ctx.internalServerError(
          "Có lỗi xảy ra khi cập nhật trạng thái."
        );
      }
    },
    async autoAssignShift(ctx) {
      try {
        const { shopId, startDate, endDate } = ctx.request.body;

        if (!shopId || !startDate || !endDate) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ shopId, startDate và endDate."
          );
        }

        // Lấy thông tin shop để lấy owner
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: { owner: true },
          }
        );

        if (!shop || !shop.owner) {
          return ctx.badRequest("Không tìm thấy chủ cửa hàng cho shop này.");
        }

        const owner = shop.owner;
        console.log(`Chủ shop ${shop.name}: ${owner.username}`);

        // Lấy danh sách nhân viên thuộc cửa hàng
        const employees = await strapi.entityService.findMany(
          "plugin::users-permissions.user",
          {
            filters: { shop: { id: shopId } },
            populate: ["skills"],
          }
        );

        const shifts = await strapi.entityService.findMany("api::shift.shift", {
          filters: {
            shop: { id: shopId },
            date: { $gte: new Date(startDate), $lte: new Date(endDate) },
          },
          populate: {
            employeeStatuses: {
              populate: {
                user: { populate: ["skills"] },
              },
            },
            skills: true,
          },
          sort: { date: "asc", startTime: "asc" },
        });

        for (const shift of shifts) {
          console.log(
            `Đang xử lý ca làm: ${shift.name} (${shift.startTime} - ${shift.endTime})`
          );

          const approvedEmployees = shift.employeeStatuses.filter(
            (status) => status.status === "Approved"
          );

          if (approvedEmployees.length >= shift.maxEmployees) {
            console.log(`Ca ${shift.name} đã đủ số lượng nhân viên`);
            continue;
          }

          const requiredSkills = shift.skills.map((skill) => skill.id);
          const pendingRegistrations = shift.employeeStatuses.filter(
            (status) => status.status === "Pending"
          );

          for (const registration of pendingRegistrations) {
            const employee = registration.user;

            if (!employee || !Array.isArray(employee.skills)) {
              console.log(
                `Bỏ qua nhân viên không có thông tin kỹ năng: ${
                  employee?.username || "N/A"
                }`
              );
              continue;
            }

            const matchedSkills = employee.skills.filter((s) =>
              requiredSkills.includes(s.id)
            );

            if (matchedSkills.length > 0) {
              console.log(
                `Duyệt nhân viên ${employee.username} cho ca ${shift.name} (Số kỹ năng khớp: ${matchedSkills.length})`
              );
              await strapi.entityService.update("api::shift.shift", shift.id, {
                data: {
                  employeeStatuses: [
                    ...shift.employeeStatuses.filter(
                      (es) => es.user?.id !== employee.id
                    ),
                    {
                      user: employee.id,
                      status: "Approved",
                      registeredAt: new Date(),
                    },
                  ],
                },
              });
            } else {
              console.log(
                `Từ chối nhân viên ${employee.username} vì không đủ kỹ năng.`
              );
              await strapi.entityService.update("api::shift.shift", shift.id, {
                data: {
                  employeeStatuses: [
                    ...shift.employeeStatuses.filter(
                      (es) => es.user?.id !== employee.id
                    ),
                    {
                      user: employee.id,
                      status: "Rejected",
                      registeredAt: new Date(),
                    },
                  ],
                },
              });
            }
          }

          // Gửi thông báo nếu ca làm việc thiếu người
          if (approvedEmployees.length < shift.maxEmployees) {
            const remainingSlots =
              shift.maxEmployees - approvedEmployees.length;
            console.log(
              `Ca ${shift.name} thiếu ${remainingSlots} nhân viên, gửi thông báo cho chủ shop.`
            );

            // Gửi thông báo cho chủ shop
            await customNotificationService.sendNotification(
              [owner.id.toString()],
              "Ca làm việc thiếu nhân sự",
              `Ca ${shift.name} (${shift.startTime} - ${shift.endTime}) đang thiếu ${remainingSlots} nhân viên.`,
              {
                shopId: Number(shop.id),
                shiftId: Number(shift.id),
                remainingSlots,
              }
            );
          }
        }

        return ctx.send({
          success: true,
          message: "Xếp ca tự động và gửi thông báo thành công.",
        });
      } catch (error) {
        console.error("Lỗi xếp ca tự động:", error);
        return ctx.internalServerError("Có lỗi xảy ra khi xếp ca tự động.");
      }
    },
    async getUserWageByMonth(ctx) {
      try {
        const { userId } = ctx.params;
        const { month, year } = ctx.query;

        // Tạo khoảng thời gian giống như trong addCheckIn
        const startOfMonth = new Date(year, month - 1, 2); // Ngày 2 trong logic của bạn (tương ứng 01/01)
        const endOfMonth = new Date(year, month, 1); // Ngày cuối tháng (31/01)

        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          { populate: ["wage"] }
        );

        if (!user) {
          return ctx.notFound("User not found");
        }

        console.log(`Wage entries for user ${userId}:`, user.wage);

        const wageEntry = user.wage.find((w) => {
          const wageStartDay = new Date(w.startDay).toISOString().split("T")[0];
          const wageEndDay = new Date(w.endDay).toISOString().split("T")[0];
          const formattedStartOfMonth = startOfMonth
            .toISOString()
            .split("T")[0];
          const formattedEndOfMonth = endOfMonth.toISOString().split("T")[0];

          console.log(
            `Comparing wage range: ${wageStartDay} - ${wageEndDay} with ${formattedStartOfMonth} - ${formattedEndOfMonth}`
          );

          return (
            wageStartDay === formattedStartOfMonth &&
            wageEndDay === formattedEndOfMonth
          );
        });

        if (!wageEntry) {
          strapi.log.info(`No wage found for month: ${month}, year: ${year}`);
          return ctx.notFound(`No wage record found for ${month}/${year}`);
        }

        return ctx.send({ data: wageEntry });
      } catch (error) {
        strapi.log.error(error);
        return ctx.internalServerError("Something went wrong");
      }
    },
    async sendNotificationReminderToEmployee(ctx) {
      try {
        const { shopId } = ctx.params; // ID của shop
        const { name, detail, userId } = ctx.request.body; // Dữ liệu từ body
        console.log(
          "sendNotificationReminderToEmployee",
          shopId,
          name,
          detail,
          userId
        );

        if (!name || !detail || !userId) {
          return ctx.badRequest(
            "Thiếu dữ liệu cần thiết (name, detail, userId)"
          );
        }

        // Tìm kiếm thông tin shop
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: { request: true },
          }
        );

        if (!shop) {
          return ctx.notFound("Không tìm thấy cửa hàng với ID được cung cấp.");
        }

        // Tìm kiếm thông tin nhân viên dựa vào userId
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          { fields: ["name", "tokenExpo"] }
        );

        if (!user) {
          return ctx.notFound("Không tìm thấy nhân viên với ID được cung cấp.");
        }

        if (!user.tokenExpo || !Expo.isExpoPushToken(user.tokenExpo)) {
          return ctx.badRequest(
            "Người dùng không có token Expo hợp lệ để nhận thông báo."
          );
        }

        // Gửi thông báo bằng customNotificationService
        const notificationData = {
          shopId: shopId,
          userId: userId,
        };

        const response = await customNotificationService.sendNotification(
          [userId.toString()], // Danh sách userId (phải là chuỗi)
          name, // Tiêu đề
          detail, // Nội dung chi tiết
          notificationData // Dữ liệu bổ sung
        );

        if (!response.success) {
          return ctx.internalServerError("Lỗi khi gửi thông báo.");
        }

        await strapi.entityService.update("api::shop.shop", shopId, {
          data: {
            request: [
              ...shop.request,
              {
                name: name,
                detail: detail,
                userId: Number(userId),
              },
            ],
          },
        });

        return ctx.send({
          success: true,
          message: "Gửi thông báo và lưu yêu cầu thành công!",
        });
      } catch (error) {
        strapi.log.error(
          "Lỗi khi gửi thông báo nhắc nhở cho nhân viên:",
          error
        );
        return ctx.internalServerError("Có lỗi xảy ra khi gửi thông báo.");
      }
    },
    async getListTopTask(ctx) {
      try {
        const { shopId, month, year } = ctx.request.query; // Lấy shopId, tháng và năm từ query params

        if (!shopId || !month || !year) {
          return ctx.badRequest(
            "Vui lòng cung cấp shopId, tháng và năm để lọc dữ liệu."
          );
        }

        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0, 23, 59, 59);

        // Lấy danh sách nhân viên của shop kèm theo task
        const users = await strapi.entityService.findMany(
          "plugin::users-permissions.user",
          {
            populate: {
              Task: true,
            },
            filters: {
              shop: {
                id: shopId, // Lọc theo shopId
              },
              Task: {
                time_create: {
                  $gte: startOfMonth.toISOString(),
                  $lte: endOfMonth.toISOString(),
                },
              },
            },
          }
        );

        if (users.length === 0) {
          return ctx.send({
            success: false,
            message:
              "Không có nhân viên nào hoàn thành task trong tháng được chọn.",
          });
        }

        // Tính tổng progress cho mỗi user
        const userProgressData = users.map((user) => {
          const totalProgress = user.Task.reduce(
            (sum, task) => sum + (task.progess || 0),
            0
          );
          return {
            userId: user.id,
            name: user.name,
            email: user.email,
            totalProgress,
          };
        });

        // Sắp xếp danh sách user theo tổng progress giảm dần
        const sortedUsers = userProgressData.sort(
          (a, b) => b.totalProgress - a.totalProgress
        );

        // Lấy top 10 người hoàn thành task nhiều nhất
        const top10Users = sortedUsers.slice(0, 10);
        console.log("top10Users", top10Users);

        return ctx.send({
          success: true,
          data: top10Users,
        });
      } catch (error) {
        strapi.log.error(
          "Lỗi khi lấy danh sách top 10 nhân viên hoàn thành task:",
          error
        );
        return ctx.internalServerError(
          "Có lỗi xảy ra khi lấy danh sách top 10 nhân viên."
        );
      }
    },
    async addReward(ctx) {
      try {
        const { label, userId, amount, reason } = ctx.request.body;

        if (!label || !userId || amount === undefined || !reason) {
          return ctx.badRequest(
            "Thiếu dữ liệu cần thiết (label, userId, amount, reason)"
          );
        }

        if (amount <= 0) {
          return ctx.badRequest("Số tiền phải lớn hơn 0");
        }

        // Tìm thông tin user
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          {
            populate: ["wage", "reward"],
          }
        );

        if (!user) {
          return ctx.notFound("Không tìm thấy nhân viên với ID được cung cấp.");
        }

        const today = new Date();
        const currentMonthStart = new Date(
          today.getFullYear(),
          today.getMonth(),
          2
        ); // Ngày đầu tháng
        const currentMonthEnd = new Date(
          today.getFullYear(),
          today.getMonth() + 1,
          1
        ); // Ngày cuối tháng

        const formattedStartDay = currentMonthStart.toISOString();
        const formattedEndDay = currentMonthEnd.toISOString();

        // Tìm bản ghi wage nằm trong tháng hiện tại
        let wageEntry = user.wage.find((w) => {
          const startDay = new Date(w.startDay).getTime();
          const endDay = new Date(w.endDay).getTime();
          return today.getTime() >= startDay && today.getTime() <= endDay;
        });

        if (!wageEntry) {
          // Nếu không có bản ghi wage trong tháng, tạo mới
          wageEntry = {
            id: user.wage.length + 1,
            wage: 0,
            startDay: formattedStartDay,
            endDay: formattedEndDay,
          };
          user.wage.push(wageEntry);
        }

        // Tính toán thưởng/phạt
        if (label === "reward") {
          wageEntry.wage += amount; // Cộng số tiền thưởng
        } else if (label === "penalty") {
          wageEntry.wage -= amount; // Trừ số tiền phạt
          if (wageEntry.wage < 0) wageEntry.wage = 0; // Đảm bảo wage không âm
        } else {
          return ctx.badRequest(
            "Label không hợp lệ (chỉ nhận 'reward' hoặc 'penalty')"
          );
        }

        // Tạo bản ghi reward mới
        const newReward = {
          reson: reason,
          amount: amount,
          date: today.toISOString(),
          type: label, // "reward" hoặc "penalty"
        };

        // Thêm bản ghi reward vào user
        const updatedRewards = user.reward
          ? [...user.reward, newReward]
          : [newReward];

        // Cập nhật user với thông tin mới
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          userId,
          {
            data: {
              wage: user.wage.map((w) => ({
                wage: w.wage,
                startDay: w.startDay,
                endDay: w.endDay,
              })),
              reward: updatedRewards,
            },
          }
        );

        return ctx.send({
          success: true,
          message: `Đã ${
            label === "reward" ? "thưởng" : "phạt"
          } thành công cho nhân viên.`,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi xử lý thưởng/phạt:", error);
        return ctx.internalServerError("Có lỗi xảy ra khi xử lý thưởng/phạt.");
      }
    },
    async historyRewardByUserMonth(ctx) {
      try {
        const { userId } = ctx.params; // Lấy userId từ URL params
        const { month, year } = ctx.request.query; // Lấy tháng và năm từ query params
        console.log("userId", userId, "month", month, "year", year);

        if (!userId || !month || !year) {
          return ctx.badRequest(
            "Vui lòng cung cấp userId, tháng (month) và năm (year)."
          );
        }

        const selectedMonth = parseInt(month, 10); // Chuyển thành số nguyên
        const selectedYear = parseInt(year, 10); // Chuyển thành số nguyên

        // Kiểm tra tính hợp lệ của tháng và năm
        if (
          isNaN(selectedMonth) ||
          isNaN(selectedYear) ||
          selectedMonth < 1 ||
          selectedMonth > 12
        ) {
          return ctx.badRequest("Tháng hoặc năm không hợp lệ.");
        }

        // Tìm thông tin user và populate reward
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId,
          {
            populate: { reward: true },
          }
        );

        if (!user) {
          return ctx.notFound("Không tìm thấy nhân viên với ID được cung cấp.");
        }

        // Lọc danh sách reward/phạt theo tháng và năm
        const filteredRewards = user.reward.filter((reward) => {
          const rewardDate = new Date(reward.date);
          return (
            rewardDate.getFullYear() === selectedYear &&
            rewardDate.getMonth() + 1 === selectedMonth // `getMonth()` trả về 0 - 11, cần cộng 1
          );
        });

        return ctx.send({
          success: true,
          data: filteredRewards,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy lịch sử thưởng/phạt theo tháng:", error);
        return ctx.internalServerError("Có lỗi xảy ra khi xử lý yêu cầu.");
      }
    },
  })
);
