-- CreateTable
CREATE TABLE "WebSocketConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "connectionId" TEXT NOT NULL,
    "userId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "connectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "disconnectedAt" DATETIME,
    "lastHeartbeatAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" TEXT,
    CONSTRAINT "WebSocketConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "TikTokUser" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "WebSocketConnection_connectionId_key" ON "WebSocketConnection"("connectionId");

-- CreateIndex
CREATE INDEX "WebSocketConnection_userId_idx" ON "WebSocketConnection"("userId");

-- CreateIndex
CREATE INDEX "WebSocketConnection_status_idx" ON "WebSocketConnection"("status");

-- CreateIndex
CREATE INDEX "WebSocketConnection_connectedAt_idx" ON "WebSocketConnection"("connectedAt");

-- CreateIndex
CREATE INDEX "TikTokUser_tiktokUserId_idx" ON "TikTokUser"("tiktokUserId");
