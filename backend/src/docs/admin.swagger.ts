const security = [{ cookieAuth: [] }];

export const adminSwaggerTags = [
  {
    name: 'Users',
    description: 'Manajemen akun pengguna (khusus ADMIN)',
  },
  {
    name: 'Activity Logs',
    description: 'Audit log aktivitas sistem read-only (khusus ADMIN)',
  },
];

export const adminSwaggerPaths = {
  '/users': {
    get: {
      tags: ['Users'],
      summary: 'Daftar akun pengguna dengan pagination dan filter',
      security,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        {
          name: 'per_page',
          in: 'query',
          schema: { type: 'integer', default: 20 },
        },
        {
          name: 'q',
          in: 'query',
          schema: { type: 'string' },
          description: 'Cari username atau nama lengkap',
        },
        {
          name: 'role_code',
          in: 'query',
          schema: {
            type: 'string',
            enum: [
              'SUPERADMIN',
              'ADMIN',
              'PIMPINAN',
              'MARKETING',
              'PPIC',
              'SPV',
              'QC',
            ],
          },
        },
        {
          name: 'is_active',
          in: 'query',
          schema: { type: 'string', enum: ['true', 'false'] },
        },
      ],
      responses: {
        '200': { description: 'Daftar pengguna berhasil diambil' },
        '401': { description: 'ERR-AUTH-01/04/05 Belum login atau sesi berakhir.' },
        '403': { description: 'ERR-AUTH-03 Khusus role ADMIN.' },
      },
    },
    post: {
      tags: ['Users'],
      summary: 'Buat akun baru untuk karyawan yang belum punya akun',
      security,
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['employee_id', 'username', 'password', 'role_code'],
              properties: {
                employee_id: { type: 'string', format: 'uuid' },
                username: { type: 'string', example: 'staff.baru' },
                password: { type: 'string', example: 'Solaris#2026' },
                role_code: {
                  type: 'string',
                  enum: ['ADMIN', 'PIMPINAN', 'MARKETING', 'PPIC', 'SPV', 'QC'],
                  example: 'MARKETING',
                },
              },
            },
          },
        },
      },
      responses: {
        '201': { description: 'Akun pengguna berhasil dibuat' },
        '401': { description: 'ERR-AUTH-01/04/05 Belum login atau sesi berakhir.' },
        '403': { description: 'ERR-AUTH-03 Khusus role ADMIN.' },
        '409': { description: 'ERR-USR-01 Username atau karyawan sudah terdaftar.' },
        '422': { description: 'ERR-VAL-01 Data tidak valid.' },
      },
    },
  },
  '/users/available-employees': {
    get: {
      tags: ['Users'],
      summary: 'Daftar karyawan aktif yang belum memiliki akun (dropdown SCR-03)',
      security,
      parameters: [
        {
          name: 'q',
          in: 'query',
          schema: { type: 'string' },
          description: 'Cari nama, divisi, atau jabatan karyawan',
        },
      ],
      responses: {
        '200': { description: 'Daftar karyawan tersedia berhasil diambil' },
        '401': { description: 'ERR-AUTH-01/04/05 Belum login atau sesi berakhir.' },
        '403': { description: 'ERR-AUTH-03 Khusus role ADMIN.' },
      },
    },
  },
  '/users/{id}': {
    patch: {
      tags: ['Users'],
      summary: 'Ubah role atau status aktif/nonaktif akun pengguna',
      security,
      parameters: [
        {
          name: 'id',
          in: 'path',
          required: true,
          schema: { type: 'string', format: 'uuid' },
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                role_code: {
                  type: 'string',
                  enum: ['ADMIN', 'PIMPINAN', 'MARKETING', 'PPIC', 'SPV', 'QC'],
                },
                is_active: { type: 'boolean' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Data pengguna berhasil diperbarui' },
        '401': { description: 'ERR-AUTH-01/04/05 Belum login atau sesi berakhir.' },
        '403': { description: 'ERR-AUTH-03 Khusus role ADMIN.' },
        '404': { description: 'Data tidak ditemukan.' },
        '409': { description: 'ERR-USR-01 Tidak dapat menonaktifkan akun sendiri.' },
        '422': { description: 'ERR-VAL-01 Data tidak valid.' },
      },
    },
  },
  '/activity-logs': {
    get: {
      tags: ['Activity Logs'],
      summary: 'Daftar log aktivitas sistem dengan filter dan pagination',
      security,
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
        {
          name: 'per_page',
          in: 'query',
          schema: { type: 'integer', default: 20 },
        },
        {
          name: 'action_type',
          in: 'query',
          schema: {
            type: 'string',
            enum: [
              'LOGIN_BERHASIL',
              'LOGIN_GAGAL',
              'LOGOUT',
              'SESI_BERAKHIR',
              'SESI_DIAKHIRI',
              'AKUN_TERKUNCI',
              'BUKA_KUNCI',
              'RESET_PASSWORD',
              'GANTI_PASSWORD',
              'AKSES_DITOLAK',
              'TAMBAH',
              'UBAH',
              'SETUJU',
              'TOLAK',
              'TARIK',
              'BATAL',
            ],
          },
        },
        { name: 'username', in: 'query', schema: { type: 'string' } },
        { name: 'resource_type', in: 'query', schema: { type: 'string' } },
        {
          name: 'date_from',
          in: 'query',
          schema: { type: 'string', format: 'date', example: '2026-11-21' },
        },
        {
          name: 'date_to',
          in: 'query',
          schema: { type: 'string', format: 'date', example: '2026-11-22' },
        },
      ],
      responses: {
        '200': { description: 'Daftar log aktivitas berhasil diambil' },
        '401': { description: 'ERR-AUTH-01/04/05 Belum login atau sesi berakhir.' },
        '403': { description: 'ERR-AUTH-03 Khusus role ADMIN.' },
        '422': { description: 'ERR-VAL-01 Filter tanggal tidak valid.' },
      },
    },
  },
};