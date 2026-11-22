export const authSwaggerTags = [
  {
    name: 'Auth',
    description: 'Autentikasi login, logout, dan profil pengguna aktif',
  },
];

export const authSecuritySchemes = {
  cookieAuth: {
    type: 'apiKey',
    in: 'cookie',
    name: 'token',
    description: 'Cookie HttpOnly JWT yang otomatis diset saat POST /auth/login',
  },
};

export const authSwaggerPaths = {
  '/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Login akun (set cookie HttpOnly token berlaku 8 jam)',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['username', 'password'],
              properties: {
                username: { type: 'string', example: 'admin.solaris' },
                password: { type: 'string', example: 'Solaris#2026' },
              },
            },
          },
        },
      },
      responses: {
        '200': { description: 'Login berhasil (cookie HttpOnly token diset)' },
        '401': { description: 'ERR-AUTH-02 Username atau password salah.' },
        '422': { description: 'ERR-VAL-01 Kolom ini wajib diisi.' },
        '423': { description: 'ERR-AUTH-06 Akun terkunci setelah 5 kali gagal login.' },
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Logout dan akhiri sesi aktif',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': { description: 'Logout berhasil' },
        '401': { description: 'ERR-AUTH-01/04/05 Belum login atau sesi berakhir.' },
      },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Profil akun aktif, daftar menu sidebar, dan jumlah notifikasi belum dibaca',
      security: [{ cookieAuth: [] }],
      responses: {
        '200': { description: 'Data profil dan menu berhasil diambil' },
        '401': { description: 'ERR-AUTH-01/04/05 Belum login atau sesi berakhir.' },
      },
    },
  },
};