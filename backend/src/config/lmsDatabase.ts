import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

/**
 * LMS Database Configuration
 * Separate connection to fetch customer data from LMS system
 */
export const LMSDataSource = new DataSource({
  type: 'mysql',
  host: process.env.LMS_DB_HOST || 'localhost',
  port: parseInt(process.env.LMS_DB_PORT || '3306'),
  username: process.env.LMS_DB_USERNAME || 'root',
  password: process.env.LMS_DB_PASSWORD || '',
  database: process.env.LMS_DB_DATABASE || 'lms',
  name: 'lms',
});

// Initialize LMS database connection
export const initializeLMSDatabase = async (): Promise<void> => {
  try {
    if (!LMSDataSource.isInitialized) {
      await LMSDataSource.initialize();
      console.log('✅ LMS Database connected successfully');
    }
  } catch (error) {
    console.error('❌ Failed to connect to LMS Database:', error);
    throw error;
  }
};
