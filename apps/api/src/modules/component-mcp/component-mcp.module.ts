import { Module } from "@nestjs/common";
import { ComponentSourceModule } from "../component-source/component-source.module.js";
import { ComponentMcpService } from "./component-mcp.service.js";

/** @deprecated Import ComponentSourceModule instead. Re-exports registry for legacy imports. */
@Module({
  imports: [ComponentSourceModule],
  providers: [ComponentMcpService],
  exports: [ComponentSourceModule, ComponentMcpService],
})
export class ComponentMcpModule {}
