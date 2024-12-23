export default () => ({
  "users-permissions": {
    config: {
      register: {
        allowedFields: ["name", "shop", "position", "verificationCode", "type"], // Chỉ các trường này được chấp nhận
      },
    },
  },
});
