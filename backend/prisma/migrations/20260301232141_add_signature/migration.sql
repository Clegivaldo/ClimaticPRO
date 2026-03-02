/*
  Warnings:

  - A unique constraint covering the columns `[userId,signature]` on the table `Sensor` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Sensor" ADD COLUMN     "signature" TEXT,
ALTER COLUMN "mac" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Sensor_signature_idx" ON "Sensor"("signature");

-- CreateIndex
CREATE UNIQUE INDEX "Sensor_userId_signature_key" ON "Sensor"("userId", "signature");
