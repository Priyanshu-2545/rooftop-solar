CREATE TABLE "app_settings" (
	"key" text NOT NULL,
	"value" text NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	CONSTRAINT "app_settings_key_effective_from_pk" PRIMARY KEY("key","effective_from")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "bill_extractions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_id" uuid NOT NULL,
	"backend" text DEFAULT 'simulated' NOT NULL,
	"raw_json" jsonb,
	"consumer_no" text,
	"tariff" text,
	"sanctioned_load_kw" numeric(6, 1),
	"avg_units_month" integer,
	"confidence_json" jsonb,
	"confirmed_json" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"confirmed_by" uuid,
	"confirmed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "bill_uploads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"storage_key" text NOT NULL,
	"bytes_data" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"quality_flag" text NOT NULL,
	"attempt_no" integer DEFAULT 1 NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bill_uploads_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"filename" text NOT NULL,
	"storage_key" text NOT NULL,
	"bytes_data" "bytea" NOT NULL,
	"mime" text NOT NULL,
	"uploaded_by" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"human_id" text NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"owner_type" text NOT NULL,
	"roof_type" text NOT NULL,
	"roof_area_sqft" integer NOT NULL,
	"monthly_bill_paise" integer NOT NULL,
	"units_per_month" integer,
	"pincode" text NOT NULL,
	"customer_type" text DEFAULT 'residential' NOT NULL,
	"consent_at" timestamp with time zone NOT NULL,
	"consent_text_version" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"score" integer,
	"score_band" text,
	"score_reasons" jsonb,
	"next_step" text,
	"recommended_kw" numeric(4, 1),
	"needs_human_check" boolean DEFAULT false NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "leads_human_id_unique" UNIQUE("human_id"),
	CONSTRAINT "leads_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_phone" text NOT NULL,
	"channel" text NOT NULL,
	"template" text NOT NULL,
	"body" text NOT NULL,
	"lang" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"code_hash" text NOT NULL,
	"salt" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"mode" text DEFAULT 'mock' NOT NULL,
	"ref" text NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "price_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kw" integer NOT NULL,
	"tier" text NOT NULL,
	"price_paise" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "project_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"stage_code" text NOT NULL,
	"note" text,
	"actor_user_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_stages" (
	"code" text PRIMARY KEY NOT NULL,
	"label_en" text NOT NULL,
	"label_mr" text NOT NULL,
	"label_hi" text NOT NULL,
	"next_en" text NOT NULL,
	"next_mr" text NOT NULL,
	"next_hi" text NOT NULL,
	"order" integer NOT NULL,
	"stuck_after_days" integer,
	CONSTRAINT "project_stages_order_unique" UNIQUE("order")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"human_id" text NOT NULL,
	"quote_id" uuid NOT NULL,
	"stage_code" text NOT NULL,
	"status_token_hash" text,
	"token_revoked_at" timestamp with time zone,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stage_entered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_human_id_unique" UNIQUE("human_id"),
	CONSTRAINT "projects_quote_id_unique" UNIQUE("quote_id")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"inputs_snapshot" jsonb NOT NULL,
	"outputs_snapshot" jsonb NOT NULL,
	"rule_ids_used" jsonb NOT NULL,
	"created_by" uuid NOT NULL,
	"sent_at" timestamp with time zone,
	"valid_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limits_key_window_start_pk" PRIMARY KEY("key","window_start")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subsidy_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scheme" text NOT NULL,
	"customer_type" text NOT NULL,
	"per_kw_paise" integer NOT NULL,
	"first_kw_limit" integer NOT NULL,
	"extra_kw_paise" integer NOT NULL,
	"cap_paise" integer NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"verified" boolean DEFAULT false NOT NULL,
	"source_note" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys" (
	"lead_id" uuid PRIMARY KEY NOT NULL,
	"roof_ok" boolean NOT NULL,
	"usable_area_sqft" integer,
	"shading" text DEFAULT 'none' NOT NULL,
	"notes" text,
	"surveyed_by" uuid NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phone" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"is_admin" boolean DEFAULT false NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_extractions" ADD CONSTRAINT "bill_extractions_upload_id_bill_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."bill_uploads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_extractions" ADD CONSTRAINT "bill_extractions_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_uploads" ADD CONSTRAINT "bill_uploads_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_stage_code_project_stages_code_fk" FOREIGN KEY ("stage_code") REFERENCES "public"."project_stages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_events" ADD CONSTRAINT "project_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_quote_id_quotes_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quotes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_stage_code_project_stages_code_fk" FOREIGN KEY ("stage_code") REFERENCES "public"."project_stages"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_surveyed_by_users_id_fk" FOREIGN KEY ("surveyed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "uploads_lead" ON "bill_uploads" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "leads_owner" ON "leads" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "leads_status_band" ON "leads" USING btree ("status","score_band");--> statement-breakpoint
CREATE INDEX "leads_pincode" ON "leads" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "otp_phone_created" ON "otp_challenges" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "price_rules_lookup" ON "price_rules" USING btree ("kw","tier","effective_from");--> statement-breakpoint
CREATE INDEX "events_project" ON "project_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "projects_stage" ON "projects" USING btree ("stage_code","stage_entered_at");--> statement-breakpoint
CREATE UNIQUE INDEX "projects_token" ON "projects" USING btree ("status_token_hash");--> statement-breakpoint
CREATE INDEX "quotes_lead" ON "quotes" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "subsidy_rules_lookup" ON "subsidy_rules" USING btree ("customer_type","effective_from");