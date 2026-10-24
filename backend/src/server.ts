import app from './app.js';
import { config } from './config/env.js';
import { connectDB } from './config/db.js';

async function startServer() {
  try {
    // Initialize Database
    await connectDB();

    app.listen(config.port, () => {
      console.log(`===============================================`);
      console.log(` BrandTrace AI Backend Server Running `);
      console.log(` Port: ${config.port}`);
      console.log(` Environment: ${config.nodeEnv}`);
      console.log(` Health endpoint: http://localhost:${config.port}/api/health`);
      console.log(`===============================================`);
    });
  } catch (err) {
    console.error('Fatal error starting BrandTrace AI backend server:', err);
    process.exit(1);
  }
}

startServer();
