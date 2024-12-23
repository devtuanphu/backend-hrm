export const emailTemplate = (username: any, verificationCode: any) => `
  <!DOCTYPE html>
  <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          width: 100%;
          max-width: 600px;
          margin: 20px auto;
          background-color: #fff;
          border-radius: 8px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          overflow: hidden;
        }
        .header {
          background-color: #1E90FF;
          color: #fff;
          text-align: center;
          padding: 20px;
          font-size: 24px;
        }
        .content {
          padding: 20px;
          text-align: center;
        }
        .content p {
          font-size: 16px;
          margin: 10px 0;
        }
        .code {
          display: inline-block;
          margin: 20px 0;
          padding: 10px 20px;
          font-size: 24px;
          font-weight: bold;
          background-color: #f4f4f4;
          border: 1px solid #ddd;
          border-radius: 5px;
        }
        .footer {
          background-color: #f4f4f4;
          text-align: center;
          padding: 10px;
          font-size: 12px;
          color: #777;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
         HRM - Xác thực tài khoản
        </div>
        <div class="content">
          <p>Xin chào <b>${username}</b>,</p>
          <p>Bạn vừa đăng ký tài khoản HRM. Mã xác thực tài khoản của bạn là:</p>
          <div class="code">${verificationCode}</div>
          <p>Vui lòng nhập mã này để hoàn tất việc xác thực tài khoản.</p>
        </div>
        <div class="footer">
          Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.<br/>
          iPOS HRM Team
        </div>
      </div>
    </body>
  </html>
`;
