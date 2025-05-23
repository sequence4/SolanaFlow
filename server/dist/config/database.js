"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = require("dotenv");
const path_1 = require("path");
(0, dotenv_1.config)();
const envFile = `.env.${process.env.NODE_ENV || 'development'}`;
(0, dotenv_1.config)({ path: (0, path_1.resolve)(process.cwd(), envFile) });
const pool = process.env.DATABASE_URL
    ? new pg_1.Pool({ connectionString: process.env.DATABASE_URL })
    : new pg_1.Pool({
        user: process.env.DB_USER,
        host: process.env.DB_HOST,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT ?? 5432)
    });
exports.default = pool;
