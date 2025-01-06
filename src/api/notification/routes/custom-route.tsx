module.exports = {
  routes: [
    {
      method: "GET",
      path: "/notifications/get-notification-by-user/:userId",
      handler: "custom-notification.getUserNotifications",
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
