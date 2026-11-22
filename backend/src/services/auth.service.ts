import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  ACTION_TYPE,
  ERROR_CODE,
  ERROR_MESSAGE,
  ROLE,
  SESSION_END_REASON,
  type RoleCode,
} from '../constants';
import {
  authRepository,
  type AuthRepository,
} from '../repositories/auth.repository';
import type { AuthUser } from '../types/express';
import { AppError } from '../utils/errors';
import type { RequestMeta } from '../utils/request-meta';
import { BaseService } from './base.service';

export interface MenuItem {
  code: string;
  label: string;
  path: string;
}

export interface AuthMeResponse {
  id: string;
  full_name: string;
  username: string;
  role_code: RoleCode;
  role_name: string;
  employee_id: string;
  factory_id: string;
  must_change_password: boolean;
  menus: MenuItem[];
  unread_notifications: number;
}

export interface LoginServiceResult {
  token: string;
  ttlSeconds: number;
  user: AuthMeResponse;
}

const DEFAULT_JWT_TTL_SECONDS = 8 * 60 * 60; // 8 jam (KONTRAK v1 Bagian 9)

function getJwtConfig(): { secret: string; ttlSeconds: number } {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AppError(
      500,
      ERROR_CODE.SYS_INTERNAL,
      ERROR_MESSAGE[ERROR_CODE.SYS_INTERNAL],
    );
  }
  const ttlSeconds = Number(
    process.env.JWT_TTL_SECONDS ?? DEFAULT_JWT_TTL_SECONDS,
  );
  return { secret, ttlSeconds };
}

/**
 * Daftar menu sidebar per role sesuai KONTRAK v2 Bagian 15.
 * Menu SMBD (/smbd/*) HANYA dikirim untuk SUPERADMIN.
 */
function buildMenusForRole(roleCode: RoleCode): MenuItem[] {
  const beranda: MenuItem = {
    code: 'SCR-02',
    label: 'Beranda',
    path: '/beranda',
  };

  switch (roleCode) {
    case ROLE.ADMIN:
      return [
        beranda,
        { code: 'SCR-03', label: 'Manajemen Pengguna', path: '/pengguna' },
        { code: 'SCR-23', label: 'Log Aktivitas', path: '/log-aktivitas' },
      ];

    case ROLE.PIMPINAN:
      return [
        beranda,
        { code: 'SCR-14', label: 'Dashboard', path: '/dashboard' },
        { code: 'SCR-08', label: 'Persetujuan', path: '/persetujuan' },
        { code: 'SCR-06', label: 'Daftar Order', path: '/order' },
        { code: 'SCR-04', label: 'Data Buyer', path: '/buyer' },
        { code: 'SCR-09', label: 'Supplier', path: '/supplier' },
        { code: 'SCR-11', label: 'SPK', path: '/spk' },
        { code: 'SCR-12', label: 'Progres Harian', path: '/progres' },
        { code: 'SCR-13', label: 'Hasil QC', path: '/qc' },
        { code: 'SCR-16', label: 'Pengiriman', path: '/pengiriman' },
      ];

    case ROLE.MARKETING:
      return [
        beranda,
        { code: 'SCR-04', label: 'Data Buyer', path: '/buyer' },
        { code: 'SCR-05', label: 'Order Baru', path: '/order/baru' },
        { code: 'SCR-06', label: 'Daftar Order', path: '/order' },
      ];

    case ROLE.PPIC:
      return [
        beranda,
        { code: 'SCR-06', label: 'Daftar Order', path: '/order' },
        { code: 'SCR-09', label: 'Supplier', path: '/supplier' },
        { code: 'SCR-10', label: 'Bahan Baku', path: '/bahan-baku' },
        { code: 'SCR-11', label: 'SPK', path: '/spk' },
        { code: 'SCR-12', label: 'Progres Harian', path: '/progres' },
        { code: 'SCR-13', label: 'Hasil QC', path: '/qc' },
        { code: 'SCR-16', label: 'Pengiriman', path: '/pengiriman' },
      ];

    case ROLE.SPV:
      return [
        beranda,
        { code: 'SCR-11', label: 'SPK', path: '/spk' },
        { code: 'SCR-12', label: 'Progres Harian', path: '/progres' },
      ];

    case ROLE.QC:
      return [
        beranda,
        { code: 'SCR-11', label: 'SPK', path: '/spk' },
        { code: 'SCR-12', label: 'Progres Harian', path: '/progres' },
        { code: 'SCR-13', label: 'Hasil QC', path: '/qc' },
      ];

    case ROLE.SUPERADMIN:
      return [
        beranda,
        { code: 'SMBD-DATA', label: 'Penampil Data', path: '/smbd/data' },
        { code: 'SMBD-SDM', label: 'SDM & Penggajian', path: '/smbd/sdm' },
        { code: 'SMBD-JURNAL', label: 'Jurnal', path: '/smbd/jurnal' },
        {
          code: 'SMBD-MORDER',
          label: 'Master Order',
          path: '/smbd/master-order',
        },
        {
          code: 'SMBD-MPROD',
          label: 'Master Produksi',
          path: '/smbd/master-produksi',
        },
        { code: 'SMBD-GUDANG', label: 'Gudang & Stok', path: '/smbd/gudang' },
        { code: 'SMBD-KEU', label: 'Keuangan', path: '/smbd/keuangan' },
        { code: 'SMBD-ASET', label: 'Aset & Maintenance', path: '/smbd/aset' },
      ];

    default:
      return [beranda];
  }
}

