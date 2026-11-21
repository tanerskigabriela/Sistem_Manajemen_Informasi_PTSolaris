import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { ERROR_CODE } from './constants';
import { swaggerDocument } from './docs/swagger';
import { errorHandler } from './middlewares/error-handler';
import apiRouter from './routes';
import { AppError } from './utils/errors';

const app = express();

// Middleware keamanan dan parser
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Dokumentasi Swagger UI
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Seluruh endpoint API menggunakan prefix /api/v1
app.use('/api/v1', apiRouter);

// Fallback untuk route yang tidak terdaftar (sesuai FSD Bagian 8.3 & 8.4)
app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(404, ERROR_CODE.SYS_INTERNAL, 'Data tidak ditemukan.'));
});

// Global error handler (harus selalu paling akhir)
app.use(errorHandler);

export default app;
