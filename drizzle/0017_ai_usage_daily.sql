CREATE TABLE "ai_usage_daily" (
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"key" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "ai_usage_daily_day_metric_key_pk" PRIMARY KEY("day","metric","key")
);
