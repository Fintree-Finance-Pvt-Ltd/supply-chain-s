import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Always use .js files since we're running compiled code
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'supplychainnew',
  synchronize: false, // Set to false to use migrations exclusively
  logging: process.env.NODE_ENV !== 'production',

  entities: [
    path.join(__dirname, '../entities/**/*.js')
  ],

  migrations: [
    path.join(__dirname, '../migrations/**/*.js')
  ],

  subscribers: [
    path.join(__dirname, '../subscribers/**/*.js')
  ],
});
