/**
 * @fileoverview Módulo raíz **AppModule** de The Forge API: configuración global, Prisma, auth JWT, módulos de
 * dominio (proyectos, sesiones, AI, engine con semáforo MDD y costes), orquestador, análisis, flujo legacy y
 * guard/interceptor globales (`JwtAuthGuard`, `UserContextInterceptor`).
 *
 * @copyright 2026 Jorge Correa
 * @license Apache-2.0
 */
import { join } from "node:path";
import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { UserContextInterceptor } from "./common/interceptors/user-context.interceptor.js";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { HealthController } from "./health.controller.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { SessionsModule } from "./modules/sessions/sessions.module.js";
import { CryptoModule } from "./modules/crypto/crypto.module.js";
import { UserProvidersModule } from "./modules/user-providers/user-providers.module.js";

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [join(__dirname, "../../.env"), join(__dirname, "../../../.env"), ".env"],
    }),
    CryptoModule,
    AuthModule,
    PrismaModule,
    UserProvidersModule,
    SessionsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: UserContextInterceptor },
  ],
})
export class AppModule { }
