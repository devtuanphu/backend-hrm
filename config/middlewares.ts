export default [
  {
    name: "strapi::body",
    config: {
      jsonLimit: "10mb", // Tăng giới hạn JSON payload
      formLimit: "10mb", // Tăng giới hạn form payload
      textLimit: "10mb", // Tăng giới hạn text payload
    },
  },
  "strapi::logger",
  "strapi::errors",
  "strapi::security",
  "strapi::cors",
  "strapi::poweredBy",
  "strapi::query",
  "strapi::session",
  "strapi::favicon",
  "strapi::public",
];
