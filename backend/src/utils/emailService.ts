// // import nodemailer from "nodemailer";

// // interface SendMailParams {
// //   to: string;
// //   subject: string;
// //   text: string;
// // }

// // const transporter = nodemailer.createTransport({
// //   service: "gmail",
// //   auth: {
// //     user: process.env.SMTP_USER as string,
// //     pass: process.env.SMTP_PASS as string,
// //   },
// // });

// // export const sendMail = async ({
// //   to,
// //   subject,
// //   text,
// // }: SendMailParams): Promise<void> => {
// //   await transporter.sendMail({
// //     from: process.env.MAIL_USER,
// //     to,
// //     subject,
// //     text,
// //   });
// // };

// import nodemailer from "nodemailer";

// interface SendMailParams {
//   to: string;
//   subject: string;
//   text: string;
// }

// const transporter = nodemailer.createTransport({
//   host: "smtp.office365.com",
//   port: 587,
//   secure: false, // IMPORTANT for port 587
//   auth: {
//     user: process.env.SMTP_USERs as string,
//     pass: process.env.SMTP_PASSs as string,
//   },
// });

// export const sendMail = async ({
//   to,
//   subject,
//   text,
// }: SendMailParams): Promise<void> => {
//   await transporter.sendMail({
//     from: process.env.SMTP_USERs,
//     to,
//     subject,
//     text,
//   });
// };






import nodemailer from "nodemailer";

interface SendMailParams {
  to: string;
  subject: string;
  text: string;
}

const transporter = nodemailer.createTransport({
  host: "smtp.office365.com",
  port: 587,
  secure: false, // ✅ false for 587
  requireTLS: true,
  auth: {
    user: process.env.SMTP_USERs as string,
    pass: process.env.SMTP_PASSs as string,
  },
});

export const sendMail = async ({
  to,
  subject,
  text,
}: SendMailParams): Promise<void> => {
  await transporter.sendMail({
    from: process.env.SMTP_USERs,
    to,
    subject,
    text,
  });
};