export class AuthService extends BaseService {
  constructor(private readonly repository: AuthRepository = authRepository) {
    super('rsi');
  }

  async login(
    username: string,
    password: string,
    meta: RequestMeta,
  ): Promise<LoginServiceResult> {
    const user = await this.repository.findByUsername(username);

    // 1. Username tidak dikenal -> catat LOGIN_GAGAL (user_id NULL), commit, lalu lempar 401
    if (!user) {
      await this.runInTransaction((tx) =>
        this.repository.recordLoginAttempt(tx, {
          username,
          success: false,
          device: meta.device,
          ip_address: meta.ip_address,
        }),
      );
      throw new AppError(
        401,
        ERROR_CODE.AUTH_INVALID_CREDENTIALS,
        ERROR_MESSAGE[ERROR_CODE.AUTH_INVALID_CREDENTIALS],
      );
    }

    // 2. Akun sudah terkunci -> 423 ERR-AUTH-06
    if (user.is_locked) {
      await this.runInTransaction((tx) =>
        this.recordActivity(tx, {
          user_id: user.id,
          username: user.username,
          action_type: ACTION_TYPE.LOGIN_GAGAL,
          resource_type: 'app.users',
          resource_id: user.id,
          device: meta.device,
          ip_address: meta.ip_address,
        }),
      );
      throw new AppError(
        423,
        ERROR_CODE.AUTH_ACCOUNT_LOCKED,
        ERROR_MESSAGE[ERROR_CODE.AUTH_ACCOUNT_LOCKED],
      );
    }

    // 3. Akun nonaktif -> catat LOGIN_GAGAL, tolak 401 ERR-AUTH-02
    if (!user.is_active) {
      await this.runInTransaction((tx) =>
        this.recordActivity(tx, {
          user_id: user.id,
          username: user.username,
          action_type: ACTION_TYPE.LOGIN_GAGAL,
          resource_type: 'app.users',
          resource_id: user.id,
          device: meta.device,
          ip_address: meta.ip_address,
        }),
      );
      throw new AppError(
        401,
        ERROR_CODE.AUTH_INVALID_CREDENTIALS,
        ERROR_MESSAGE[ERROR_CODE.AUTH_INVALID_CREDENTIALS],
      );
    }

    // 4. Verifikasi bcrypt password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      const attempt = await this.runInTransaction((tx) =>
        this.repository.recordLoginAttempt(tx, {
          username: user.username,
          success: false,
          device: meta.device,
          ip_address: meta.ip_address,
        }),
      );

      if (attempt.is_locked) {
        throw new AppError(
          423,
          ERROR_CODE.AUTH_ACCOUNT_LOCKED,
          ERROR_MESSAGE[ERROR_CODE.AUTH_ACCOUNT_LOCKED],
        );
      }

      throw new AppError(
        401,
        ERROR_CODE.AUTH_INVALID_CREDENTIALS,
        ERROR_MESSAGE[ERROR_CODE.AUTH_INVALID_CREDENTIALS],
      );
    }

    // 5. Login berhasil -> sp_record_login membuat sesi & mencatat LOGIN_BERHASIL
    const successResult = await this.runInTransaction((tx) =>
      this.repository.recordLoginAttempt(tx, {
        username: user.username,
        success: true,
        device: meta.device,
        ip_address: meta.ip_address,
      }),
    );

    if (!successResult.session_id) {
      throw new AppError(
        500,
        ERROR_CODE.SYS_INTERNAL,
        ERROR_MESSAGE[ERROR_CODE.SYS_INTERNAL],
      );
    }

    const { secret, ttlSeconds } = getJwtConfig();
    const token = jwt.sign(
      {
        sub: user.id,
        role: user.role_code,
        sid: successResult.session_id,
      },
      secret,
      { expiresIn: ttlSeconds },
    );

    const me = await this.getMe(user.id);
    return { token, ttlSeconds, user: me };
  }

  async logout(user: AuthUser, meta: RequestMeta): Promise<void> {
    await this.runInTransaction(async (tx) => {
      await this.repository.endSession(
        tx,
        user.session_id,
        SESSION_END_REASON.LOGOUT,
      );
      await this.recordActivity(tx, {
        user_id: user.id,
        username: user.username,
        action_type: ACTION_TYPE.LOGOUT,
        resource_type: 'app.sessions',
        resource_id: user.session_id,
        device: meta.device,
        ip_address: meta.ip_address,
      });
    });
  }

  async getMe(userId: string): Promise<AuthMeResponse> {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new AppError(
        401,
        ERROR_CODE.AUTH_SESSION_INVALID,
        ERROR_MESSAGE[ERROR_CODE.AUTH_SESSION_INVALID],
      );
    }

    const unread_notifications =
      await this.repository.countUnreadNotifications(user.id);

    return {
      id: user.id,
      full_name: user.full_name,
      username: user.username,
      role_code: user.role_code,
      role_name: user.role_name,
      employee_id: user.employee_id,
      factory_id: user.factory_id,
      must_change_password: Boolean(user.must_change_password),
      menus: buildMenusForRole(user.role_code),
      unread_notifications,
    };
  }
}

export const authService = new AuthService();