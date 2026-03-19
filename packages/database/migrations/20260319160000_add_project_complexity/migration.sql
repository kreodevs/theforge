-- CreateEnum
CREATE TYPE "ComplexityLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "complexity" "ComplexityLevel" NOT NULL DEFAULT 'HIGH';
