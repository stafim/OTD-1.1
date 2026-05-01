CREATE TABLE "contract_drivers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_id" varchar NOT NULL,
	"driver_id" varchar NOT NULL,
	"driver_signed_at" timestamp,
	"autentique_doc_id" varchar,
	"autentique_status" varchar(50),
	"autentique_signed_url" text,
	"autentique_original_url" text,
	"autentique_sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(10) NOT NULL,
	"version" varchar(50) NOT NULL,
	"description" text,
	"deploy_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "expense_settlements" DROP CONSTRAINT "expense_settlements_reviewed_by_user_id_system_users_id_fk";
--> statement-breakpoint
ALTER TABLE "contract_drivers" ADD CONSTRAINT "contract_drivers_contract_id_contracts_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."contracts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contract_drivers" ADD CONSTRAINT "contract_drivers_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uniq_contract_driver" ON "contract_drivers" USING btree ("contract_id","driver_id");--> statement-breakpoint
ALTER TABLE "expense_settlements" ADD CONSTRAINT "expense_settlements_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;