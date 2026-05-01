--
-- PostgreSQL database dump
--

\restrict 9eL48PxoCJHaJQ3SwRRBhMlRMhtExwVcSfhcfRSEL3Lt6c8LCd5GgARBYz99m9R

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: postgres
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO postgres;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: postgres
--

COMMENT ON SCHEMA public IS '';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: collect_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.collect_status AS ENUM (
    'em_transito',
    'aguardando_checkout',
    'finalizada'
);


ALTER TYPE public.collect_status OWNER TO postgres;

--
-- Name: contract_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.contract_status AS ENUM (
    'ativo',
    'suspenso',
    'expirado',
    'cancelado'
);


ALTER TYPE public.contract_status OWNER TO postgres;

--
-- Name: driver_modality; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.driver_modality AS ENUM (
    'pj',
    'clt',
    'agregado'
);


ALTER TYPE public.driver_modality OWNER TO postgres;

--
-- Name: driver_notification_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.driver_notification_status AS ENUM (
    'pendente',
    'aceito',
    'recusado'
);


ALTER TYPE public.driver_notification_status OWNER TO postgres;

--
-- Name: driver_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.driver_type AS ENUM (
    'coleta',
    'transporte'
);


ALTER TYPE public.driver_type OWNER TO postgres;

--
-- Name: evaluation_severity; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.evaluation_severity AS ENUM (
    'sem_ocorrencia',
    'leve',
    'medio',
    'grave'
);


ALTER TYPE public.evaluation_severity OWNER TO postgres;

--
-- Name: expense_settlement_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.expense_settlement_status AS ENUM (
    'pendente',
    'enviado',
    'devolvido',
    'aprovado',
    'assinado'
);


ALTER TYPE public.expense_settlement_status OWNER TO postgres;

--
-- Name: expense_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.expense_type AS ENUM (
    'pedagio',
    'combustivel',
    'alimentacao',
    'hospedagem',
    'manutencao',
    'multa',
    'estacionamento',
    'lavagem',
    'outros'
);


ALTER TYPE public.expense_type OWNER TO postgres;

--
-- Name: payment_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.payment_type AS ENUM (
    'por_km',
    'fixo_mensal',
    'por_entrega',
    'comissao'
);


ALTER TYPE public.payment_type OWNER TO postgres;

--
-- Name: proposal_driver_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.proposal_driver_status AS ENUM (
    'pendente',
    'aceito',
    'recusado'
);


ALTER TYPE public.proposal_driver_status OWNER TO postgres;

--
-- Name: proposal_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.proposal_status AS ENUM (
    'ativa',
    'encerrada',
    'cancelada'
);


ALTER TYPE public.proposal_status OWNER TO postgres;

--
-- Name: rating_value; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.rating_value AS ENUM (
    'pessimo',
    'ruim',
    'regular',
    'bom',
    'excelente'
);


ALTER TYPE public.rating_value OWNER TO postgres;

--
-- Name: transfer_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transfer_status AS ENUM (
    'pendente',
    'autorizada',
    'em_transito',
    'concluida',
    'cancelada'
);


ALTER TYPE public.transfer_status OWNER TO postgres;

--
-- Name: transport_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.transport_status AS ENUM (
    'pendente',
    'pendente_aprovacao',
    'aguardando_saida',
    'em_transito',
    'entregue',
    'cancelado'
);


ALTER TYPE public.transport_status OWNER TO postgres;

--
-- Name: travel_rate_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.travel_rate_type AS ENUM (
    'por_km',
    'fixo',
    'por_veiculo'
);


ALTER TYPE public.travel_rate_type OWNER TO postgres;

--
-- Name: truck_type; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.truck_type AS ENUM (
    '2_eixos',
    '3_eixos',
    '4_eixos',
    '5_eixos',
    '6_eixos',
    '7_eixos',
    '9_eixos'
);


ALTER TYPE public.truck_type OWNER TO postgres;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'operador',
    'visualizador'
);


ALTER TYPE public.user_role OWNER TO postgres;

--
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: postgres
--

CREATE TYPE public.vehicle_status AS ENUM (
    'pre_estoque',
    'em_estoque',
    'em_transferencia',
    'despachado',
    'entregue',
    'retirado'
);


