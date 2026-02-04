import app from './app';
import { AppDataSource } from './config/database';
import * as dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize database connection
AppDataSource.initialize()
  .then(() => {
    console.log('✅ Database connected successfully');

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 API: http://localhost:${PORT}/api`);
    });
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing database connection...');
  await AppDataSource.destroy();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing database connection...');
  await AppDataSource.destroy();
  process.exit(0);
});



