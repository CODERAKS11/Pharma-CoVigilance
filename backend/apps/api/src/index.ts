import dotenv from 'dotenv';
import path from 'path';
import app from './app';
import { logger } from './config/logger';
import { initQueue } from './services/queue';
import { initQdrant } from './services/dedup';
import { initSnomed } from './services/snomed';

// Load environment configurations from backend root
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const PORT = process.env.PORT || 4000;

async function startServer() {
  await initQdrant();
  await initSnomed();
  await initQueue();

  app.listen(PORT, () => {
    logger.info(`PharmaSafe Backend API service running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });
}

startServer();
