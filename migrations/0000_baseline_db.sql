CREATE TYPE "public"."broadcast_severity" AS ENUM('info', 'alerta', 'urgente', 'critico');--> statement-breakpoint
CREATE TYPE "public"."chassis_request_status" AS ENUM('pendente', 'em_analise', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."collect_status" AS ENUM('em_transito', 'autorizado_portaria', 'finalizada');--> statement-breakpoint
CREATE TYPE "public"."contract_status" AS ENUM('ativo', 'suspenso', 'expirado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."driver_modality" AS ENUM('pj', 'clt', 'agregado');--> statement-breakpoint
CREATE TYPE "public"."driver_notification_status" AS ENUM('pendente', 'aceito', 'recusado');--> statement-breakpoint
CREATE TYPE "public"."driver_type" AS ENUM('coleta', 'transporte');--> statement-breakpoint
CREATE TYPE "public"."evaluation_severity" AS ENUM('sem_ocorrencia', 'leve', 'medio', 'grave');--> statement-breakpoint
CREATE TYPE "public"."expense_settlement_status" AS ENUM('pendente', 'enviado', 'devolvido', 'aprovado', 'assinado');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('pedagio', 'combustivel', 'alimentacao', 'hospedagem', 'manutencao', 'multa', 'estacionamento', 'lavagem', 'outros');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('por_km', 'fixo_mensal', 'por_entrega', 'comissao');--> statement-breakpoint
CREATE TYPE "public"."proposal_driver_status" AS ENUM('pendente', 'aceito', 'recusado');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('ativa', 'encerrada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."rating_value" AS ENUM('pessimo', 'ruim', 'regular', 'bom', 'excelente');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('pendente', 'autorizada', 'em_transito', 'concluida', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."transport_status" AS ENUM('pendente', 'pendente_aprovacao', 'aguardando_saida', 'em_transito', 'entregue', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."travel_rate_type" AS ENUM('por_km', 'fixo', 'por_veiculo');--> statement-breakpoint
CREATE TYPE "public"."truck_type" AS ENUM('2_eixos', '3_eixos', '4_eixos', '5_eixos', '6_eixos', '7_eixos', '9_eixos');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'operador', 'visualizador');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('pre_estoque', 'em_estoque', 'em_transferencia', 'despachado', 'entregue', 'retirado');--> statement-breakpoint
CREATE TABLE "api_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"method" varchar(10) NOT NULL,
	"path" varchar(500) NOT NULL,
	"status_code" integer,
	"duration_ms" integer,
	"user_id" varchar,
	"username" varchar(100),
	"user_role" varchar(50),
	"ip_address" varchar(100),
	"request_body" text,
	"response_preview" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"key" varchar(100) PRIMARY KEY NOT NULL,
	"value" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "broadcast_recipients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"broadcast_id" varchar NOT NULL,
	"driver_id" varchar NOT NULL,
	"sent_at" timestamp,
	"received_at" timestamp,
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "broadcasts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"severity" "broadcast_severity" DEFAULT 'info' NOT NULL,
	"geo_filter" jsonb,
	"driver_filter" jsonb,
	"total_sent" integer DEFAULT 0,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chassis_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"chassi" varchar(50) NOT NULL,
	"delivery_address" text,
	"notes" text,
	"status" "chassis_request_status" DEFAULT 'pendente' NOT NULL,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "checkpoints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"city" text,
	"state" varchar(2),
	"latitude" text NOT NULL,
	"longitude" text NOT NULL,
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cnpj" varchar(20),
	"cep" varchar(10),
	"address" text,
	"address_number" varchar(20),
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" varchar(2),
	"latitude" text,
	"longitude" text,
	"phone" varchar(20),
	"email" varchar(255),
	"contact_name" text,
	"daily_cost" text,
	"yard_grace_days" integer DEFAULT 0,
	"username" varchar(100),
	"password" varchar(255),
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "collects" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_chassi" varchar(50) NOT NULL,
	"manufacturer_id" varchar,
	"origin_yard_id" varchar,
	"yard_id" varchar NOT NULL,
	"driver_id" varchar,
	"collect_type" text DEFAULT 'coleta' NOT NULL,
	"status" "collect_status" DEFAULT 'em_transito' NOT NULL,
	"collect_date" timestamp,
	"notes" text,
	"start_latitude" varchar,
	"start_longitude" varchar,
	"end_latitude" varchar,
	"end_longitude" varchar,
	"latitude" varchar,
	"longitude" varchar,
	"checkin_date_time" timestamp,
	"checkin_location" geometry(Point, 4326),
	"checkin_frontal_photo" text,
	"checkin_lateral1_photo" text,
	"checkin_lateral2_photo" text,
	"checkin_traseira_photo" text,
	"checkin_odometer_photo" text,
	"checkin_fuel_level_photo" text,
	"checkin_damage_photos" text[],
	"checkin_selfie_photo" text,
	"checkin_notes" text,
	"checkout_date_time" timestamp,
	"checkout_location" geometry(Point, 4326),
	"checkout_approved_by_id" varchar,
	"checkout_frontal_photo" text,
	"checkout_lateral1_photo" text,
	"checkout_lateral2_photo" text,
	"checkout_traseira_photo" text,
	"checkout_odometer_photo" text,
	"checkout_fuel_level_photo" text,
	"checkout_damage_photos" text[],
	"checkout_selfie_photo" text,
	"checkout_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(50) NOT NULL,
	"title" text NOT NULL,
	"driver_id" varchar,
	"contract_type" "driver_modality" NOT NULL,
	"status" "contract_status" DEFAULT 'ativo' NOT NULL,
	"content" text,
	"start_date" date,
	"end_date" date,
	"payment_type" "payment_type",
	"payment_value" numeric(12, 2),
	"truck_type" text,
	"license_plate" varchar(10),
	"cnh_required" varchar(5),
	"work_region" text,
	"notes" text,
	"driver_signed_at" timestamp,
	"autentique_doc_id" varchar,
	"autentique_status" varchar(50),
	"autentique_signed_url" text,
	"autentique_original_url" text,
	"autentique_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "deleted_transports" (
	"id" serial PRIMARY KEY NOT NULL,
	"original_id" integer,
	"data" jsonb NOT NULL,
	"deleted_by" integer,
	"deleted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_locations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar NOT NULL,
	"name" text NOT NULL,
	"cnpj" varchar(20),
	"cep" varchar(20),
	"address" text NOT NULL,
	"address_number" varchar(20),
	"complement" text,
	"neighborhood" text,
	"city" text NOT NULL,
	"state" varchar(50),
	"country" varchar(50) DEFAULT 'Brasil',
	"latitude" text,
	"longitude" text,
	"responsible_name" text,
	"responsible_phone" varchar(20),
	"emails" text[],
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "driver_evaluations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transport_id" varchar NOT NULL,
	"driver_id" varchar NOT NULL,
	"evaluator_id" varchar NOT NULL,
	"evaluator_name" text NOT NULL,
	"postura_profissional" "rating_value",
	"pontualidade" "rating_value",
	"apresentacao_pessoal" "rating_value",
	"cordialidade" "rating_value",
	"cumpriu_processo" "rating_value",
	"had_incident" text DEFAULT 'false',
	"incident_description" text,
	"average_score" numeric(5, 2),
	"weighted_score" numeric(5, 2),
	"status" varchar DEFAULT 'em_andamento',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "driver_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"yard_id" varchar NOT NULL,
	"delivery_location_id" varchar NOT NULL,
	"departure_date" date NOT NULL,
	"driver_id" varchar NOT NULL,
	"status" "driver_notification_status" DEFAULT 'pendente' NOT NULL,
	"responded_at" timestamp,
	"notified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "driver_ranking_weights" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rating_weight" integer DEFAULT 5 NOT NULL,
	"trips_weight" integer DEFAULT 5 NOT NULL,
	"response_time_weight" integer DEFAULT 5 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "driver_status_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"driver_id" varchar NOT NULL,
	"action" varchar(20) NOT NULL,
	"reason" text NOT NULL,
	"performed_by_user_id" varchar,
	"performed_by_name" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "drivers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cpf" varchar(14) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"email" varchar(255),
	"birth_date" date,
	"cep" varchar(10),
	"address" text,
	"address_number" varchar(20),
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" varchar(2),
	"latitude" text,
	"longitude" text,
	"driver_type" "driver_type",
	"modality" "driver_modality",
	"cnh_type" varchar(5) NOT NULL,
	"cnh_front_photo" text,
	"cnh_back_photo" text,
	"rg_photo" text,
	"address_proof_photo" text,
	"profile_photo" text,
	"is_apto" text DEFAULT 'false',
	"is_active" text DEFAULT 'true',
	"documents_approved" text DEFAULT 'pendente',
	"documents_approved_at" timestamp,
	"documents_approved_by" text,
	"freight_contract_id" varchar,
	"registration_source" varchar(20) DEFAULT 'sistema',
	"device_token" text,
	"collect_type" text DEFAULT 'coleta',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "drivers_cpf_unique" UNIQUE("cpf")
);
--> statement-breakpoint
CREATE TABLE "evaluation_criteria" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"penalty_leve" numeric(5, 2) DEFAULT '10',
	"penalty_medio" numeric(5, 2) DEFAULT '50',
	"penalty_grave" numeric(5, 2) DEFAULT '100',
	"sort_order" integer DEFAULT 0,
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "evaluation_scores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" varchar NOT NULL,
	"criteria_id" varchar NOT NULL,
	"score" numeric(5, 2) NOT NULL,
	"severity" "evaluation_severity" DEFAULT 'sem_ocorrencia',
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_settlement_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"settlement_id" varchar NOT NULL,
	"type" "expense_type" NOT NULL,
	"description" text,
	"currency" varchar(10) DEFAULT 'BRL' NOT NULL,
	"amount" text NOT NULL,
	"photo_url" text NOT NULL,
	"photo_status" text DEFAULT 'ok',
	"photo_rejection_reason" text,
	"item_status" text DEFAULT 'pendente',
	"approved_amount" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expense_settlements" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transport_id" varchar NOT NULL,
	"driver_id" varchar NOT NULL,
	"status" "expense_settlement_status" DEFAULT 'pendente',
	"driver_notes" text,
	"total_expenses" text,
	"advance_amount" text,
	"balance_amount" text,
	"route_distance" text,
	"estimated_tolls" text,
	"estimated_fuel" text,
	"submitted_at" timestamp,
	"reviewed_at" timestamp,
	"approved_at" timestamp,
	"signed_at" timestamp,
	"reviewed_by_user_id" varchar,
	"return_reason" text,
	"settlement_document_url" text,
	"driver_signature" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "freight_contracts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contract_number" varchar(50) NOT NULL,
	"quote_id" varchar,
	"client_id" varchar,
	"client_name" text NOT NULL,
	"client_phone" varchar(20),
	"client_email" varchar(255),
	"distancia_km" numeric(10, 2),
	"valor_total_cte" numeric(12, 2),
	"start_date" date,
	"end_date" date,
	"status" "contract_status" DEFAULT 'ativo' NOT NULL,
	"notes" text,
	"content" text,
	"autentique_doc_id" varchar,
	"autentique_status" varchar(50),
	"autentique_signed_url" text,
	"autentique_original_url" text,
	"autentique_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "freight_contracts_contract_number_unique" UNIQUE("contract_number")
);
--> statement-breakpoint
CREATE TABLE "freight_quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_name" text,
	"client_id" varchar,
	"client_name" text NOT NULL,
	"client_phone" varchar(20),
	"client_email" varchar(255),
	"valid_until" date,
	"truck_model_id" varchar,
	"valor_bem" numeric(12, 2) NOT NULL,
	"distancia_km" numeric(10, 2) NOT NULL,
	"frete_otd" numeric(10, 2) NOT NULL,
	"retorno_motorista" numeric(10, 2) NOT NULL,
	"pedagio" numeric(10, 2) NOT NULL,
	"consumo_veiculo" numeric(5, 2) NOT NULL,
	"preco_diesel" numeric(6, 2) NOT NULL,
	"valor_base" numeric(12, 2) NOT NULL,
	"valor_total_cte" numeric(12, 2) NOT NULL,
	"impostos" numeric(12, 2) NOT NULL,
	"converted_to_contract_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "manufacturers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cep" varchar(10),
	"address" text,
	"address_number" varchar(20),
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" varchar(2),
	"latitude" text,
	"longitude" text,
	"phone" varchar(20),
	"email" varchar(255),
	"contact_name" text,
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"code" varchar(6) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used" text DEFAULT 'false',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "request_counter" (
	"id" varchar PRIMARY KEY DEFAULT 'transport_counter' NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" NOT NULL,
	"feature" varchar(50) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "routes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"origin_yard_id" varchar NOT NULL,
	"destination_location_id" varchar NOT NULL,
	"distance_km" numeric(10, 2),
	"truck_type" "truck_type" DEFAULT '2_eixos',
	"diesel_price" numeric(10, 2),
	"fuel_consumption" numeric(5, 2),
	"fuel_cost" numeric(10, 2),
	"arla32_cost" numeric(10, 2),
	"toll_cost" numeric(10, 2),
	"driver_daily_cost" numeric(10, 2),
	"return_ticket" numeric(10, 2),
	"extra_expenses" numeric(10, 2),
	"food_cost" numeric(10, 2),
	"others_cost" numeric(10, 2),
	"ad_valorem_percentage" numeric(5, 2),
	"vehicle_value" numeric(15, 2),
	"ad_valorem_cost" numeric(10, 2),
	"profit_margin_percentage" numeric(5, 2),
	"admin_fee" numeric(10, 2),
	"total_cost" numeric(15, 2),
	"suggested_price" numeric(15, 2),
	"net_profit" numeric(15, 2),
	"is_favorite" text DEFAULT 'false',
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" varchar(255) NOT NULL,
	"username" varchar(100) NOT NULL,
	"password" varchar(255) NOT NULL,
	"role" varchar(50) DEFAULT 'operador' NOT NULL,
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "system_users_email_unique" UNIQUE("email"),
	CONSTRAINT "system_users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vehicle_chassi" varchar NOT NULL,
	"origin_yard_id" varchar NOT NULL,
	"destination_yard_id" varchar NOT NULL,
	"driver_id" varchar,
	"requested_by" varchar,
	"authorized_by" varchar,
	"status" "transfer_status" DEFAULT 'pendente' NOT NULL,
	"notes" text,
	"authorized_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transport_checkpoints" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transport_id" varchar NOT NULL,
	"checkpoint_id" varchar NOT NULL,
	"order_index" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pendente' NOT NULL,
	"reached_at" timestamp,
	"latitude" text,
	"longitude" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transport_proposal_drivers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"driver_id" varchar NOT NULL,
	"status" "proposal_driver_status" DEFAULT 'pendente' NOT NULL,
	"responded_at" timestamp,
	"assigned_transport_id" varchar,
	"rank_justification" text,
	"case_status" varchar DEFAULT 'aberto',
	"case_notes" text,
	"case_closed_at" timestamp,
	"case_closed_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transport_proposal_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"transport_id" varchar NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transport_proposal_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" varchar NOT NULL,
	"action" varchar(100) NOT NULL,
	"description" text NOT NULL,
	"performed_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transport_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_number" varchar(20),
	"origin_yard_id" varchar NOT NULL,
	"client_id" varchar NOT NULL,
	"delivery_location_id" varchar NOT NULL,
	"travel_rate_id" varchar,
	"start_date" timestamp NOT NULL,
	"distance_km" numeric,
	"total_slots" integer DEFAULT 1 NOT NULL,
	"status" "proposal_status" DEFAULT 'ativa' NOT NULL,
	"notes" text,
	"is_emergency" text DEFAULT 'false',
	"estimated_value" numeric,
	"rate_approval_status" text,
	"rate_approval_note" text,
	"rate_approved_at" timestamp,
	"rate_approved_by" text,
	"advance_amount" numeric,
	"advance_method" text,
	"created_by_user_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transports" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_number" varchar(20) NOT NULL,
	"vehicle_chassi" varchar(50) NOT NULL,
	"client_id" varchar NOT NULL,
	"origin_yard_id" varchar NOT NULL,
	"delivery_location_id" varchar NOT NULL,
	"driver_id" varchar,
	"travel_rate_id" varchar,
	"status" "transport_status" DEFAULT 'pendente' NOT NULL,
	"delivery_date" timestamp,
	"scheduled_departure" timestamp,
	"notes" text,
	"documents" text[],
	"created_at" timestamp DEFAULT now(),
	"created_by_user_id" varchar,
	"driver_assigned_by_user_id" varchar,
	"driver_assigned_at" timestamp,
	"transit_started_at" timestamp,
	"checkin_date_time" timestamp,
	"checkin_location" geometry(Point, 4326),
	"checkin_frontal_photo" text,
	"checkin_lateral1_photo" text,
	"checkin_lateral2_photo" text,
	"checkin_traseira_photo" text,
	"checkin_odometer_photo" text,
	"checkin_fuel_level_photo" text,
	"checkin_damage_photos" text[],
	"checkin_selfie_photo" text,
	"checkin_notes" text,
	"checkout_date_time" timestamp,
	"checkout_location" geometry(Point, 4326),
	"checkout_frontal_photo" text,
	"checkout_lateral1_photo" text,
	"checkout_lateral2_photo" text,
	"checkout_traseira_photo" text,
	"checkout_odometer_photo" text,
	"checkout_fuel_level_photo" text,
	"checkout_damage_photos" text[],
	"checkout_selfie_photo" text,
	"checkout_notes" text,
	"route_distance_km" numeric,
	"route_duration_minutes" integer,
	"estimated_tolls" numeric,
	"estimated_fuel" numeric,
	"travel_rate_approval_status" text,
	"travel_rate_approved_by" varchar,
	"travel_rate_approved_at" timestamp,
	"travel_rate_approval_note" text,
	CONSTRAINT "transports_request_number_unique" UNIQUE("request_number")
);
--> statement-breakpoint
CREATE TABLE "travel_rate_approvers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"travel_rate_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "travel_rates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"origin_city" text,
	"origin_state" varchar(2),
	"destination_city" text,
	"destination_state" varchar(2),
	"rate_type" "travel_rate_type" DEFAULT 'fixo' NOT NULL,
	"rate_value" numeric(12, 2) NOT NULL,
	"min_distance" numeric(8, 2),
	"max_distance" numeric(8, 2),
	"vehicle_type" text,
	"notes" text,
	"is_active" text DEFAULT 'true',
	"requires_approval" text DEFAULT 'false',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "truck_models" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"axle_config" text NOT NULL,
	"average_consumption" numeric(5, 2) NOT NULL,
	"vehicle_value" numeric(12, 2),
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_type_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_type_id" varchar(50) NOT NULL,
	"feature" varchar(100) NOT NULL,
	"can_view" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_types" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system" text DEFAULT 'false',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"chassi" varchar(50) PRIMARY KEY NOT NULL,
	"client_id" varchar,
	"yard_id" varchar,
	"manufacturer_id" varchar,
	"color" text,
	"status" "vehicle_status" DEFAULT 'pre_estoque' NOT NULL,
	"collect_date_time" timestamp,
	"yard_entry_date_time" timestamp,
	"dispatch_date_time" timestamp,
	"delivery_date_time" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "yard_monthly_invoice_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar NOT NULL,
	"chassi" varchar NOT NULL,
	"yard_name" text,
	"entry_date" timestamp,
	"total_days_in_patio" integer DEFAULT 0 NOT NULL,
	"days_in_period" integer DEFAULT 0 NOT NULL,
	"grace_days_applied" integer DEFAULT 0 NOT NULL,
	"billable_days" integer DEFAULT 0 NOT NULL,
	"daily_cost" text DEFAULT '0' NOT NULL,
	"subtotal" text DEFAULT '0' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "yard_monthly_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" varchar,
	"client_name" text NOT NULL,
	"reference_month" integer NOT NULL,
	"reference_year" integer NOT NULL,
	"total_value" text DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_date" timestamp,
	"daily_cost_snapshot" text,
	"grace_days_snapshot" integer DEFAULT 0,
	"notes" text,
	"generated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "yards" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"cep" varchar(10),
	"address" text,
	"address_number" varchar(20),
	"complement" text,
	"neighborhood" text,
	"city" text,
	"state" varchar(2),
	"latitude" text,
	"longitude" text,
	"phone" varchar(20),
	"max_vehicles" integer,
	"is_active" text DEFAULT 'true',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(100) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"role" varchar(20) DEFAULT 'visualizador',
	"refresh_token_version" timestamp DEFAULT now(),
	"last_login" timestamp,
	"is_active" varchar(5) DEFAULT 'true',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_broadcast_id_broadcasts_id_fk" FOREIGN KEY ("broadcast_id") REFERENCES "public"."broadcasts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broadcast_recipients" ADD CONSTRAINT "broadcast_recipients_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chassis_requests" ADD CONSTRAINT "chassis_requests_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collects" ADD CONSTRAINT "collects_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collects" ADD CONSTRAINT "collects_origin_yard_id_yards_id_fk" FOREIGN KEY ("origin_yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collects" ADD CONSTRAINT "collects_yard_id_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collects" ADD CONSTRAINT "collects_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_locations" ADD CONSTRAINT "delivery_locations_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_evaluations" ADD CONSTRAINT "driver_evaluations_transport_id_transports_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_evaluations" ADD CONSTRAINT "driver_evaluations_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD CONSTRAINT "driver_notifications_yard_id_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD CONSTRAINT "driver_notifications_delivery_location_id_delivery_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_notifications" ADD CONSTRAINT "driver_notifications_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "driver_status_logs" ADD CONSTRAINT "driver_status_logs_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_evaluation_id_driver_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."driver_evaluations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_scores" ADD CONSTRAINT "evaluation_scores_criteria_id_evaluation_criteria_id_fk" FOREIGN KEY ("criteria_id") REFERENCES "public"."evaluation_criteria"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_settlement_items" ADD CONSTRAINT "expense_settlement_items_settlement_id_expense_settlements_id_fk" FOREIGN KEY ("settlement_id") REFERENCES "public"."expense_settlements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_settlements" ADD CONSTRAINT "expense_settlements_transport_id_transports_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_settlements" ADD CONSTRAINT "expense_settlements_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expense_settlements" ADD CONSTRAINT "expense_settlements_reviewed_by_user_id_system_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."system_users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_origin_yard_id_yards_id_fk" FOREIGN KEY ("origin_yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "routes" ADD CONSTRAINT "routes_destination_location_id_delivery_locations_id_fk" FOREIGN KEY ("destination_location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_checkpoints" ADD CONSTRAINT "transport_checkpoints_transport_id_transports_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_checkpoints" ADD CONSTRAINT "transport_checkpoints_checkpoint_id_checkpoints_id_fk" FOREIGN KEY ("checkpoint_id") REFERENCES "public"."checkpoints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposal_drivers" ADD CONSTRAINT "transport_proposal_drivers_proposal_id_transport_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."transport_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposal_drivers" ADD CONSTRAINT "transport_proposal_drivers_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposal_drivers" ADD CONSTRAINT "transport_proposal_drivers_assigned_transport_id_transports_id_fk" FOREIGN KEY ("assigned_transport_id") REFERENCES "public"."transports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposal_items" ADD CONSTRAINT "transport_proposal_items_proposal_id_transport_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."transport_proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposal_items" ADD CONSTRAINT "transport_proposal_items_transport_id_transports_id_fk" FOREIGN KEY ("transport_id") REFERENCES "public"."transports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposals" ADD CONSTRAINT "transport_proposals_origin_yard_id_yards_id_fk" FOREIGN KEY ("origin_yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposals" ADD CONSTRAINT "transport_proposals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposals" ADD CONSTRAINT "transport_proposals_delivery_location_id_delivery_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transport_proposals" ADD CONSTRAINT "transport_proposals_travel_rate_id_travel_rates_id_fk" FOREIGN KEY ("travel_rate_id") REFERENCES "public"."travel_rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transports" ADD CONSTRAINT "transports_vehicle_chassi_vehicles_chassi_fk" FOREIGN KEY ("vehicle_chassi") REFERENCES "public"."vehicles"("chassi") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transports" ADD CONSTRAINT "transports_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transports" ADD CONSTRAINT "transports_origin_yard_id_yards_id_fk" FOREIGN KEY ("origin_yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transports" ADD CONSTRAINT "transports_delivery_location_id_delivery_locations_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "public"."delivery_locations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transports" ADD CONSTRAINT "transports_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "travel_rate_approvers" ADD CONSTRAINT "travel_rate_approvers_travel_rate_id_travel_rates_id_fk" FOREIGN KEY ("travel_rate_id") REFERENCES "public"."travel_rates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_type_permissions" ADD CONSTRAINT "user_type_permissions_user_type_id_user_types_id_fk" FOREIGN KEY ("user_type_id") REFERENCES "public"."user_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_yard_id_yards_id_fk" FOREIGN KEY ("yard_id") REFERENCES "public"."yards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_manufacturer_id_manufacturers_id_fk" FOREIGN KEY ("manufacturer_id") REFERENCES "public"."manufacturers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");