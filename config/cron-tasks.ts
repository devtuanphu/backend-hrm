import customNotificationService from "../src/api/notification/services/customNotification";
import {
  parseISO,
  isWithinInterval,
  subMinutes,
  addMinutes,
  formatISO,
  format,
} from "date-fns";
async function createShifts(strapi, shop, startDate, cycleLength) {
  for (let i = 0; i < cycleLength; i++) {
    const shiftDate = new Date(startDate);
    shiftDate.setDate(startDate.getDate() + i);

    const formattedDate = shiftDate.toISOString().split("T")[0];

    for (const dailyShift of shop.shiftDaily) {
      await strapi.entityService.create("api::shift.shift", {
        data: {
          shop: shop.id,
          name: dailyShift.name,
          startTime: dailyShift.startTime,
          endTime: dailyShift.endTime,
          skills: dailyShift.skills?.map((skill) => skill.id) || [],
          maxEmployees: dailyShift.maxEmployees,
          date: formattedDate,
          publishedAt: new Date(),
        },
      });
    }
  }
  strapi.log.info(`Tạo thành công ca làm mới cho shop ${shop.id}`);
}

export default {
  // checkShiftsCron: {
  //   task: async ({ strapi }) => {
  //     try {
  //       // Lấy danh sách các shop có configShift và shiftDaily
  //       const shops = await strapi.entityService.findMany("api::shop.shop", {
  //         filters: {
  //           configShift: { $notNull: true },
  //           shiftDaily: { $notNull: true },
  //         },
  //         populate: {
  //           configShift: true,
  //           shiftDaily: { populate: { skills: true } },
  //         }, // Populate skills
  //       });

  //       const today = new Date();
  //       today.setHours(0, 0, 0, 0);

  //       const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Ngày mai tính từ 00:00

  //       for (const shop of shops) {
  //         const { repeatCycle } = shop.configShift || {};
  //         if (!repeatCycle || !shop.shiftDaily.length) continue; // Bỏ qua nếu không có chu kỳ hoặc không có ca làm cố định

  //         // Tìm các ca làm việc đã tồn tại
  //         const existingShifts = await strapi.entityService.findMany(
  //           "api::shift.shift",
  //           {
  //             filters: { shop: { id: shop.id }, date: { $gte: today } },
  //             sort: { date: "asc" },
  //           }
  //         );

  //         let newShifts = [];
  //         let lastShiftDate = new Date(today); // Ngày cuối của ca làm hiện tại

  //         if (existingShifts.length > 0) {
  //           lastShiftDate = new Date(
  //             existingShifts[existingShifts.length - 1].date
  //           );
  //         }

  //         const twoDaysBeforeLastShift = new Date(lastShiftDate);
  //         twoDaysBeforeLastShift.setDate(lastShiftDate.getDate() - 2); // 2 ngày trước ngày cuối cùng

  //         if (today < twoDaysBeforeLastShift) continue; // Nếu chưa đến thời điểm tạo mới, bỏ qua

  //         const cycleLength = repeatCycle === "weekly" ? 7 : 30; // Chu kỳ 7 ngày (tuần) hoặc 30 ngày (tháng)
  //         const formattedTomorrow = tomorrow.toISOString().split("T")[0]; // Ngày mai định dạng chuẩn YYYY-MM-DD

  //         for (let i = 0; i < cycleLength; i++) {
  //           const shiftDate = new Date(lastShiftDate);
  //           shiftDate.setDate(lastShiftDate.getDate() + 1 + i);

  //           const formattedDate = shiftDate.toISOString().split("T")[0];

  //           for (const dailyShift of shop.shiftDaily) {
  //             newShifts.push({
  //               shop: shop.id,
  //               name: dailyShift.name,
  //               startTime: dailyShift.startTime,
  //               endTime: dailyShift.endTime,
  //               skills: dailyShift.skills?.map((skill) => skill.id) || [], // Populate đầy đủ kỹ năng hoặc để mảng trống nếu không có
  //               maxEmployees: dailyShift.maxEmployees,
  //               date: formattedDate,
  //               publishedAt: new Date(),
  //             });
  //           }
  //         }

  //         // Tạo bản ghi nếu chưa tồn tại ca làm việc trong chu kỳ mới
  //         for (const shift of newShifts) {
  //           const existingShift = existingShifts.find(
  //             (s) =>
  //               new Date(s.date).toISOString().split("T")[0] === shift.date &&
  //               s.name === shift.name
  //           );
  //           if (!existingShift) {
  //             await strapi.entityService.create("api::shift.shift", {
  //               data: shift,
  //             });
  //           }
  //         }

  //         strapi.log.info(
  //           `Tạo thành công ${newShifts.length} ca làm mới cho shop ${shop.id}`
  //         );
  //       }
  //     } catch (error) {
  //       strapi.log.error("Lỗi khi chạy cron job kiểm tra shifts:", error);
  //     }
  //   },
  //   options: {
  //     rule: "* * * * *",
  //     tz: "Asia/Ho_Chi_Minh",
  //   },
  // },

  checkShiftsCron: {
    task: async ({ strapi }) => {
      try {
        const shops = await strapi.entityService.findMany("api::shop.shop", {
          filters: {
            configShift: { $notNull: true },
            shiftDaily: { $notNull: true },
          },
          populate: {
            configShift: true,
            shiftDaily: { populate: { skills: true } },
          },
        });

        const today = new Date();
        today.setHours(0, 0, 0, 0); // Đặt giờ của ngày hôm nay về 00:00

        for (const shop of shops) {
          const { repeatCycle } = shop.configShift || {};
          if (!repeatCycle || !shop.shiftDaily.length) continue;

          const existingShifts = await strapi.entityService.findMany(
            "api::shift.shift",
            {
              filters: { shop: { id: shop.id }, date: { $gte: today } },
              sort: { date: "asc" },
            }
          );

          let lastShiftDate =
            existingShifts.length > 0
              ? new Date(existingShifts[existingShifts.length - 1].date)
              : null;

          const cycleLength = repeatCycle === "weekly" ? 7 : 30; // Chu kỳ lặp lại

          // Nếu chưa có ca làm nào, tạo ngay lập tức
          if (!lastShiftDate) {
            lastShiftDate = new Date(today);
            createShifts(strapi, shop, lastShiftDate, cycleLength);
          } else {
            // Kiểm tra khi sắp hết chu kỳ
            const daysUntilLastShift = Math.floor(
              (lastShiftDate.getTime() - today.getTime()) /
                (1000 * 60 * 60 * 24)
            );
            if (daysUntilLastShift <= 2) {
              // Nếu còn 2 ngày hoặc ít hơn
              lastShiftDate.setDate(lastShiftDate.getDate() + 1);
              createShifts(strapi, shop, lastShiftDate, cycleLength);
            }
          }
        }
      } catch (error) {
        strapi.log.error("Lỗi khi chạy cron job kiểm tra shifts:", error);
      }
    },
    options: {
      rule: "* * * * *",
      tz: "Asia/Ho_Chi_Minh",
    },
  },

  checkRemindEmployeesCron: {
    task: async ({ strapi }) => {
      const now = new Date();
      const fifteenMinutesBefore = subMinutes(now, 15);

      // Lấy các shifts từ Strapi
      const shifts = await strapi.entityService.findMany("api::shift.shift", {
        filters: {
          date: { $eq: format(now, "yyyy-MM-dd") }, // Lọc shifts dựa trên ngày hiện tại
        },
        populate: { employeeStatuses: { populate: { user: true } } },
      });

      for (const shift of shifts) {
        // Tạo một đối tượng Date từ trường date và startTime
        const shiftStartTime = parseISO(`${shift.date}T${shift.startTime}`);
        if (
          isWithinInterval(fifteenMinutesBefore, {
            start: subMinutes(shiftStartTime, 15),
            end: shiftStartTime,
          })
        ) {
          // Lấy ID người dùng từ employeeStatuses để gửi thông báo, chỉ lấy những người dùng có trạng thái là 'Approved'
          const userIds = shift.employeeStatuses
            .filter((status) => status.status === "Approved") // Thêm bộ lọc trạng thái 'Approved'
            .map((status) => status.user && status.user.id)
            .filter((id) => id);

          if (userIds.length > 0) {
            const users = await strapi.entityService.findMany(
              "plugin::users-permissions.user",
              {
                filters: {
                  id: { $in: userIds },
                  isNotication: true, // Chỉ lấy những user có `isNotication = true`
                },
                fields: ["id"], // Chỉ lấy trường `id`
              }
            );

            const userIdsToNotify = users.map((user) => user.id);
            // Gửi thông báo
            await customNotificationService.sendNotification(
              userIdsToNotify,
              "Nhắc nhở ca làm việc",
              "Bạn có ca làm việc sắp bắt đầu trong 15 phút nữa.",
              { shiftId: shift.id }
            );
          }
        }
      }
    },
    options: {
      rule: "* * * * *", // Chạy mỗi phút
      tz: "Asia/Ho_Chi_Minh",
    },
  },
  checkStaffShortagesCron: {
    task: async ({ strapi }) => {
      const today = format(new Date(), "yyyy-MM-dd");

      // Lấy các shifts trong ngày hiện tại
      const shifts = await strapi.entityService.findMany("api::shift.shift", {
        filters: { date: { $eq: today } },
        populate: {
          shop: { populate: { owner: true } },
          employeeStatuses: true,
        },
      });

      for (const shift of shifts) {
        // Đếm số nhân viên được phê duyệt
        const approvedEmployeesCount = shift.employeeStatuses.filter(
          (status) => status.status === "Approved"
        ).length;

        // Kiểm tra xem có đủ nhân viên không
        if (approvedEmployeesCount < shift.maxEmployees) {
          // Lấy thông tin chủ shop
          const shopOwner = shift.shop.owner;

          if (shopOwner) {
            // Gửi thông báo cho chủ shop
            await customNotificationService.sendNotification(
              [shopOwner.id],
              "Thiếu Nhân Viên Cho Ca Làm Việc",
              `Ca làm ${shift.name} ngày ${shift.date} đang thiếu nhân viên. Chỉ có ${approvedEmployeesCount}/${shift.maxEmployees} nhân viên được phê duyệt.`,
              { shiftId: shift.id }
            );
          }
        }
      }
    },
    options: {
      rule: "0 * * * *", // Chạy mỗi giờ một lần
      tz: "Asia/Ho_Chi_Minh",
    },
  },
  // createDailyReports: {
  //   task: async ({ strapi }) => {
  //     try {
  //       const today = new Date();
  //       today.setHours(0, 0, 0, 0); // Đặt thời gian về đầu ngày (00:00:00)
  //       const localDateString = today.toLocaleDateString("en-CA"); // YYYY-MM-DD

  //       // Lấy tất cả shifts trong ngày hôm nay
  //       const shifts = await strapi.entityService.findMany("api::shift.shift", {
  //         filters: { date: localDateString },
  //         populate: {
  //           shop: true,
  //           employeeStatuses: {
  //             populate: { user: { populate: "position" } },
  //           },
  //         },
  //       });

  //       const shopReports = new Map(); // Map để kiểm tra các shop đã tạo báo cáo trong ngày

  //       for (const shift of shifts) {
  //         const shopId = shift.shop.id;

  //         // Kiểm tra nếu shop đã có báo cáo trong `shopReports`
  //         if (!shopReports.has(shopId)) {
  //           // Kiểm tra báo cáo trong ngày hôm nay đã tồn tại chưa
  //           const shopData = await strapi.entityService.findOne(
  //             "api::shop.shop",
  //             shopId,
  //             {
  //               populate: {
  //                 reportCheckInDay: true,
  //               },
  //             }
  //           );

  //           const existingReport = shopData.reportCheckInDay?.find(
  //             (report) =>
  //               new Date(report.date).toLocaleDateString("en-CA") ===
  //               localDateString
  //           );

  //           if (existingReport) {
  //             shopReports.set(shopId, true); // Đánh dấu shop đã có report hôm nay
  //             continue;
  //           }

  //           // Tạo `detail` từ tất cả `shifts` của shop trong ngày
  //           const shiftsOfShop = shifts.filter((s) => s.shop.id === shopId);
  //           const details = shiftsOfShop.flatMap((s) =>
  //             s.employeeStatuses
  //               .filter((es) => es.status === "Approved")
  //               .map((es) => ({
  //                 userId: es.user?.id,
  //                 nameStaff: es.user?.name || "Chưa rõ tên",
  //                 position: es.user?.position?.name || "Chưa có vị trí",
  //                 checkIn: null,
  //                 checkOut: null,
  //                 work: "",
  //               }))
  //           );

  //           // Tạo report mới
  //           await strapi.entityService.update("api::shop.shop", shopId, {
  //             data: {
  //               reportCheckInDay: [
  //                 ...(shopData.reportCheckInDay || []),
  //                 {
  //                   date: localDateString,
  //                   detail: details,
  //                 },
  //               ],
  //             },
  //           });

  //           strapi.log.info(`Tạo báo cáo thành công cho shop ID: ${shopId}`);
  //         }
  //       }
  //     } catch (error) {
  //       strapi.log.error(`Lỗi khi tạo báo cáo: ${error.message}`);
  //     }
  //   },
  //   options: {
  //     rule: "* * * * *", // Chạy mỗi ngày lúc 00:00
  //     tz: "Asia/Ho_Chi_Minh",
  //   },
  // },
  createDailyReports: {
    task: async ({ strapi }) => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set the time to the start of the day (00:00:00)
        const localDateString = today.toLocaleDateString("en-CA"); // YYYY-MM-DD

        // Fetch all shifts for today
        const shifts = await strapi.entityService.findMany("api::shift.shift", {
          filters: { date: localDateString },
          populate: {
            shop: true,
            employeeStatuses: {
              populate: { user: { populate: "position" } },
            },
          },
        });

        for (const shift of shifts) {
          const shopId = shift.shop.id;

          // Fetch the shop data including existing reports
          const shopData = await strapi.entityService.findOne(
            "api::shop.shop",
            shopId,
            {
              populate: {
                reportCheckInDay: {
                  populate: {
                    detail: true,
                  },
                },
              },
            }
          );

          // Find if a report for today already exists
          let existingReport = shopData.reportCheckInDay?.find(
            (report) =>
              new Date(report.date).toLocaleDateString("en-CA") ===
              localDateString
          );

          // Collect new details from today's shifts
          const newDetails = shift.employeeStatuses
            .filter((es) => es.status === "Approved")
            .map((es) => ({
              userId: es.user?.id,
              nameStaff: es.user?.name || "Unknown",
              position: es.user?.position?.name || "No position",
              checkIn: null,
              checkOut: null,
              work: "",
            }));

          if (existingReport) {
            // If a report exists, update it with new details
            existingReport.detail = existingReport.detail || [];
            const updatedDetails = existingReport.detail.concat(
              newDetails.filter(
                (nd) =>
                  !existingReport.detail.some((ed) => ed.userId === nd.userId)
              )
            );
            await strapi.entityService.update("api::shop.shop", shopId, {
              data: {
                reportCheckInDay: [
                  ...shopData.reportCheckInDay.filter(
                    (rep) => rep.id !== existingReport.id
                  ),
                  {
                    ...existingReport,
                    detail: updatedDetails,
                  },
                ],
              },
            });
            strapi.log.info(
              `Updated report with new details for shop ID: ${shopId}`
            );
          } else {
            // If no report exists, create a new one with today's details
            await strapi.entityService.update("api::shop.shop", shopId, {
              data: {
                reportCheckInDay: [
                  ...(shopData.reportCheckInDay || []),
                  {
                    date: localDateString,
                    detail: newDetails,
                  },
                ],
              },
            });
            strapi.log.info(`Created new report for shop ID: ${shopId}`);
          }
        }
      } catch (error) {
        strapi.log.error(`Error when creating reports: ${error.message}`);
      }
    },
    options: {
      rule: "* * * * *", // Run every day at 00:00
      tz: "Asia/Ho_Chi_Minh",
    },
  },
};
