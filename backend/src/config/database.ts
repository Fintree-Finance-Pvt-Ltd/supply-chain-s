// import { DataSource } from 'typeorm';
// import * as dotenv from 'dotenv';

// dotenv.config();

// export const AppDataSource = new DataSource({
//   type: 'mysql',
//   host: process.env.DB_HOST || 'localhost',
//   port: parseInt(process.env.DB_PORT || '3306'),
//   username: process.env.DB_USERNAME || 'root',
//   password: process.env.DB_PASSWORD || '',
//   database: process.env.DB_DATABASE || 'supplychainnew',
//   synchronize: process.env.NODE_ENV === 'development', // Auto-sync in dev only
//   logging: process.env.NODE_ENV === 'development',
//   entities: ['src/entities/**/*.ts'],
//   migrations: ['src/migrations/**/*.ts'],
//   subscribers: ['src/subscribers/**/*.ts'],
// });



import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'supplychainnew',
  synchronize: !isProd,
  logging: !isProd,

  entities: [
    isProd
      ? path.join(__dirname, '../entities/**/*.js')
      : path.join(__dirname, '../entities/**/*.ts')
  ],

  migrations: [
    isProd
      ? path.join(__dirname, '../migrations/**/*.js')
      : path.join(__dirname, '../migrations/**/*.ts')
  ],

  subscribers: [
    isProd
      ? path.join(__dirname, '../subscribers/**/*.js')
      : path.join(__dirname, '../subscribers/**/*.ts')
  ],
});
