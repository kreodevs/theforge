import { Module } from "@nestjs/common";
import { PrismaModule } from "../../prisma/prisma.module.js";
import { ComponentSourceCredentialService } from "./component-source-credential.service.js";
import {
  COMPONENT_SOURCE_REGISTRY,
  ComponentSourceRegistry,
} from "./component-source.registry.js";

@Module({
  imports: [PrismaModule],
  providers: [
    ComponentSourceCredentialService,
    ComponentSourceRegistry,
    {
      provide: COMPONENT_SOURCE_REGISTRY,
      useExisting: ComponentSourceRegistry,
    },
  ],
  exports: [
    ComponentSourceCredentialService,
    ComponentSourceRegistry,
    COMPONENT_SOURCE_REGISTRY,
  ],
})
export class ComponentSourceModule {}
