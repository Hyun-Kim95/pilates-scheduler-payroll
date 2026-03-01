/**
 * Vercel Serverless: 모든 /api/* 요청을 Express 앱으로 전달
 */
import 'dotenv/config';
import app from '../backend/app.js';

export default function handler(req, res) {
  app(req, res);
}
