import { Module } from "@nestjs/common";
import { ScraperService } from "./scraper.service.js";

@Module({
  providers: [ScraperService],
  exports: [ScraperService],
})
export class ScraperModule { }
