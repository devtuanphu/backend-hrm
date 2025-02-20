import { factories } from "@strapi/strapi";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
import customNotificationService from "../../notification/services/customNotification";
import Expo from "expo-server-sdk";
import { GetValues } from "@strapi/types/dist/types/core/attributes";
interface Product {
  id: number;
  name: string;
  description?: string;
  amount: number;
  image?: any; // Nếu image là một Media, bạn có thể định nghĩa chi tiết hơn
  priceImport: number;
  priceExport: number;
}

interface Shop {
  id: number;
  products: Product[]; // Mảng sản phẩm
}
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
          populate: {
            checkIn: true,
            owner: true,
            reportCheckInDay: {
              populate: ["detail"], // Populate detail bên trong reportCheckInDay
            },
          },
        });

        if (!shop.reportCheckInDay) {
          console.log("ReportCheckInDay is missing!");
        }

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
        const localDateString = today.toLocaleDateString("en-CA"); // YYYY-MM-DD
        let report = shop.reportCheckInDay.find(
          (r) =>
            new Date(r.date).toLocaleDateString("en-CA") === localDateString
        );
        console.log(report);

        if (!report) {
          report = {
            id: Date.now(),
            date: localDateString,
            detail: [],
          };
          shop.reportCheckInDay.push(report);
        }
        let userDetail = report.detail.find((d) => d.userId === checkIn.userId);

        if (!userDetail) {
          // Nếu không có chi tiết báo cáo cho nhân viên này thì thêm mới
          userDetail = {
            id: Date.now(), // Add a unique ID
            userId: checkIn.userId,
            nameStaff: checkIn.name || "Không xác định",
            position: checkIn.position || "Chưa có vị trí",
            checkIn: checkIn.time,
            checkOut: null,
            work: "0",
            wage: 0,
          };
          report.detail.push(userDetail);
        }

        const todayCheckIns = shop.checkIn.filter(
          (c) =>
            c.userId === checkIn.userId &&
            new Date(c.time).toDateString() === today.toDateString()
        );
        const isCheckOut = todayCheckIns.length % 2 !== 0;
        const isCheckIn = !isCheckOut;

        let wageToAdd = 0;

        if (isCheckIn) {
          // **Trường hợp check-in: chỉ cập nhật trường checkIn**
          userDetail.checkIn = checkIn.time;
          console.log(`User ${checkIn.userId} checked in at ${checkIn.time}`);
        }
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

            userDetail.checkOut = checkIn.time;
            userDetail.work = workedHours.toFixed(2);
            userDetail.wage += wageToAdd;
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
          const isCheckOut = todayCheckIns.length % 2 !== 0;
          if (isCheckOut) {
            const lastCheckIn = todayCheckIns[todayCheckIns.length - 1];
            const checkOutTime = new Date(checkIn.time);
            const checkInTime = new Date(lastCheckIn.time);
            const workedHours =
              (checkOutTime.getTime() - checkInTime.getTime()) /
              (1000 * 60 * 60);
            userDetail.checkOut = checkIn.time;
            userDetail.work = String(workedHours);
            userDetail.wage += wageToAdd;
          }
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
          if (isCheckIn) {
            userDetail.checkIn = checkIn.time;
          } else {
            userDetail.checkOut = checkIn.time;
            const checkOutTime = new Date(userDetail.checkOut);
            const checkInTime = new Date(userDetail.checkIn);
            const workedHours =
              (checkOutTime.getTime() - checkInTime.getTime()) /
              (1000 * 60 * 60); // Tính tổng giờ làm việc
            userDetail.work = workedHours.toFixed(2); // Cập nhật giờ làm việc
            userDetail.wage += wageToAdd;
          }
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

        const updatedReportCheckInDay = shop.reportCheckInDay.map((r) =>
          r.date === report.date ? report : r
        );

        await strapi.entityService.update("api::shop.shop", id, {
          data: { reportCheckInDay: updatedReportCheckInDay },
        });

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
          if (isCheckIn) {
            // Cập nhật trường isWork của người dùng thành true khi là check-in
            await strapi.entityService.update(
              "plugin::users-permissions.user",
              checkIn.userId,
              {
                data: {
                  isWork: true,
                },
              }
            );
            console.log(`Updated user ${checkIn.userId} to isWork: true`);
          } else if (isCheckOut) {
            // Cập nhật trường isWork của người dùng thành false khi là check-out
            await strapi.entityService.update(
              "plugin::users-permissions.user",
              checkIn.userId,
              {
                data: {
                  isWork: false,
                },
              }
            );
            console.log(`Updated user ${checkIn.userId} to isWork: false`);
          }
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
    async getreportCheckInDay(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy shopId từ params
        const { date } = ctx.query; // Lấy ngày từ query nếu có

        // Xác định ngày tìm kiếm
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const localDateString = date || today.toLocaleDateString("en-CA"); // Nếu có `date` thì dùng `date`, nếu không thì dùng ngày hôm nay

        // Tìm shop với `reportCheckInDay` theo ngày được yêu cầu
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: {
              reportCheckInDay: {
                populate: {
                  detail: true, // Lấy chi tiết các nhân viên trong báo cáo
                },
              },
            },
          }
        );

        if (!shop) {
          return ctx.notFound(`Không tìm thấy shop với ID: ${shopId}`);
        }

        // Tìm báo cáo trong ngày cụ thể
        const report = shop.reportCheckInDay.find(
          (report) =>
            new Date(report.date).toLocaleDateString("en-CA") ===
            localDateString
        );

        if (!report) {
          return ctx.notFound(
            `Không tìm thấy báo cáo cho ngày ${localDateString}`
          );
        }

        // Trả về báo cáo
        return ctx.send({
          message: `Báo cáo ngày ${localDateString} cho shop ${shopId}`,
          data: report,
        });
      } catch (error) {
        strapi.log.error(`Lỗi khi lấy báo cáo: ${error.message}`);
        return ctx.internalServerError("Có lỗi xảy ra khi lấy báo cáo");
      }
    },
    async getshiftArireByDate(ctx) {
      try {
        const { date } = ctx.request.query; // date vẫn trong query
        const { shopId } = ctx.params; // shopId lấy từ params
        console.log("date", date, "shopId", shopId);

        if (!date) {
          return ctx.badRequest("Vui lòng cung cấp ngày (YYYY-MM-DD)");
        }

        if (!shopId) {
          return ctx.badRequest("Vui lòng cung cấp shopId");
        }

        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            filters: {
              shiftArire: {
                date: date, // So sánh ngày làm việc
              },
            },
            populate: {
              shiftArire: {
                populate: ["statusStaff.user"], // Populate để lấy user trong statusStaff
              },
            },
          }
        );

        if (!shop) {
          return ctx.notFound(`Không tìm thấy shop với ID: ${shopId}`);
        }

        const result = {
          shopId: shop.id,
          shopName: shop.name,
          shiftArire: shop.shiftArire.map((shift) => ({
            id: shift.id,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            rate: shift.rate,
            statusStaff: shift.statusStaff.map((staff) => ({
              userId: staff.user?.id || null,
              name: staff.user?.name || "Chưa rõ",
              status: staff.status || "N/A",
              registeredAt: staff.registeredAt,
            })),
          })),
        };

        return ctx.send({
          success: true,
          data: result,
          message: `Danh sách ca làm việc phát sinh cho shop ${shop.name} vào ngày ${date}`,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy danh sách shiftArire:", error);
        return ctx.internalServerError("Lỗi khi lấy dữ liệu shiftArire");
      }
    },
    async createShiftArire(ctx) {
      try {
        const { shopId, date, startTime, endTime, rate, statusStaff } =
          ctx.request.body;

        // Kiểm tra các thông tin cần thiết
        if (!shopId || !date || !startTime || !endTime || !rate) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ thông tin: shopId, date, startTime, endTime, rate"
          );
        }

        // Tìm shop cần thêm shiftArire
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: { shiftArire: true }, // Populate để lấy các ca làm việc hiện tại
          }
        );

        if (!shop) {
          return ctx.notFound(`Không tìm thấy shop với ID: ${shopId}`);
        }

        // Tạo một ca làm việc phát sinh mới
        const newShiftArire = {
          date,
          startTime,
          endTime,
          rate,
          statusStaff: statusStaff || [], // Mặc định là mảng rỗng nếu không có staff
        };

        // Push thêm ca mới vào mảng shiftArire cũ
        const updatedShiftArireList = [
          ...(shop.shiftArire || []),
          newShiftArire,
        ];

        // Cập nhật shop với shiftArire mới
        await strapi.entityService.update("api::shop.shop", shopId, {
          data: {
            shiftArire: updatedShiftArireList,
          },
        });

        const users: { id: number; name: string; tokenExpo?: string }[] =
          await strapi.entityService.findMany(
            "plugin::users-permissions.user",
            {
              filters: {
                shop: {
                  id: shopId, // Lọc theo shop.id
                },
              },
              populate: ["shop"], // Đảm bảo populate để truy cập shop.id
              fields: ["id", "name", "tokenExpo"], // Lấy các trường cần thiết
            }
          );
        const userIdsWithTokens = users
          .filter((user) => user.tokenExpo) // Chỉ chọn nhân viên có `tokenExpo`
          .map((user) => {
            console.log(`Đã gửi thông báo cho: ${user.name} (ID: ${user.id})`); // Log ra tên và ID
            return user.id.toString(); // Chuyển ID thành chuỗi nếu cần thiết
          });

        // **Gửi thông báo nếu có nhân viên**
        if (userIdsWithTokens.length > 0) {
          await customNotificationService.sendNotification(
            userIdsWithTokens,
            "Ca làm việc khẩn cấp",
            `Ca làm từ ${startTime} đến ${endTime} vào ngày ${date} vừa được tạo!`,
            {
              shopId,
              date,
              startTime,
              endTime,
            }
          );
        }

        return ctx.send({
          success: true,
          message: "Tạo ca làm việc phát sinh thành công!",
          data: newShiftArire,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi tạo ca làm việc phát sinh:", error);
        return ctx.internalServerError("Lỗi khi tạo ca làm việc phát sinh");
      }
    },
    async updateStatusStaffShiftArire(ctx) {
      try {
        const { shopId, shiftArireId, userId, status } = ctx.request.body;

        if (!shopId || !shiftArireId || !userId || !status) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ thông tin: shopId, shiftArireId, userId, status."
          );
        }

        const validStatuses = ["Pending", "Approved", "Rejected"];
        if (!validStatuses.includes(status)) {
          return ctx.badRequest("Trạng thái không hợp lệ.");
        }

        const shiftArire = await strapi.db.query("api::shop.shop").findOne({
          where: {
            id: shopId,
            shiftArire: {
              id: shiftArireId,
            },
          },
          populate: {
            shiftArire: {
              populate: ["statusStaff.user"],
            },
          },
        });

        if (!shiftArire || !shiftArire.shiftArire.length) {
          return ctx.notFound(
            `Không tìm thấy ca làm việc với ID: ${shiftArireId}`
          );
        }

        const targetShift = shiftArire.shiftArire.find(
          (shift) => shift.id === shiftArireId
        );

        if (!targetShift || !Array.isArray(targetShift.statusStaff)) {
          return ctx.notFound(
            `Không tìm thấy danh sách nhân viên trong ca làm việc.`
          );
        }

        const staffIndex = targetShift.statusStaff.findIndex(
          (staff) => staff.user?.id === userId
        );

        if (staffIndex === -1) {
          return ctx.notFound(
            `Không tìm thấy nhân viên với ID: ${userId} trong ca làm việc.`
          );
        }

        if (status === "Approved") {
          // Lấy `user` để cập nhật `wage`
          const user = await strapi.db
            .query("plugin::users-permissions.user")
            .findOne({
              where: { id: userId },
              populate: { wage: true },
            });

          if (!user) {
            return ctx.notFound(`Không tìm thấy user với ID: ${userId}`);
          }

          const shiftDate = new Date(targetShift.date);
          const year = shiftDate.getFullYear();
          const month = shiftDate.getMonth() + 1; // tháng trong JavaScript bắt đầu từ 0

          // Kiểm tra `wage` trong tháng của `shiftArire`
          const wageIndex = user.wage.findIndex(
            (w) =>
              new Date(w.startDay).getFullYear() === year &&
              new Date(w.startDay).getMonth() + 1 === month
          );

          if (wageIndex !== -1) {
            // Nếu đã có `wage` cho tháng đó, cộng thêm `rate`
            user.wage[wageIndex].wage += targetShift.rate;
          } else {
            // Nếu chưa có `wage`, thêm mới
            user.wage.push({
              wage: targetShift.rate,
              startDay: new Date(year, month - 1, 1),
              endDay: new Date(year, month, 0), // ngày cuối cùng của tháng
            });
          }

          // Cập nhật `user` với `wage` mới
          await strapi.entityService.update(
            "plugin::users-permissions.user",
            userId,
            {
              data: { wage: user.wage },
            }
          );
        }

        targetShift.statusStaff[staffIndex].status = status;

        // Cập nhật dữ liệu `shiftArire` sau khi đổi trạng thái nhân viên
        await strapi.entityService.update("api::shop.shop", shopId, {
          data: {
            shiftArire: shiftArire.shiftArire,
          },
        });

        return ctx.send({
          success: true,
          message: `Cập nhật trạng thái thành công cho nhân viên ID: ${userId} trong ca làm việc với ID: ${shiftArireId}.`,
          data: {
            userId,
            status,
            shiftArireId,
          },
        });
      } catch (error) {
        strapi.log.error(
          "Lỗi khi cập nhật trạng thái nhân viên trong ca làm việc:",
          error
        );
        return ctx.internalServerError(
          "Lỗi khi cập nhật trạng thái nhân viên trong ca làm việc."
        );
      }
    },
    async registerShiftArireByStaff(ctx) {
      try {
        const { shopId, shiftArireId, userId } = ctx.request.body;

        // Kiểm tra nếu thiếu dữ liệu cần thiết
        if (!shopId || !shiftArireId || !userId) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ thông tin: shopId, shiftArireId, userId."
          );
        }

        // Tìm shop và shiftArire
        const shiftArire = await strapi.db.query("api::shop.shop").findOne({
          where: {
            id: shopId,
            shiftArire: {
              id: shiftArireId,
            },
          },
          populate: {
            shiftArire: {
              populate: ["statusStaff.user"],
            },
          },
        });

        if (!shiftArire || !shiftArire.shiftArire.length) {
          return ctx.notFound(
            `Không tìm thấy ca làm việc với ID: ${shiftArireId}`
          );
        }

        const targetShift = shiftArire.shiftArire.find(
          (shift) => shift.id === shiftArireId
        );

        if (!targetShift || !Array.isArray(targetShift.statusStaff)) {
          return ctx.notFound(
            `Không tìm thấy danh sách nhân viên trong ca làm việc.`
          );
        }

        // Kiểm tra xem nhân viên đã đăng ký vào ca làm việc này chưa
        const isAlreadyRegistered = targetShift.statusStaff.some(
          (staff) => staff.user?.id === userId
        );

        if (isAlreadyRegistered) {
          return ctx.send({
            success: true,
            message: "Nhân viên đã check out ca làm này.",
            data: {
              userId,
              shiftArireId,
              status: "Already Registered",
            },
          });
        }

        // Thêm nhân viên vào danh sách statusStaff với trạng thái Pending
        targetShift.statusStaff.push({
          user: userId,
          status: "Pending",
          registeredAt: new Date().toISOString(), // Thời gian đăng ký
        });

        // Cập nhật lại dữ liệu shiftArire trong shop
        await strapi.entityService.update("api::shop.shop", shopId, {
          data: {
            shiftArire: shiftArire.shiftArire,
          },
        });

        return ctx.send({
          success: true,
          message: `Nhân viên đã vào ca làm việc khẩn cấp với.`,
          data: {
            userId,
            shiftArireId,
            status: "Pending",
          },
        });
      } catch (error) {
        strapi.log.error("Lỗi khi nhân viên đăng ký vào ca làm việc:", error);
        return ctx.internalServerError("Lỗi khi đăng ký vào ca làm việc.");
      }
    },
    async updateWage(ctx) {
      try {
        const { userId, shopId, amount } = ctx.request.body; // Thông tin lương mới
        console.log("userId", userId, "shopId", shopId, "amount", amount);

        if (!userId || !shopId || !amount) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ thông tin: userId, shopId, amount."
          );
        }

        // Lấy thông tin nhân viên từ `user`
        const user = await strapi.entityService.findOne(
          "plugin::users-permissions.user",
          userId
        );

        if (!user) {
          return ctx.notFound(`Không tìm thấy nhân viên với ID: ${userId}`);
        }

        // Cập nhật lại trường `rate` trong `user` với mức lương mới
        await strapi.entityService.update(
          "plugin::users-permissions.user",
          userId,
          {
            data: {
              rate: amount, // Số lương mới
            },
          }
        );

        // Lưu vào lịch sử tăng lương (`historyWage`) trong shop
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["historyWage"],
          }
        );

        if (!shop) {
          return ctx.notFound(`Không tìm thấy shop với ID: ${shopId}`);
        }

        const newHistoryWage = {
          userId: userId,
          amount: amount, // Số lương mới
          date: new Date().toISOString(), // Ngày cập nhật lương
        };

        await strapi.entityService.update("api::shop.shop", shopId, {
          data: {
            historyWage: [...(shop.historyWage || []), newHistoryWage], // Thêm bản ghi mới vào lịch sử
          },
        });

        return ctx.send({
          success: true,
          message: `Cập nhật lương thành công cho nhân viên ID: ${userId}`,
          data: {
            userId,
            newRate: amount, // Trả về số lương mới
            history: newHistoryWage,
          },
        });
      } catch (error) {
        strapi.log.error("Lỗi khi cập nhật lương:", error);
        return ctx.internalServerError("Đã xảy ra lỗi khi cập nhật lương.");
      }
    },
    async getHistoryWageByMonth(ctx) {
      try {
        const { shopId, month, year } = ctx.request.query; // Nhận thông tin từ query params

        if (!shopId || !month || !year) {
          return ctx.badRequest(
            "Vui lòng cung cấp đầy đủ thông tin: shopId, month, year."
          );
        }

        // Lấy thông tin shop và populate lịch sử lương
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["historyWage"],
          }
        );

        if (!shop) {
          return ctx.notFound(`Không tìm thấy shop với ID: ${shopId}`);
        }

        // Lọc lịch sử lương theo tháng và năm
        const filteredHistory = shop.historyWage.filter((record) => {
          const recordDate = new Date(record.date);
          return (
            recordDate.getMonth() + 1 === parseInt(month) && // Lưu ý: `getMonth()` trả về giá trị từ 0-11
            recordDate.getFullYear() === parseInt(year)
          );
        });

        // Lấy thông tin chi tiết của các user từ `userId`
        const userDetailsPromises = filteredHistory.map(async (record) => {
          const user = await strapi.entityService.findOne(
            "plugin::users-permissions.user",
            record.userId,
            {
              fields: ["username", "email", "rate"], // Các trường cần lấy
            }
          );

          return {
            ...record,
            user: user
              ? {
                  username: user.username || "Không có tên",
                  email: user.email || "Không có email",
                  rate: user.rate || 0,
                }
              : null, // Nếu không tìm thấy user, trả về null
          };
        });

        const historyWithUserDetails = await Promise.all(userDetailsPromises);

        return ctx.send({
          success: true,
          data: historyWithUserDetails,
          message: `Lịch sử lương cho tháng ${month}/${year} thành công.`,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy lịch sử lương:", error);
        return ctx.internalServerError("Đã xảy ra lỗi khi lấy lịch sử lương.");
      }
    },
    async getPromotionShopByMonth(ctx) {
      try {
        const { shopId } = ctx.params;
        const { month, year } = ctx.request.query;

        if (!shopId || !month || !year) {
          return ctx.badRequest("Please provide shopId, month, and year.");
        }

        // Fetch the shop and populate its promotions
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["promotions"],
          }
        );

        if (!shop) {
          return ctx.notFound(`No shop found with ID: ${shopId}`);
        }

        // Filter promotions based on month and year
        const filteredPromotions = shop.promotions.filter((promo) => {
          const promoDate = new Date(promo.date);
          return (
            promoDate.getMonth() + 1 === parseInt(month, 10) && // getMonth() returns 0-11
            promoDate.getFullYear() === parseInt(year, 10)
          );
        });

        return ctx.send({
          success: true,
          data: filteredPromotions,
          message: `Promotions for shop ${shopId} for month ${month}/${year} retrieved successfully.`,
        });
      } catch (error) {
        strapi.log.error("Error retrieving promotions by month:", error);
        return ctx.internalServerError(
          "An error occurred while processing the request."
        );
      }
    },
    async addPromotionToShop(ctx) {
      try {
        const { shopId } = ctx.params;
        const { title, detail, date } = ctx.request.body;

        if (!title || !date) {
          return ctx.badRequest(
            "Missing required fields: title, detail, date."
          );
        }

        // Fetch the shop to add the promotion to
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["promotions"],
          }
        );

        if (!shop) {
          return ctx.notFound(`No shop found with ID: ${shopId}`);
        }

        // Create the promotion object
        const newPromotion = {
          title,
          detail,
          date: new Date(date),
        };

        // Assuming the promotions field in the shop model is an array of components
        const updatedPromotions = [...shop.promotions, newPromotion];

        // Update the shop with the new list of promotions
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              promotions: updatedPromotions,
            },
          }
        );
        return ctx.send({
          message: "Promotion added successfully to shop",
          data: updatedShop,
        });
      } catch (error) {
        strapi.log.error("Error adding promotion to shop:", error);
        return ctx.internalServerError("Failed to add promotion.");
      }
    },
    async deletePromotionFromShop(ctx) {
      try {
        const { shopId, promotionId } = ctx.params;

        // Fetch the shop and its promotions
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["promotions"],
          }
        );

        if (!shop) {
          return ctx.notFound(`No shop found with ID: ${shopId}`);
        }

        // Check if the promotion exists
        const promotionExists = shop.promotions.some(
          (promo) => promo.id === parseInt(promotionId, 10)
        );
        if (!promotionExists) {
          return ctx.notFound(`No promotion found with ID: ${promotionId}`);
        }

        // Remove the promotion from the list
        const updatedPromotions = shop.promotions.filter(
          (promo) => promo.id !== parseInt(promotionId, 10)
        );

        // Update the shop with the new list of promotions
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              promotions: updatedPromotions,
            },
          }
        );

        return ctx.send({
          message: "Promotion deleted successfully from shop",
          data: updatedShop,
        });
      } catch (error) {
        strapi.log.error("Error deleting promotion from shop:", error);
        return ctx.internalServerError("Failed to delete promotion.");
      }
    },
    async getBirthDateStaffByMonth(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy shopId từ params
        const { month } = ctx.query; // Lấy tháng từ query

        if (!shopId || !month) {
          return ctx.badRequest("Vui lòng cung cấp đầy đủ shopId và month.");
        }

        // Tìm kiếm nhân viên thuộc shop và kiểm tra tháng sinh
        const users = await strapi.entityService.findMany(
          "plugin::users-permissions.user",
          {
            filters: {
              shop: shopId,
              birthdate: {
                $notNull: true, // Chỉ lấy nhân viên có birthdate khác null
              },
            },
            populate: ["shop"], // Nếu cần lấy thêm thông tin shop
          }
        );

        // Lọc nhân viên có tháng sinh trùng với tháng được yêu cầu
        const filteredUsers = users.filter((user) => {
          const birthdate = new Date(user.birthdate);
          return birthdate.getMonth() + 1 === parseInt(month); // Lọc theo tháng
        });

        if (!filteredUsers.length) {
          return ctx.notFound(
            "Không tìm thấy nhân viên nào có sinh nhật trong tháng yêu cầu."
          );
        }

        return ctx.send({
          message: "Danh sách nhân viên tìm thấy thành công.",
          data: filteredUsers,
        });
      } catch (error) {
        strapi.log.error("Lỗi khi lấy danh sách nhân viên:", error);
        return ctx.internalServerError(
          "Có lỗi xảy ra khi lấy danh sách nhân viên."
        );
      }
    },
    async getProductByShop(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy shopId từ params URL

        if (!shopId) {
          return ctx.badRequest("Shop ID is required");
        }

        // Tìm shop dựa trên shopId và populate products cùng image
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: {
              products: {
                populate: ["image"], // Populate cả image trong products
                sort: { id: "desc" }, // Sắp xếp sản phẩm theo id giảm dần
              },
            },
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Trả về danh sách sản phẩm (products) của shop
        return ctx.send({
          success: true,
          data: shop.products || [], // Trả về danh sách products hoặc mảng rỗng nếu không có
        });
      } catch (error) {
        console.error("Error fetching products by shop:", error);
        return ctx.internalServerError("Unable to fetch products");
      }
    },
    async addProductToShop(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy shopId từ params URL
        const { name, description, amount, image, priceImport, priceExport } =
          ctx.request.body; // Dữ liệu sản phẩm từ request body

        if (!shopId) {
          return ctx.badRequest("Shop ID is required");
        }

        if (!name || !priceImport || !priceExport) {
          return ctx.badRequest(
            "Name, priceImport, and priceExport are required fields"
          );
        }

        // Tìm shop và populate products
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["products"],
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Tạo sản phẩm mới
        const newProduct = {
          name,
          description: description || "", // Mặc định description là chuỗi rỗng
          amount: amount || 0, // Mặc định amount là 0 nếu không có
          image,
          priceImport,
          priceExport,
        };

        // Thêm sản phẩm vào danh sách products hiện có
        const updatedProducts = shop.products
          ? [...shop.products, newProduct]
          : [newProduct];

        // Cập nhật shop với danh sách products mới
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              products: updatedProducts, // Cập nhật danh sách sản phẩm
            },
          }
        );

        return ctx.send({
          success: true,
          message: "Product added successfully",
          data: updatedShop,
        });
      } catch (error) {
        console.error("Error adding product to shop:", error);
        return ctx.internalServerError("Unable to add product to shop");
      }
    },
    async deleteProductFromShop(ctx) {
      try {
        const { shopId, productId } = ctx.params; // Lấy shopId và productId từ URL params

        if (!shopId || !productId) {
          return ctx.badRequest("Shop ID and Product ID are required");
        }

        // Tìm shop và populate danh sách products
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["products"],
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Kiểm tra xem sản phẩm có tồn tại trong danh sách không
        const productExists = shop.products.some(
          (product) => product.id === parseInt(productId, 10)
        );

        if (!productExists) {
          return ctx.notFound("Product not found in the shop");
        }

        // Lọc bỏ sản phẩm có `id` tương ứng
        const updatedProducts = shop.products.filter(
          (product) => product.id !== parseInt(productId, 10)
        );

        // Cập nhật lại danh sách products của shop
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              products: updatedProducts,
            },
          }
        );

        return ctx.send({
          success: true,
          message: "Product deleted successfully",
          data: updatedShop,
        });
      } catch (error) {
        console.error("Error deleting product from shop:", error);
        return ctx.internalServerError("Unable to delete product");
      }
    },
    async updateProductInShop(ctx) {
      try {
        const { shopId, productId } = ctx.params; // Lấy shopId và productId từ params URL
        const { name, description, amount, priceImport, priceExport, image } =
          ctx.request.body; // Dữ liệu sản phẩm từ request body

        if (!shopId) {
          return ctx.badRequest("Shop ID is required");
        }

        if (!productId) {
          return ctx.badRequest("Product ID is required");
        }

        // Tìm shop và populate danh sách products
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["products"],
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Tìm sản phẩm cần cập nhật
        const productIndex = shop.products.findIndex(
          (product) => product.id === parseInt(productId, 10)
        );

        if (productIndex === -1) {
          return ctx.notFound("Product not found in the shop");
        }

        // Lấy sản phẩm cần cập nhật
        const productToUpdate = shop.products[productIndex];

        // Cập nhật thông tin sản phẩm
        const updatedProduct = {
          ...productToUpdate, // Giữ nguyên các trường hiện tại
          name: name || productToUpdate.name,
          description: description || productToUpdate.description,
          amount: amount || productToUpdate.amount,
          priceImport: priceImport || productToUpdate.priceImport,
          priceExport: priceExport || productToUpdate.priceExport,
          image: image || productToUpdate.image, // Giữ nguyên ảnh cũ nếu không có ảnh mới
        };

        // Cập nhật sản phẩm trong danh sách
        shop.products[productIndex] = updatedProduct;

        // Cập nhật toàn bộ shop với danh sách products mới
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              products: shop.products,
            },
          }
        );

        return ctx.send({
          success: true,
          message: "Product updated successfully",
          data: updatedShop,
        });
      } catch (error) {
        console.error("Error updating product in shop:", error);
        return ctx.internalServerError("Unable to update product in shop");
      }
    },
    async getProductIdInShop(ctx) {
      try {
        const { shopId, productId } = ctx.params; // Lấy shopId và productId từ params URL

        if (!shopId || !productId) {
          return ctx.badRequest("Shop ID and Product ID are required");
        }

        // Tìm shop dựa trên shopId và populate sản phẩm
        const shop: Shop & { products: Product[] } =
          await strapi.entityService.findOne("api::shop.shop", shopId, {
            populate: ["products", "products.image"], // Populate cả sản phẩm và ảnh
          });

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Tìm sản phẩm trong danh sách sản phẩm của shop
        const product = shop.products.find(
          (prod) => prod.id === parseInt(productId, 10)
        );

        if (!product) {
          return ctx.notFound("Product not found in shop");
        }

        // Trả về thông tin sản phẩm
        return ctx.send({
          success: true,
          data: product,
        });
      } catch (error) {
        console.error("Error fetching product in shop:", error);
        return ctx.internalServerError("Unable to fetch product in shop");
      }
    },

    async importProduct(ctx) {
      try {
        const { shopId, productId } = ctx.params;
        const { amountToAdd, userActionId } = ctx.request.body;

        if (!amountToAdd || amountToAdd <= 0) {
          return ctx.badRequest("Amount to add must be greater than 0");
        }

        // Lấy shop và populate products
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["products", "historyImportAndExport"],
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Tìm sản phẩm cần nhập hàng
        const productIndex = shop.products.findIndex(
          (product) => product.id === parseInt(productId, 10)
        );

        if (productIndex === -1) {
          return ctx.notFound("Product not found");
        }

        // Cập nhật amount
        shop.products[productIndex].amount += amountToAdd;

        // Ghi vào lịch sử nhập/xuất
        const newHistoryEntry = {
          idProduct: productId,
          amount: amountToAdd,
          type: "IMPORT" as const, // Loại nhập
          date: new Date(),
          userActionId,
        };

        const updatedHistory = shop.historyImportAndExport
          ? [...shop.historyImportAndExport, newHistoryEntry]
          : [newHistoryEntry];

        // Lưu thay đổi
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              products: shop.products,
              historyImportAndExport: updatedHistory,
            },
          }
        );

        return ctx.send({
          success: true,
          message: "Product imported successfully",
          data: updatedShop,
        });
      } catch (error) {
        console.error("Error importing product:", error);
        return ctx.internalServerError("Unable to import product");
      }
    },
    async exportProduct(ctx) {
      try {
        const { shopId, productId } = ctx.params;
        const { amountToSubtract, userActionId } = ctx.request.body;

        if (!amountToSubtract || amountToSubtract <= 0) {
          return ctx.badRequest("Amount to subtract must be greater than 0");
        }

        // Lấy shop và populate products
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["products", "historyImportAndExport"],
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Tìm sản phẩm cần xuất hàng
        const productIndex = shop.products.findIndex(
          (product) => product.id === parseInt(productId, 10)
        );

        if (productIndex === -1) {
          return ctx.notFound("Product not found");
        }

        if (shop.products[productIndex].amount < amountToSubtract) {
          return ctx.badRequest("Not enough stock to export");
        }

        // Cập nhật amount
        shop.products[productIndex].amount -= amountToSubtract;

        // Ghi vào lịch sử nhập/xuất
        const newHistoryEntry = {
          idProduct: productId,
          amount: amountToSubtract,
          type: "EXPORT" as const, // Loại xuất
          date: new Date(),
          userActionId,
        };

        const updatedHistory = shop.historyImportAndExport
          ? [...shop.historyImportAndExport, newHistoryEntry]
          : [newHistoryEntry];

        // Lưu thay đổi
        const updatedShop = await strapi.entityService.update(
          "api::shop.shop",
          shopId,
          {
            data: {
              products: shop.products,
              historyImportAndExport: updatedHistory,
            },
          }
        );

        return ctx.send({
          success: true,
          message: "Product exported successfully",
          data: updatedShop,
        });
      } catch (error) {
        console.error("Error exporting product:", error);
        return ctx.internalServerError("Unable to export product");
      }
    },
    async getHistoryImportAndExportShopByMonth(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy shopId từ URL params
        const { month, year } = ctx.query; // Lấy tháng và năm từ query params

        // Kiểm tra thông tin bắt buộc
        if (!shopId || !month || !year) {
          return ctx.badRequest("Shop ID, month, and year are required");
        }

        // Lấy thông tin shop và populate lịch sử nhập/xuất
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["historyImportAndExport", "products"], // Populate lịch sử nhập/xuất và products
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found");
        }

        // Lọc lịch sử theo tháng và năm
        const filteredHistory = shop.historyImportAndExport.filter(
          (history) => {
            const historyDate = new Date(history.date);
            return (
              historyDate.getMonth() + 1 === parseInt(month, 10) &&
              historyDate.getFullYear() === parseInt(year, 10)
            );
          }
        );

        // Lấy thông tin người dùng từ plugin User Permissions
        const userIds = [
          ...new Set(filteredHistory.map((item) => item.userActionId)),
        ]; // Lấy danh sách ID người dùng duy nhất
        const users = await strapi.plugins[
          "users-permissions"
        ].services.user.fetchAll({
          id_in: userIds, // Tìm user theo danh sách ID
        });

        // Lấy danh sách ID sản phẩm và thông tin sản phẩm từ shop
        const productIds = [
          ...new Set(filteredHistory.map((item) => item.idProduct)),
        ]; // Lấy danh sách ID sản phẩm duy nhất
        const products = shop.products.filter((product) =>
          productIds.includes(Number(product.id))
        );

        // Bổ sung thông tin chi tiết vào lịch sử
        const historyWithDetails = filteredHistory.map((item) => {
          const user = users.find((u) => u.id === item.userActionId) || null; // Tìm thông tin user
          const product = products.find((p) => p.id === item.idProduct) || null; // Tìm thông tin sản phẩm

          return {
            ...item,
            user: user
              ? {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  name: user.name,
                }
              : null,
            product: product
              ? {
                  id: product.id,
                  name: product.name,
                  description: product.description,
                }
              : null,
          };
        });

        return ctx.send({
          success: true,
          data: historyWithDetails,
        });
      } catch (error) {
        console.error("Error fetching history with details:", error);
        return ctx.internalServerError("Unable to fetch history with details");
      }
    },
    async getProfitAndLoss(ctx) {
      try {
        const { shopId } = ctx.params; // Lấy shopId từ params
        const { month, year } = ctx.query; // Lấy tháng/năm từ query params

        if (!shopId || !month || !year) {
          return ctx.badRequest("Shop ID, month, and year are required.");
        }

        // Lấy shop và populate lịch sử nhập/xuất
        const shop = await strapi.entityService.findOne(
          "api::shop.shop",
          shopId,
          {
            populate: ["historyImportAndExport", "products"],
          }
        );

        if (!shop) {
          return ctx.notFound("Shop not found.");
        }

        // Lọc lịch sử nhập/xuất theo tháng và năm
        const filteredHistory = shop.historyImportAndExport.filter((record) => {
          const recordDate = new Date(record.date);
          return (
            recordDate.getMonth() + 1 === parseInt(month) &&
            recordDate.getFullYear() === parseInt(year)
          );
        });

        // Tính tổng giá trị nhập và xuất
        let totalImport = 0;
        let totalExport = 0;

        for (const record of filteredHistory) {
          const product = shop.products.find((p) => p.id === record.idProduct);

          if (product) {
            if (record.type === "IMPORT") {
              totalImport += record.amount * product.priceImport;
            } else if (record.type === "EXPORT") {
              totalExport += record.amount * product.priceExport;
            }
          }
        }

        // Tính lãi/lỗ
        const profit = totalExport - totalImport;

        return ctx.send({
          success: true,
          data: {
            totalImport,
            totalExport,
            profit,
          },
        });
      } catch (error) {
        console.error("Error calculating profit and loss:", error);
        return ctx.internalServerError("Unable to calculate profit and loss.");
      }
    },
  })
);
