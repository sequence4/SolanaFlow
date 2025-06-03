import fs from 'fs';
import path from 'path';
import { AppError } from '../middleware/errorHandler';
import dotenvFlow from 'dotenv-flow';
dotenvFlow.config({ purge_dotenv: true });

const checkRootFolder = (folderPath: string) => {
  if (!fs.existsSync(folderPath)) {
    throw new AppError(`ROOT_FOLDER does not exist: ${folderPath}`, 500);
  }

  try {
    fs.accessSync(folderPath, fs.constants.W_OK);
  } catch (err) {
    throw new AppError(`ROOT_FOLDER is not writable: ${folderPath}`, 500);
  }
};

const rootFolder = process.env.ROOT_FOLDER
  ? path.resolve(process.env.ROOT_FOLDER)
  : null;

if (!rootFolder) {
  throw new AppError('ROOT_FOLDER environment variable is not set', 500);
}

checkRootFolder(rootFolder);

export const APP_CONFIG = {
  PORT: process.env.PORT || 9999,
  JWT_SECRET: process.env.JWT_SECRET as string,
  ROOT_FOLDER: process.env.ROOT_FOLDER as string,
  WALLETS_FOLDER: process.env.WALLETS_FOLDER as string,
  PASSWORD_SALT_ROUNDS: 10,
  TOKEN_EXPIRATION: '7d',
  MAX_FILE_SIZE: 1024 * 1024 * 5,
  BETA_CODE: process.env.BETA_CODE as string,
};

const requiredEnvVars = [
  'JWT_SECRET',
  'ROOT_FOLDER',
  'DATABASE_URL',
];

requiredEnvVars.forEach((envVar) => {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
});
