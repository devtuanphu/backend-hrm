export default {
  routes: [
    {
      method: "PUT",
      path: "/shops/:id/add-check-in",
      handler: "custom-shop.addCheckIn",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/shops/validate-qr",
      handler: "custom-shop.validateQr",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/shops/:id/checkins",
      handler: "custom-shop.getCheckInsByDate",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/shops/:shopId/add-shift-daily",
      handler: "custom-shop.addShiftDaily",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/shops/:shopId/shift-daily",
      handler: "custom-shop.getShiftDaily",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/shops/:shopId/config-shift-cycle",
      handler: "custom-shop.getConfigShiftCycle",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PATCH",
      path: "/shops/:shopId/config-shift-cycle",
      handler: "custom-shop.updateConfigShiftCycle",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/shops/get-shifts/:shopId/:date",
      handler: "custom-shop.getShiftShopByDate",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/shops/register-shift",
      handler: "custom-shop.registerShiftByDate",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/shops/update-status-employee-shift",
      handler: "custom-shop.updateStatusEmployeeShift",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/shops/auto-assign-shifts",
      handler: "custom-shop.autoAssignShift",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/shop/wage/:userId",
      handler: "custom-shop.getUserWageByMonth",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "POST",
      path: "/shops/senNotificationToEmployee/:shopId",
      handler: "custom-shop.sendNotificationReminderToEmployee",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/shops/top-tasks",
      handler: "custom-shop.getListTopTask",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "PUT",
      path: "/shops/reward-employee",
      handler: "custom-shop.addReward",
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: "GET",
      path: "/shops/:userId/rewards-history",
      handler: "custom-shop.historyRewardByUserMonth",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
