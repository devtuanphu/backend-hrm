export default {
  checkShiftsCron: {
    task: async ({ strapi }) => {
      try {
        // Lấy danh sách các shop có configShift và shiftDaily
        const shops = await strapi.entityService.findMany("api::shop.shop", {
          filters: {
            configShift: { $notNull: true },
            shiftDaily: { $notNull: true },
          },
          populate: {
            configShift: true,
            shiftDaily: { populate: { skills: true } },
          }, // Populate skills
        });

        const today = new Date();
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000); // Ngày mai tính từ 00:00

        for (const shop of shops) {
          const { repeatCycle } = shop.configShift || {};
          if (!repeatCycle || !shop.shiftDaily.length) continue; // Bỏ qua nếu không có chu kỳ hoặc không có ca làm cố định

          // Tìm các ca làm việc đã tồn tại
          const existingShifts = await strapi.entityService.findMany(
            "api::shift.shift",
            {
              filters: { shop: { id: shop.id }, date: { $gte: tomorrow } },
              sort: { date: "asc" },
            }
          );

          let newShifts = [];
          let lastShiftDate = new Date(today); // Ngày cuối của ca làm hiện tại

          if (existingShifts.length > 0) {
            lastShiftDate = new Date(
              existingShifts[existingShifts.length - 1].date
            );
          }

          const twoDaysBeforeLastShift = new Date(lastShiftDate);
          twoDaysBeforeLastShift.setDate(lastShiftDate.getDate() - 2); // 2 ngày trước ngày cuối cùng

          if (today < twoDaysBeforeLastShift) continue; // Nếu chưa đến thời điểm tạo mới, bỏ qua

          const cycleLength = repeatCycle === "weekly" ? 7 : 30; // Chu kỳ 7 ngày (tuần) hoặc 30 ngày (tháng)
          const formattedTomorrow = tomorrow.toISOString().split("T")[0]; // Ngày mai định dạng chuẩn YYYY-MM-DD

          for (let i = 0; i < cycleLength; i++) {
            const shiftDate = new Date(lastShiftDate);
            shiftDate.setDate(lastShiftDate.getDate() + 1 + i);

            const formattedDate = shiftDate.toISOString().split("T")[0];

            for (const dailyShift of shop.shiftDaily) {
              newShifts.push({
                shop: shop.id,
                name: dailyShift.name,
                startTime: dailyShift.startTime,
                endTime: dailyShift.endTime,
                skills: dailyShift.skills?.map((skill) => skill.id) || [], // Populate đầy đủ kỹ năng hoặc để mảng trống nếu không có
                maxEmployees: dailyShift.maxEmployees,
                date: formattedDate,
                publishedAt: new Date(),
              });
            }
          }

          // Tạo bản ghi nếu chưa tồn tại ca làm việc trong chu kỳ mới
          for (const shift of newShifts) {
            const existingShift = existingShifts.find(
              (s) =>
                new Date(s.date).toISOString().split("T")[0] === shift.date &&
                s.name === shift.name
            );
            if (!existingShift) {
              await strapi.entityService.create("api::shift.shift", {
                data: shift,
              });
            }
          }

          strapi.log.info(
            `Tạo thành công ${newShifts.length} ca làm mới cho shop ${shop.id}`
          );
        }
      } catch (error) {
        strapi.log.error("Lỗi khi chạy cron job kiểm tra shifts:", error);
      }
    },
    options: {
      rule: "* * * * *", // Chạy mỗi phút kiểm tra một lần
      tz: "Asia/Ho_Chi_Minh",
    },
  },
};
