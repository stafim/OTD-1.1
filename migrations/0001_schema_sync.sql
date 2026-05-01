ALTER TYPE "public"."expense_type" ADD VALUE 'passagem' BEFORE 'outros';--> statement-breakpoint
CREATE TABLE "driver_deletion_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"channel" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'em_aberto' NOT NULL,
	"completion_notes" text,
	"completed_at" timestamp,
	"completed_by_user_id" varchar,
	"completed_by_user_name" text,
	"requested_by_user_id" varchar,
	"requested_by_user_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_settlements" ALTER COLUMN "driver_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "rg" varchar(20);--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "cnpj" varchar(20);--> statement-breakpoint
ALTER TABLE "drivers" ADD COLUMN "company_name" text;--> statement-breakpoint
ALTER TABLE "expense_settlement_items" ADD COLUMN "country" varchar(10);--> statement-breakpoint
ALTER TABLE "expense_settlements" ADD COLUMN "driver_finished_submission_at" timestamp;--> statement-breakpoint
ALTER TABLE "transports" ADD COLUMN "checkin_interior_photos" text[];--> statement-breakpoint
ALTER TABLE "transports" ADD COLUMN "checkout_interior_photos" text[];--> statement-breakpoint
ALTER TABLE "driver_deletion_requests" ADD CONSTRAINT "driver_deletion_requests_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;