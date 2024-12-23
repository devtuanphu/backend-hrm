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
  ],
};
