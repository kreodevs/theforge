import { Module } from "@nestjs/common";
import { DocumentSnapshotService } from "./document-snapshot.service.js";

@Module({
  providers: [DocumentSnapshotService],
  exports: [DocumentSnapshotService],
})
export class DocumentSnapshotModule {}
