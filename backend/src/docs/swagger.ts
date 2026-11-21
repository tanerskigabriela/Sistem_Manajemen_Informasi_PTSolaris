import { orderSwaggerPaths, orderSwaggerTags } from "./order.swagger";

import { produksiPaths, produksiSecuritySchemes, produksiTags } from './produksi.swagger';

export const swaggerDocument = {
  openapi: "3.0.3",
  info: {
    title: "Project Solaris API",
    version: "1.0.0",
    description:
      "Dokumentasi REST API Project Solaris (Database Gabungan RSI + SMBD).",
  },
  servers: [
    {
      url: "/api/v1",
      description: "API v1",
    },
  ],
  tags: [
    {
      name: "System",
      description: "Pemeriksaan kesehatan layanan dan koneksi database",
    },
    ...orderSwaggerTags,
    ...produksiTags,
  ],
  components: { securitySchemes: produksiSecuritySchemes },
  paths: {
    "/health": {
    ...produksiPaths,
    '/health': {
      get: {
        tags: ["System"],
        summary: "Cek kesehatan backend dan koneksi SQL Server",
        responses: {
          "200": {
            description: "Layanan dan database berjalan normal",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "success" },
                    data: {
                      type: "object",
                      properties: {
                        service: { type: "string", example: "solaris-backend" },
                        db_ok: { type: "boolean", example: true },
                        timestamp: {
                          type: "string",
                          format: "date-time",
                        },
                      },
                    },
                    message: {
                      type: "string",
                      example: "Layanan berjalan dengan baik.",
                    },
                  },
                },
              },
            },
          },
          "503": {
            description:
              "Layanan sedang tidak tersedia. Silakan coba lagi. (ERR-SYS-01)",
          },
        },
      },
    },
    ...orderSwaggerPaths,
  },
};
