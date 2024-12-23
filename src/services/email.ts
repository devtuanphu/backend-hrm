import nodemailer from "nodemailer";

export const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: process.env.MAIL_SERVICE, // Tên dịch vụ email (ví dụ: 'gmail')
    auth: {
      user: process.env.MAIL_USER, // Email đăng nhập
      pass: process.env.MAIL_PASSWORD, // App Password
    },
  });

  await transporter.sendMail({
    from: `"HRM" <${process.env.MAIL_USER}>`, // Email gửi
    to,
    subject,
    html, // Nội dung email là HTML
  });
};
