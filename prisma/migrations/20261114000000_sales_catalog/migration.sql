CREATE TABLE "Salesperson" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

CREATE UNIQUE INDEX "Salesperson_name_key" ON "Salesperson"("name");

ALTER TABLE "Activity" ADD COLUMN "salesId" TEXT
    REFERENCES "Salesperson"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Salesperson" ("id", "name")
SELECT lower(hex(randomblob(16))), "salesName"
FROM (SELECT DISTINCT "salesName" FROM "Activity" WHERE length(trim("salesName")) > 0);

UPDATE "Activity"
SET "salesId" = (
    SELECT "id" FROM "Salesperson" WHERE "Salesperson"."name" = "Activity"."salesName"
);

CREATE INDEX "Activity_salesId_idx" ON "Activity"("salesId");