ALTER TYPE public.vehicle_status OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: api_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.api_logs (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    method character varying(10) NOT NULL,
    path character varying(500) NOT NULL,
    status_code integer,
    duration_ms integer,
    user_id character varying,
    username character varying(100),
    user_role character varying(50),
    ip_address character varying(100),
    request_body text,
    response_preview text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.api_logs OWNER TO postgres;

--
-- Name: checkpoints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.checkpoints (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    city text,
    state character varying(2),
    latitude text NOT NULL,
    longitude text NOT NULL,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.checkpoints OWNER TO postgres;

--
-- Name: clients; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.clients (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    cnpj character varying(20),
    cep character varying(10),
    address text,
    address_number character varying(20),
    complement text,
    neighborhood text,
    city text,
    state character varying(2),
    latitude text,
    longitude text,
    phone character varying(20),
    email character varying(255),
    contact_name text,
    daily_cost text,
    yard_grace_days integer DEFAULT 0,
    username character varying(100),
    password character varying(255),
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.clients OWNER TO postgres;

--
-- Name: collects; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.collects (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    vehicle_chassi character varying(50) NOT NULL,
    manufacturer_id character varying NOT NULL,
    yard_id character varying NOT NULL,
    driver_id character varying,
    status public.collect_status DEFAULT 'em_transito'::public.collect_status NOT NULL,
    collect_date timestamp without time zone,
    notes text,
    checkin_date_time timestamp without time zone,
    checkin_location public.geometry(Point,4326),
    checkin_frontal_photo text,
    checkin_lateral1_photo text,
    checkin_lateral2_photo text,
    checkin_traseira_photo text,
    checkin_odometer_photo text,
    checkin_fuel_level_photo text,
    checkin_damage_photos text[],
    checkin_selfie_photo text,
    checkin_notes text,
    checkout_date_time timestamp without time zone,
    checkout_location public.geometry(Point,4326),
    checkout_approved_by_id character varying,
    checkout_frontal_photo text,
    checkout_lateral1_photo text,
    checkout_lateral2_photo text,
    checkout_traseira_photo text,
    checkout_odometer_photo text,
    checkout_fuel_level_photo text,
    checkout_damage_photos text[],
    checkout_selfie_photo text,
    checkout_notes text,
    created_at timestamp without time zone DEFAULT now(),
    start_latitude character varying(50),
    start_longitude character varying(50),
    end_latitude character varying(50),
    end_longitude character varying(50),
    latitude character varying(50),
    longitude character varying(50)
);


ALTER TABLE public.collects OWNER TO postgres;

--
-- Name: contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.contracts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    contract_number character varying(50) NOT NULL,
    title text NOT NULL,
    driver_id character varying,
    contract_type public.driver_modality NOT NULL,
    status public.contract_status DEFAULT 'ativo'::public.contract_status NOT NULL,
    content text,
    start_date date,
    end_date date,
    payment_type public.payment_type,
    payment_value numeric(12,2),
    truck_type text,
    license_plate character varying(10),
    cnh_required character varying(5),
    work_region text,
    notes text,
    driver_signed_at timestamp without time zone,
    autentique_doc_id character varying,
    autentique_status character varying(50),
    autentique_signed_url text,
    autentique_original_url text,
    autentique_sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.contracts OWNER TO postgres;

--
-- Name: deleted_transports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.deleted_transports (
    id integer NOT NULL,
    original_id integer,
    data jsonb NOT NULL,
    deleted_by integer,
    deleted_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.deleted_transports OWNER TO postgres;

--
-- Name: deleted_transports_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.deleted_transports_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.deleted_transports_id_seq OWNER TO postgres;

--
-- Name: deleted_transports_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.deleted_transports_id_seq OWNED BY public.deleted_transports.id;


--
-- Name: delivery_locations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.delivery_locations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying NOT NULL,
    name text NOT NULL,
    cnpj character varying(20),
    cep character varying(20),
    address text NOT NULL,
    address_number character varying(20),
    complement text,
    neighborhood text,
    city text NOT NULL,
    state character varying(50),
    country character varying(50) DEFAULT 'Brasil'::character varying,
    latitude text,
    longitude text,
    responsible_name text,
    responsible_phone character varying(20),
    emails text[],
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.delivery_locations OWNER TO postgres;

--
-- Name: driver_evaluations; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.driver_evaluations (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    transport_id character varying NOT NULL,
    driver_id character varying NOT NULL,
    evaluator_id character varying NOT NULL,
    evaluator_name text NOT NULL,
    postura_profissional public.rating_value,
    pontualidade public.rating_value,
    apresentacao_pessoal public.rating_value,
    cordialidade public.rating_value,
    cumpriu_processo public.rating_value,
    had_incident text DEFAULT 'false'::text,
    incident_description text,
    average_score numeric(5,2),
    weighted_score numeric(5,2),
    status character varying DEFAULT 'em_andamento'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.driver_evaluations OWNER TO postgres;

--
-- Name: driver_notifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.driver_notifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    yard_id character varying NOT NULL,
    delivery_location_id character varying NOT NULL,
    departure_date date NOT NULL,
    driver_id character varying NOT NULL,
    status public.driver_notification_status DEFAULT 'pendente'::public.driver_notification_status NOT NULL,
    responded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    notified_at timestamp without time zone
);


ALTER TABLE public.driver_notifications OWNER TO postgres;

--
-- Name: drivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.drivers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    cpf character varying(14) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(255),
    birth_date date,
    cep character varying(10),
    address text,
    address_number character varying(20),
    complement text,
    neighborhood text,
    city text,
    state character varying(2),
    latitude text,
    longitude text,
    driver_type public.driver_type,
    modality public.driver_modality,
    cnh_type character varying(5) NOT NULL,
    cnh_front_photo text,
    cnh_back_photo text,
    rg_photo text,
    address_proof_photo text,
    profile_photo text,
    is_apto text DEFAULT 'false'::text,
    is_active text DEFAULT 'true'::text,
    documents_approved text DEFAULT 'pendente'::text,
    documents_approved_at timestamp without time zone,
    documents_approved_by text,
    freight_contract_id character varying,
    created_at timestamp without time zone DEFAULT now(),
    registration_source character varying(20) DEFAULT 'sistema'::character varying,
    device_token text,
    collect_type text DEFAULT 'coleta'::text
);


ALTER TABLE public.drivers OWNER TO postgres;

--
-- Name: evaluation_criteria; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluation_criteria (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    weight numeric(5,2) NOT NULL,
    penalty_leve numeric(5,2) DEFAULT '10'::numeric,
    penalty_medio numeric(5,2) DEFAULT '50'::numeric,
    penalty_grave numeric(5,2) DEFAULT '100'::numeric,
    sort_order integer DEFAULT 0,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.evaluation_criteria OWNER TO postgres;

--
-- Name: evaluation_scores; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.evaluation_scores (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    evaluation_id character varying NOT NULL,
    criteria_id character varying NOT NULL,
    score numeric(5,2) NOT NULL,
    severity public.evaluation_severity DEFAULT 'sem_ocorrencia'::public.evaluation_severity,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.evaluation_scores OWNER TO postgres;

--
-- Name: expense_settlement_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_settlement_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    settlement_id character varying NOT NULL,
    type public.expense_type NOT NULL,
    description text,
    currency character varying(10) DEFAULT 'BRL'::character varying NOT NULL,
    amount text NOT NULL,
    photo_url text NOT NULL,
    photo_status text DEFAULT 'ok'::text,
    photo_rejection_reason text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.expense_settlement_items OWNER TO postgres;

--
-- Name: expense_settlements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.expense_settlements (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    transport_id character varying NOT NULL,
    driver_id character varying NOT NULL,
    status public.expense_settlement_status DEFAULT 'pendente'::public.expense_settlement_status,
    driver_notes text,
    total_expenses text,
    advance_amount text,
    balance_amount text,
    route_distance text,
    estimated_tolls text,
    estimated_fuel text,
    submitted_at timestamp without time zone,
    reviewed_at timestamp without time zone,
    approved_at timestamp without time zone,
    signed_at timestamp without time zone,
    reviewed_by_user_id character varying,
    return_reason text,
    settlement_document_url text,
    driver_signature text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.expense_settlements OWNER TO postgres;

--
-- Name: freight_contracts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.freight_contracts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    contract_number character varying(50) NOT NULL,
    quote_id character varying,
    client_id character varying,
    client_name text NOT NULL,
    client_phone character varying(20),
    client_email character varying(255),
    distancia_km numeric(10,2),
    valor_total_cte numeric(12,2),
    start_date date,
    end_date date,
    status public.contract_status DEFAULT 'ativo'::public.contract_status NOT NULL,
    notes text,
    content text,
    autentique_doc_id character varying,
    autentique_status character varying(50),
    autentique_signed_url text,
    autentique_original_url text,
    autentique_sent_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.freight_contracts OWNER TO postgres;

--
-- Name: freight_quotes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.freight_quotes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    quote_name text,
    client_id character varying,
    client_name text NOT NULL,
    client_phone character varying(20),
    client_email character varying(255),
    valid_until date,
    truck_model_id character varying,
    valor_bem numeric(12,2) NOT NULL,
    distancia_km numeric(10,2) NOT NULL,
    frete_otd numeric(10,2) NOT NULL,
    retorno_motorista numeric(10,2) NOT NULL,
    pedagio numeric(10,2) NOT NULL,
    consumo_veiculo numeric(5,2) NOT NULL,
    preco_diesel numeric(6,2) NOT NULL,
    valor_base numeric(12,2) NOT NULL,
    valor_total_cte numeric(12,2) NOT NULL,
    impostos numeric(12,2) NOT NULL,
    converted_to_contract_id character varying,
    converted_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.freight_quotes OWNER TO postgres;

--
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.manufacturers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    cep character varying(10),
    address text,
    address_number character varying(20),
    complement text,
    neighborhood text,
    city text,
    state character varying(2),
    latitude text,
    longitude text,
    phone character varying(20),
    email character varying(255),
    contact_name text,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.manufacturers OWNER TO postgres;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.password_reset_tokens (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    user_id character varying NOT NULL,
    code character varying(6) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used text DEFAULT 'false'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.password_reset_tokens OWNER TO postgres;

--
-- Name: request_counter; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.request_counter (
    id character varying DEFAULT 'transport_counter'::character varying NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


ALTER TABLE public.request_counter OWNER TO postgres;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.role_permissions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    role public.user_role NOT NULL,
    feature character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.role_permissions OWNER TO postgres;

--
-- Name: routes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.routes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    origin_yard_id character varying NOT NULL,
    destination_location_id character varying NOT NULL,
    distance_km numeric(10,2),
    truck_type public.truck_type DEFAULT '2_eixos'::public.truck_type,
    diesel_price numeric(10,2),
    fuel_consumption numeric(5,2),
    fuel_cost numeric(10,2),
    arla32_cost numeric(10,2),
    toll_cost numeric(10,2),
    driver_daily_cost numeric(10,2),
    return_ticket numeric(10,2),
    extra_expenses numeric(10,2),
    ad_valorem_percentage numeric(5,2),
    vehicle_value numeric(15,2),
    ad_valorem_cost numeric(10,2),
    profit_margin_percentage numeric(5,2),
    admin_fee numeric(10,2),
    total_cost numeric(15,2),
    suggested_price numeric(15,2),
    net_profit numeric(15,2),
    is_favorite text DEFAULT 'false'::text,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.routes OWNER TO postgres;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


ALTER TABLE public.sessions OWNER TO postgres;

--
-- Name: system_users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    role public.user_role DEFAULT 'operador'::public.user_role NOT NULL,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.system_users OWNER TO postgres;

--
-- Name: transfers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transfers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    vehicle_chassi character varying NOT NULL,
    origin_yard_id character varying NOT NULL,
    destination_yard_id character varying NOT NULL,
    requested_by character varying,
    authorized_by character varying,
    status public.transfer_status DEFAULT 'pendente'::public.transfer_status NOT NULL,
    notes text,
    authorized_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    driver_id character varying
);


ALTER TABLE public.transfers OWNER TO postgres;

--
-- Name: transport_checkpoints; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transport_checkpoints (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    transport_id character varying NOT NULL,
    checkpoint_id character varying NOT NULL,
    order_index integer NOT NULL,
    status character varying(20) DEFAULT 'pendente'::character varying NOT NULL,
    reached_at timestamp without time zone,
    latitude text,
    longitude text,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.transport_checkpoints OWNER TO postgres;

--
-- Name: transport_proposal_drivers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transport_proposal_drivers (
    id integer NOT NULL,
    proposal_id integer,
    driver_id character varying,
    status public.proposal_driver_status DEFAULT 'pendente'::public.proposal_driver_status NOT NULL,
    responded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transport_proposal_drivers OWNER TO postgres;

--
-- Name: transport_proposal_drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transport_proposal_drivers_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_proposal_drivers_id_seq OWNER TO postgres;

--
-- Name: transport_proposal_drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transport_proposal_drivers_id_seq OWNED BY public.transport_proposal_drivers.id;


--
-- Name: transport_proposal_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transport_proposal_items (
    id integer NOT NULL,
    proposal_id integer,
    description text NOT NULL,
    quantity integer DEFAULT 1,
    value numeric(10,2)
);


ALTER TABLE public.transport_proposal_items OWNER TO postgres;

--
-- Name: transport_proposal_items_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transport_proposal_items_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_proposal_items_id_seq OWNER TO postgres;

--
-- Name: transport_proposal_items_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transport_proposal_items_id_seq OWNED BY public.transport_proposal_items.id;


--
-- Name: transport_proposal_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transport_proposal_logs (
    id integer NOT NULL,
    proposal_id integer,
    action text NOT NULL,
    performed_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transport_proposal_logs OWNER TO postgres;

--
-- Name: transport_proposal_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transport_proposal_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_proposal_logs_id_seq OWNER TO postgres;

--
-- Name: transport_proposal_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transport_proposal_logs_id_seq OWNED BY public.transport_proposal_logs.id;


--
-- Name: transport_proposals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transport_proposals (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    description text,
    origin character varying(255),
    destination character varying(255),
    departure_date timestamp without time zone,
    return_date timestamp without time zone,
    value numeric(10,2),
    status public.proposal_status DEFAULT 'ativa'::public.proposal_status NOT NULL,
    created_by character varying,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.transport_proposals OWNER TO postgres;

--
-- Name: transport_proposals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transport_proposals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_proposals_id_seq OWNER TO postgres;

--
-- Name: transport_proposals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transport_proposals_id_seq OWNED BY public.transport_proposals.id;


--
-- Name: transports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transports (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    request_number character varying(20) NOT NULL,
    vehicle_chassi character varying(50) NOT NULL,
    client_id character varying NOT NULL,
    origin_yard_id character varying NOT NULL,
    delivery_location_id character varying NOT NULL,
    driver_id character varying,
    travel_rate_id character varying,
    status public.transport_status DEFAULT 'pendente'::public.transport_status NOT NULL,
    delivery_date date,
    notes text,
    documents text[],
    created_at timestamp without time zone DEFAULT now(),
    created_by_user_id character varying,
    driver_assigned_by_user_id character varying,
    driver_assigned_at timestamp without time zone,
    transit_started_at timestamp without time zone,
    checkin_date_time timestamp without time zone,
    checkin_location public.geometry(Point,4326),
    checkin_frontal_photo text,
    checkin_lateral1_photo text,
    checkin_lateral2_photo text,
    checkin_traseira_photo text,
    checkin_odometer_photo text,
    checkin_fuel_level_photo text,
    checkin_damage_photos text[],
    checkin_selfie_photo text,
    checkin_notes text,
    checkout_date_time timestamp without time zone,
    checkout_location public.geometry(Point,4326),
    checkout_frontal_photo text,
    checkout_lateral1_photo text,
    checkout_lateral2_photo text,
    checkout_traseira_photo text,
    checkout_odometer_photo text,
    checkout_fuel_level_photo text,
    checkout_damage_photos text[],
    checkout_selfie_photo text,
    checkout_notes text,
    route_distance_km numeric,
    route_duration_minutes integer,
    estimated_tolls numeric,
    estimated_fuel numeric,
    travel_rate_approval_status text,
    travel_rate_approved_by character varying,
    travel_rate_approved_at timestamp without time zone,
    travel_rate_approval_note text,
    scheduled_departure timestamp without time zone
);


ALTER TABLE public.transports OWNER TO postgres;

--
-- Name: travel_rate_approvers; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.travel_rate_approvers (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    travel_rate_id character varying NOT NULL,
    user_id character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.travel_rate_approvers OWNER TO postgres;

--
-- Name: travel_rates; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.travel_rates (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    origin_city text,
    origin_state character varying(2),
    destination_city text,
    destination_state character varying(2),
    rate_type public.travel_rate_type DEFAULT 'fixo'::public.travel_rate_type NOT NULL,
    rate_value numeric(12,2) NOT NULL,
    min_distance numeric(8,2),
    max_distance numeric(8,2),
    vehicle_type text,
    notes text,
    is_active text DEFAULT 'true'::text,
    requires_approval text DEFAULT 'false'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.travel_rates OWNER TO postgres;

--
-- Name: truck_models; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.truck_models (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    axle_config text NOT NULL,
    average_consumption numeric(5,2) NOT NULL,
    vehicle_value numeric(12,2),
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.truck_models OWNER TO postgres;

--
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    email character varying,
    first_name character varying,
    last_name character varying,
    profile_image_url character varying,
    role character varying(20) DEFAULT 'visualizador'::character varying,
    refresh_token_version timestamp without time zone DEFAULT now(),
    last_login timestamp without time zone,
    is_active character varying(5) DEFAULT 'true'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.users OWNER TO postgres;

--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.vehicles (
    chassi character varying(50) NOT NULL,
    client_id character varying,
    yard_id character varying,
    manufacturer_id character varying,
    color text,
    status public.vehicle_status DEFAULT 'pre_estoque'::public.vehicle_status NOT NULL,
    collect_date_time timestamp without time zone,
    yard_entry_date_time timestamp without time zone,
    dispatch_date_time timestamp without time zone,
    delivery_date_time timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.vehicles OWNER TO postgres;

--
-- Name: yard_monthly_invoice_items; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.yard_monthly_invoice_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    invoice_id character varying NOT NULL,
    chassi character varying NOT NULL,
    yard_name text,
    entry_date timestamp without time zone,
    total_days_in_patio integer DEFAULT 0 NOT NULL,
    days_in_period integer DEFAULT 0 NOT NULL,
    grace_days_applied integer DEFAULT 0 NOT NULL,
    billable_days integer DEFAULT 0 NOT NULL,
    daily_cost text DEFAULT '0'::text NOT NULL,
    subtotal text DEFAULT '0'::text NOT NULL
);


ALTER TABLE public.yard_monthly_invoice_items OWNER TO postgres;

--
-- Name: yard_monthly_invoices; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.yard_monthly_invoices (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    client_id character varying,
    client_name text NOT NULL,
    reference_month integer NOT NULL,
    reference_year integer NOT NULL,
    total_value text DEFAULT '0'::text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    payment_date timestamp without time zone,
    daily_cost_snapshot text,
    grace_days_snapshot integer DEFAULT 0,
    notes text,
    generated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.yard_monthly_invoices OWNER TO postgres;

--
-- Name: yards; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.yards (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    cep character varying(10),
    address text,
    address_number character varying(20),
    complement text,
    neighborhood text,
    city text,
    state character varying(2),
    latitude text,
    longitude text,
    phone character varying(20),
    max_vehicles integer,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.yards OWNER TO postgres;

--
-- Name: deleted_transports id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deleted_transports ALTER COLUMN id SET DEFAULT nextval('public.deleted_transports_id_seq'::regclass);


--
-- Name: transport_proposal_drivers id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_drivers ALTER COLUMN id SET DEFAULT nextval('public.transport_proposal_drivers_id_seq'::regclass);


--
-- Name: transport_proposal_items id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_items ALTER COLUMN id SET DEFAULT nextval('public.transport_proposal_items_id_seq'::regclass);


--
-- Name: transport_proposal_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_logs ALTER COLUMN id SET DEFAULT nextval('public.transport_proposal_logs_id_seq'::regclass);


--
-- Name: transport_proposals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposals ALTER COLUMN id SET DEFAULT nextval('public.transport_proposals_id_seq'::regclass);


--
-- Data for Name: api_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.api_logs (id, method, path, status_code, duration_ms, user_id, username, user_role, ip_address, request_body, response_preview, created_at) FROM stdin;
\.


--
-- Data for Name: checkpoints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.checkpoints (id, name, address, city, state, latitude, longitude, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.clients (id, name, cnpj, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, phone, email, contact_name, daily_cost, yard_grace_days, username, password, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: collects; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.collects (id, vehicle_chassi, manufacturer_id, yard_id, driver_id, status, collect_date, notes, checkin_date_time, checkin_location, checkin_frontal_photo, checkin_lateral1_photo, checkin_lateral2_photo, checkin_traseira_photo, checkin_odometer_photo, checkin_fuel_level_photo, checkin_damage_photos, checkin_selfie_photo, checkin_notes, checkout_date_time, checkout_location, checkout_approved_by_id, checkout_frontal_photo, checkout_lateral1_photo, checkout_lateral2_photo, checkout_traseira_photo, checkout_odometer_photo, checkout_fuel_level_photo, checkout_damage_photos, checkout_selfie_photo, checkout_notes, created_at, start_latitude, start_longitude, end_latitude, end_longitude, latitude, longitude) FROM stdin;
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.contracts (id, contract_number, title, driver_id, contract_type, status, content, start_date, end_date, payment_type, payment_value, truck_type, license_plate, cnh_required, work_region, notes, driver_signed_at, autentique_doc_id, autentique_status, autentique_signed_url, autentique_original_url, autentique_sent_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: deleted_transports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.deleted_transports (id, original_id, data, deleted_by, deleted_at) FROM stdin;
\.


--
-- Data for Name: delivery_locations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.delivery_locations (id, client_id, name, cnpj, cep, address, address_number, complement, neighborhood, city, state, country, latitude, longitude, responsible_name, responsible_phone, emails, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: driver_evaluations; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.driver_evaluations (id, transport_id, driver_id, evaluator_id, evaluator_name, postura_profissional, pontualidade, apresentacao_pessoal, cordialidade, cumpriu_processo, had_incident, incident_description, average_score, weighted_score, status, created_at) FROM stdin;
\.


--
-- Data for Name: driver_notifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.driver_notifications (id, yard_id, delivery_location_id, departure_date, driver_id, status, responded_at, created_at, notified_at) FROM stdin;
\.


--
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.drivers (id, name, cpf, phone, email, birth_date, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, driver_type, modality, cnh_type, cnh_front_photo, cnh_back_photo, rg_photo, address_proof_photo, profile_photo, is_apto, is_active, documents_approved, documents_approved_at, documents_approved_by, freight_contract_id, created_at, registration_source, device_token, collect_type) FROM stdin;
\.


--
-- Data for Name: evaluation_criteria; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evaluation_criteria (id, name, weight, penalty_leve, penalty_medio, penalty_grave, sort_order, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: evaluation_scores; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.evaluation_scores (id, evaluation_id, criteria_id, score, severity, notes, created_at) FROM stdin;
\.


--
-- Data for Name: expense_settlement_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_settlement_items (id, settlement_id, type, description, currency, amount, photo_url, photo_status, photo_rejection_reason, created_at) FROM stdin;
\.


--
-- Data for Name: expense_settlements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.expense_settlements (id, transport_id, driver_id, status, driver_notes, total_expenses, advance_amount, balance_amount, route_distance, estimated_tolls, estimated_fuel, submitted_at, reviewed_at, approved_at, signed_at, reviewed_by_user_id, return_reason, settlement_document_url, driver_signature, created_at) FROM stdin;
\.


--
-- Data for Name: freight_contracts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.freight_contracts (id, contract_number, quote_id, client_id, client_name, client_phone, client_email, distancia_km, valor_total_cte, start_date, end_date, status, notes, content, autentique_doc_id, autentique_status, autentique_signed_url, autentique_original_url, autentique_sent_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: freight_quotes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.freight_quotes (id, quote_name, client_id, client_name, client_phone, client_email, valid_until, truck_model_id, valor_bem, distancia_km, frete_otd, retorno_motorista, pedagio, consumo_veiculo, preco_diesel, valor_base, valor_total_cte, impostos, converted_to_contract_id, converted_at, created_at) FROM stdin;
\.


--
-- Data for Name: manufacturers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.manufacturers (id, name, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, phone, email, contact_name, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.password_reset_tokens (id, user_id, code, expires_at, used, created_at) FROM stdin;
\.


--
-- Data for Name: request_counter; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.request_counter (id, last_number) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.role_permissions (id, role, feature, created_at) FROM stdin;
\.


--
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.routes (id, name, origin_yard_id, destination_location_id, distance_km, truck_type, diesel_price, fuel_consumption, fuel_cost, arla32_cost, toll_cost, driver_daily_cost, return_ticket, extra_expenses, ad_valorem_percentage, vehicle_value, ad_valorem_cost, profit_margin_percentage, admin_fee, total_cost, suggested_price, net_profit, is_favorite, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.sessions (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- Data for Name: system_users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_users (id, name, email, username, password, role, is_active, created_at) FROM stdin;
d215419c-23ba-4498-bb57-42d383706394	Administrador	admin@otdentregas.com	admin	$2b$10$f4ctke5xwsNUyu8JsA1oq.ujE6gRNKodhv5frtewAQLBrlpeIhOLO	admin	true	2026-04-22 02:59:11.77621
\.


--
-- Data for Name: transfers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transfers (id, vehicle_chassi, origin_yard_id, destination_yard_id, requested_by, authorized_by, status, notes, authorized_at, completed_at, created_at, driver_id) FROM stdin;
\.


--
-- Data for Name: transport_checkpoints; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transport_checkpoints (id, transport_id, checkpoint_id, order_index, status, reached_at, latitude, longitude, notes, created_at) FROM stdin;
\.


--
-- Data for Name: transport_proposal_drivers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transport_proposal_drivers (id, proposal_id, driver_id, status, responded_at, created_at) FROM stdin;
\.


--
-- Data for Name: transport_proposal_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transport_proposal_items (id, proposal_id, description, quantity, value) FROM stdin;
\.


--
-- Data for Name: transport_proposal_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transport_proposal_logs (id, proposal_id, action, performed_by, created_at) FROM stdin;
\.


--
-- Data for Name: transport_proposals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transport_proposals (id, title, description, origin, destination, departure_date, return_date, value, status, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: transports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transports (id, request_number, vehicle_chassi, client_id, origin_yard_id, delivery_location_id, driver_id, travel_rate_id, status, delivery_date, notes, documents, created_at, created_by_user_id, driver_assigned_by_user_id, driver_assigned_at, transit_started_at, checkin_date_time, checkin_location, checkin_frontal_photo, checkin_lateral1_photo, checkin_lateral2_photo, checkin_traseira_photo, checkin_odometer_photo, checkin_fuel_level_photo, checkin_damage_photos, checkin_selfie_photo, checkin_notes, checkout_date_time, checkout_location, checkout_frontal_photo, checkout_lateral1_photo, checkout_lateral2_photo, checkout_traseira_photo, checkout_odometer_photo, checkout_fuel_level_photo, checkout_damage_photos, checkout_selfie_photo, checkout_notes, route_distance_km, route_duration_minutes, estimated_tolls, estimated_fuel, travel_rate_approval_status, travel_rate_approved_by, travel_rate_approved_at, travel_rate_approval_note, scheduled_departure) FROM stdin;
\.


--
-- Data for Name: travel_rate_approvers; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.travel_rate_approvers (id, travel_rate_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: travel_rates; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.travel_rates (id, name, origin_city, origin_state, destination_city, destination_state, rate_type, rate_value, min_distance, max_distance, vehicle_type, notes, is_active, requires_approval, created_at) FROM stdin;
\.


--
-- Data for Name: truck_models; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.truck_models (id, brand, model, axle_config, average_consumption, vehicle_value, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, username, password_hash, email, first_name, last_name, profile_image_url, role, refresh_token_version, last_login, is_active, created_at, updated_at) FROM stdin;
91d8b188-075a-4b3c-b150-2c9693417418	admin	$2b$10$44l8t010zHM50koqIhB3bOcz4KBNHyMWfFm28TOcUP5nd4/NdRaVe	admin@otdentregas.com	Administrador	Sistema	\N	admin	2026-04-22 02:59:17.932987	\N	true	2026-04-22 02:59:17.932987	2026-04-22 02:59:17.932987
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.vehicles (chassi, client_id, yard_id, manufacturer_id, color, status, collect_date_time, yard_entry_date_time, dispatch_date_time, delivery_date_time, notes, created_at) FROM stdin;
\.


--
-- Data for Name: yard_monthly_invoice_items; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.yard_monthly_invoice_items (id, invoice_id, chassi, yard_name, entry_date, total_days_in_patio, days_in_period, grace_days_applied, billable_days, daily_cost, subtotal) FROM stdin;
\.


--
-- Data for Name: yard_monthly_invoices; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.yard_monthly_invoices (id, client_id, client_name, reference_month, reference_year, total_value, status, payment_date, daily_cost_snapshot, grace_days_snapshot, notes, generated_at) FROM stdin;
\.


--
-- Data for Name: yards; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.yards (id, name, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, phone, max_vehicles, is_active, created_at) FROM stdin;
\.


--
-- Name: deleted_transports_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.deleted_transports_id_seq', 1, false);


--
-- Name: transport_proposal_drivers_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transport_proposal_drivers_id_seq', 1, false);


--
-- Name: transport_proposal_items_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transport_proposal_items_id_seq', 1, false);


--
-- Name: transport_proposal_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transport_proposal_logs_id_seq', 1, false);


--
-- Name: transport_proposals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transport_proposals_id_seq', 1, false);


--
-- Name: api_logs api_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.api_logs
    ADD CONSTRAINT api_logs_pkey PRIMARY KEY (id);


--
-- Name: checkpoints checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: collects collects_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_unique UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: deleted_transports deleted_transports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.deleted_transports
    ADD CONSTRAINT deleted_transports_pkey PRIMARY KEY (id);


--
-- Name: delivery_locations delivery_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_locations
    ADD CONSTRAINT delivery_locations_pkey PRIMARY KEY (id);


--
-- Name: driver_evaluations driver_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_evaluations
    ADD CONSTRAINT driver_evaluations_pkey PRIMARY KEY (id);


--
-- Name: driver_notifications driver_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_cpf_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_cpf_unique UNIQUE (cpf);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: evaluation_criteria evaluation_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_criteria
    ADD CONSTRAINT evaluation_criteria_pkey PRIMARY KEY (id);


--
-- Name: evaluation_scores evaluation_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_scores
    ADD CONSTRAINT evaluation_scores_pkey PRIMARY KEY (id);


--
-- Name: expense_settlement_items expense_settlement_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_settlement_items
    ADD CONSTRAINT expense_settlement_items_pkey PRIMARY KEY (id);


--
-- Name: expense_settlements expense_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_pkey PRIMARY KEY (id);


--
-- Name: freight_contracts freight_contracts_contract_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freight_contracts
    ADD CONSTRAINT freight_contracts_contract_number_unique UNIQUE (contract_number);


--
-- Name: freight_contracts freight_contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freight_contracts
    ADD CONSTRAINT freight_contracts_pkey PRIMARY KEY (id);


--
-- Name: freight_quotes freight_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.freight_quotes
    ADD CONSTRAINT freight_quotes_pkey PRIMARY KEY (id);


--
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: request_counter request_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.request_counter
    ADD CONSTRAINT request_counter_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: system_users system_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_email_unique UNIQUE (email);


--
-- Name: system_users system_users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_pkey PRIMARY KEY (id);


--
-- Name: system_users system_users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_username_unique UNIQUE (username);


--
-- Name: transfers transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_pkey PRIMARY KEY (id);


--
-- Name: transport_checkpoints transport_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_checkpoints
    ADD CONSTRAINT transport_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: transport_proposal_drivers transport_proposal_drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_drivers
    ADD CONSTRAINT transport_proposal_drivers_pkey PRIMARY KEY (id);


--
-- Name: transport_proposal_items transport_proposal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_items
    ADD CONSTRAINT transport_proposal_items_pkey PRIMARY KEY (id);


--
-- Name: transport_proposal_logs transport_proposal_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_logs
    ADD CONSTRAINT transport_proposal_logs_pkey PRIMARY KEY (id);


--
-- Name: transport_proposals transport_proposals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposals
    ADD CONSTRAINT transport_proposals_pkey PRIMARY KEY (id);


--
-- Name: transports transports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_pkey PRIMARY KEY (id);


--
-- Name: transports transports_request_number_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_request_number_unique UNIQUE (request_number);


--
-- Name: travel_rate_approvers travel_rate_approvers_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_rate_approvers
    ADD CONSTRAINT travel_rate_approvers_pkey PRIMARY KEY (id);


--
-- Name: travel_rates travel_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_rates
    ADD CONSTRAINT travel_rates_pkey PRIMARY KEY (id);


--
-- Name: truck_models truck_models_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.truck_models
    ADD CONSTRAINT truck_models_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (chassi);


--
-- Name: yard_monthly_invoice_items yard_monthly_invoice_items_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yard_monthly_invoice_items
    ADD CONSTRAINT yard_monthly_invoice_items_pkey PRIMARY KEY (id);


--
-- Name: yard_monthly_invoices yard_monthly_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yard_monthly_invoices
    ADD CONSTRAINT yard_monthly_invoices_pkey PRIMARY KEY (id);


--
-- Name: yards yards_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.yards
    ADD CONSTRAINT yards_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: collects collects_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: collects collects_manufacturer_id_manufacturers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_manufacturer_id_manufacturers_id_fk FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- Name: collects collects_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_yard_id_yards_id_fk FOREIGN KEY (yard_id) REFERENCES public.yards(id);


--
-- Name: contracts contracts_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: delivery_locations delivery_locations_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.delivery_locations
    ADD CONSTRAINT delivery_locations_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: driver_evaluations driver_evaluations_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_evaluations
    ADD CONSTRAINT driver_evaluations_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_evaluations driver_evaluations_transport_id_transports_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_evaluations
    ADD CONSTRAINT driver_evaluations_transport_id_transports_id_fk FOREIGN KEY (transport_id) REFERENCES public.transports(id);


--
-- Name: driver_notifications driver_notifications_delivery_location_id_delivery_locations_id; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_delivery_location_id_delivery_locations_id FOREIGN KEY (delivery_location_id) REFERENCES public.delivery_locations(id);


--
-- Name: driver_notifications driver_notifications_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_notifications driver_notifications_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_yard_id_yards_id_fk FOREIGN KEY (yard_id) REFERENCES public.yards(id);


--
-- Name: evaluation_scores evaluation_scores_criteria_id_evaluation_criteria_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_scores
    ADD CONSTRAINT evaluation_scores_criteria_id_evaluation_criteria_id_fk FOREIGN KEY (criteria_id) REFERENCES public.evaluation_criteria(id);


--
-- Name: evaluation_scores evaluation_scores_evaluation_id_driver_evaluations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.evaluation_scores
    ADD CONSTRAINT evaluation_scores_evaluation_id_driver_evaluations_id_fk FOREIGN KEY (evaluation_id) REFERENCES public.driver_evaluations(id);


--
-- Name: expense_settlement_items expense_settlement_items_settlement_id_expense_settlements_id_f; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_settlement_items
    ADD CONSTRAINT expense_settlement_items_settlement_id_expense_settlements_id_f FOREIGN KEY (settlement_id) REFERENCES public.expense_settlements(id);


--
-- Name: expense_settlements expense_settlements_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: expense_settlements expense_settlements_reviewed_by_user_id_system_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_reviewed_by_user_id_system_users_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public.system_users(id);


--
-- Name: expense_settlements expense_settlements_transport_id_transports_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_transport_id_transports_id_fk FOREIGN KEY (transport_id) REFERENCES public.transports(id);


--
-- Name: routes routes_destination_location_id_delivery_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_destination_location_id_delivery_locations_id_fk FOREIGN KEY (destination_location_id) REFERENCES public.delivery_locations(id);


--
-- Name: routes routes_origin_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_origin_yard_id_yards_id_fk FOREIGN KEY (origin_yard_id) REFERENCES public.yards(id);


--
-- Name: transfers transfers_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfers
    ADD CONSTRAINT transfers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: transport_checkpoints transport_checkpoints_checkpoint_id_checkpoints_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_checkpoints
    ADD CONSTRAINT transport_checkpoints_checkpoint_id_checkpoints_id_fk FOREIGN KEY (checkpoint_id) REFERENCES public.checkpoints(id);


--
-- Name: transport_checkpoints transport_checkpoints_transport_id_transports_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_checkpoints
    ADD CONSTRAINT transport_checkpoints_transport_id_transports_id_fk FOREIGN KEY (transport_id) REFERENCES public.transports(id);


--
-- Name: transport_proposal_drivers transport_proposal_drivers_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_drivers
    ADD CONSTRAINT transport_proposal_drivers_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: transport_proposal_drivers transport_proposal_drivers_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_drivers
    ADD CONSTRAINT transport_proposal_drivers_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.transport_proposals(id);


--
-- Name: transport_proposal_items transport_proposal_items_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_items
    ADD CONSTRAINT transport_proposal_items_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.transport_proposals(id);


--
-- Name: transport_proposal_logs transport_proposal_logs_performed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_logs
    ADD CONSTRAINT transport_proposal_logs_performed_by_fkey FOREIGN KEY (performed_by) REFERENCES public.system_users(id);


--
-- Name: transport_proposal_logs transport_proposal_logs_proposal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposal_logs
    ADD CONSTRAINT transport_proposal_logs_proposal_id_fkey FOREIGN KEY (proposal_id) REFERENCES public.transport_proposals(id);


--
-- Name: transport_proposals transport_proposals_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transport_proposals
    ADD CONSTRAINT transport_proposals_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.system_users(id);


--
-- Name: transports transports_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: transports transports_delivery_location_id_delivery_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_delivery_location_id_delivery_locations_id_fk FOREIGN KEY (delivery_location_id) REFERENCES public.delivery_locations(id);


--
-- Name: transports transports_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: transports transports_origin_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_origin_yard_id_yards_id_fk FOREIGN KEY (origin_yard_id) REFERENCES public.yards(id);


--
-- Name: transports transports_vehicle_chassi_vehicles_chassi_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_vehicle_chassi_vehicles_chassi_fk FOREIGN KEY (vehicle_chassi) REFERENCES public.vehicles(chassi);


--
-- Name: travel_rate_approvers travel_rate_approvers_travel_rate_id_travel_rates_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_rate_approvers
    ADD CONSTRAINT travel_rate_approvers_travel_rate_id_travel_rates_id_fk FOREIGN KEY (travel_rate_id) REFERENCES public.travel_rates(id) ON DELETE CASCADE;


--
-- Name: travel_rate_approvers travel_rate_approvers_user_id_system_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.travel_rate_approvers
    ADD CONSTRAINT travel_rate_approvers_user_id_system_users_id_fk FOREIGN KEY (user_id) REFERENCES public.system_users(id) ON DELETE CASCADE;


--
-- Name: vehicles vehicles_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: vehicles vehicles_manufacturer_id_manufacturers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_manufacturer_id_manufacturers_id_fk FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- Name: vehicles vehicles_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_yard_id_yards_id_fk FOREIGN KEY (yard_id) REFERENCES public.yards(id);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: postgres
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO PUBLIC;


--
-- PostgreSQL database dump complete
--

\unrestrict 9eL48PxoCJHaJQ3SwRRBhMlRMhtExwVcSfhcfRSEL3Lt6c8LCd5GgARBYz99m9R

