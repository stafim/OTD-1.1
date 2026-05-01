--
-- PostgreSQL database dump
--

\restrict Dxk4aD1lrlWjZIqKdMSMcGbaoSrgFTSWHCJRRjaqrWT65N9J3xuBUhbeIoBGt3x

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
-- Name: collect_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.collect_status AS ENUM (
    'em_transito',
    'aguardando_checkout',
    'finalizada'
);


--
-- Name: contract_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.contract_status AS ENUM (
    'ativo',
    'suspenso',
    'expirado',
    'cancelado'
);


--
-- Name: driver_modality; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_modality AS ENUM (
    'pj',
    'clt',
    'agregado'
);


--
-- Name: driver_notification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_notification_status AS ENUM (
    'pendente',
    'aceito',
    'recusado'
);


--
-- Name: driver_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.driver_type AS ENUM (
    'coleta',
    'transporte'
);


--
-- Name: evaluation_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.evaluation_severity AS ENUM (
    'sem_ocorrencia',
    'leve',
    'medio',
    'grave'
);


--
-- Name: expense_settlement_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.expense_settlement_status AS ENUM (
    'pendente',
    'enviado',
    'devolvido',
    'aprovado',
    'assinado'
);


--
-- Name: expense_type; Type: TYPE; Schema: public; Owner: -
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


--
-- Name: payment_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_type AS ENUM (
    'por_km',
    'fixo_mensal',
    'por_entrega',
    'comissao'
);


--
-- Name: rating_value; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.rating_value AS ENUM (
    'pessimo',
    'ruim',
    'regular',
    'bom',
    'excelente'
);


--
-- Name: transport_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transport_status AS ENUM (
    'pendente',
    'aguardando_saida',
    'em_transito',
    'entregue',
    'cancelado'
);


--
-- Name: truck_type; Type: TYPE; Schema: public; Owner: -
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


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'operador',
    'visualizador'
);


--
-- Name: vehicle_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.vehicle_status AS ENUM (
    'pre_estoque',
    'em_estoque',
    'despachado',
    'entregue',
    'retirado'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: checkpoints; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: clients; Type: TABLE; Schema: public; Owner: -
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
    username character varying(100),
    password character varying(255),
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: collects; Type: TABLE; Schema: public; Owner: -
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
    checkin_latitude text,
    checkin_longitude text,
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
    checkout_latitude text,
    checkout_longitude text,
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
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: contracts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.contracts (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    contract_number character varying(50) NOT NULL,
    driver_id character varying,
    contract_type public.driver_modality NOT NULL,
    status public.contract_status DEFAULT 'ativo'::public.contract_status NOT NULL,
    start_date date,
    end_date date,
    payment_type public.payment_type,
    payment_value numeric(12,2),
    truck_type text,
    license_plate character varying(10),
    cnh_required character varying(5),
    work_region text,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    title text NOT NULL,
    content text
);


--
-- Name: delivery_locations; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: driver_evaluations; Type: TABLE; Schema: public; Owner: -
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
    created_at timestamp without time zone DEFAULT now(),
    weighted_score numeric(5,2)
);


--
-- Name: driver_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.driver_notifications (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    yard_id character varying NOT NULL,
    delivery_location_id character varying NOT NULL,
    departure_date date NOT NULL,
    driver_id character varying NOT NULL,
    status public.driver_notification_status DEFAULT 'pendente'::public.driver_notification_status NOT NULL,
    responded_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: drivers; Type: TABLE; Schema: public; Owner: -
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
    modality public.driver_modality,
    cnh_type character varying(5) NOT NULL,
    cnh_front_photo text,
    cnh_back_photo text,
    profile_photo text,
    is_apto text DEFAULT 'false'::text,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now(),
    documents_approved text DEFAULT 'pendente'::text,
    documents_approved_at timestamp without time zone,
    documents_approved_by text,
    driver_type public.driver_type
);


--
-- Name: evaluation_criteria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_criteria (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    weight numeric(5,2) NOT NULL,
    sort_order integer DEFAULT 0,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now(),
    penalty_leve numeric(5,2) DEFAULT '10'::numeric,
    penalty_medio numeric(5,2) DEFAULT '50'::numeric,
    penalty_grave numeric(5,2) DEFAULT '100'::numeric
);


--
-- Name: evaluation_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evaluation_scores (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    evaluation_id character varying NOT NULL,
    criteria_id character varying NOT NULL,
    score numeric(5,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    severity public.evaluation_severity DEFAULT 'sem_ocorrencia'::public.evaluation_severity
);


--
-- Name: expense_settlement_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.expense_settlement_items (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    settlement_id character varying NOT NULL,
    type public.expense_type NOT NULL,
    description text,
    amount text NOT NULL,
    photo_url text NOT NULL,
    photo_status text DEFAULT 'ok'::text,
    photo_rejection_reason text,
    created_at timestamp without time zone DEFAULT now(),
    currency character varying(10) DEFAULT 'BRL'::character varying NOT NULL
);


--
-- Name: expense_settlements; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: freight_quotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.freight_quotes (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
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
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: manufacturers; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: request_counter; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_counter (
    id character varying DEFAULT 'transport_counter'::character varying NOT NULL,
    last_number integer DEFAULT 0 NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    role public.user_role NOT NULL,
    feature character varying(50) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: routes; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    sid character varying NOT NULL,
    sess jsonb NOT NULL,
    expire timestamp without time zone NOT NULL
);


--
-- Name: system_users; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: transport_checkpoints; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: transports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transports (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    request_number character varying(20) NOT NULL,
    vehicle_chassi character varying(50) NOT NULL,
    client_id character varying NOT NULL,
    origin_yard_id character varying NOT NULL,
    delivery_location_id character varying NOT NULL,
    driver_id character varying,
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
    checkin_latitude text,
    checkin_longitude text,
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
    checkout_latitude text,
    checkout_longitude text,
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
    estimated_fuel numeric
);


--
-- Name: truck_models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.truck_models (
    id character varying DEFAULT gen_random_uuid() NOT NULL,
    brand text NOT NULL,
    model text NOT NULL,
    axle_config text NOT NULL,
    average_consumption numeric(5,2) NOT NULL,
    is_active text DEFAULT 'true'::text,
    created_at timestamp without time zone DEFAULT now(),
    vehicle_value numeric(12,2)
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: -
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


--
-- Name: yards; Type: TABLE; Schema: public; Owner: -
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


--
-- Data for Name: checkpoints; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.checkpoints (id, name, address, city, state, latitude, longitude, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: clients; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.clients (id, name, cnpj, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, phone, email, contact_name, daily_cost, username, password, is_active, created_at) FROM stdin;
e95751ef-8da0-4e95-9607-152552b2b1c2	Treviso Betim	59.104.760/0001-91	\N	Av. Toyota, 1000	\N	\N	Centro	São Bernardo do Campo	SP	\N	\N	11987654321	contato@brasilcargo.com.br	José Roberto Silva	\N	\N	\N	true	2026-01-23 12:02:18.428037
30955428-ee26-4ccb-acca-79290271cba1	Nors São Paulo	01.188.855/0001-52	\N	Rod. Anhanguera, Km 104	\N	\N	Distrito Industrial	Sumaré	SP	\N	\N	11988776655	frota@expressul.com.br	Marcos Antônio Pereira	\N	\N	\N	true	2026-01-23 12:02:18.428037
983a543a-931c-48b1-86d0-1e4df69d64d2	Dipesul	59.104.422/0001-50	\N	Via Anchieta, 1500	\N	\N	Demarchi	São Bernardo do Campo	SP	\N	\N	11977665544	logistica@uniaotransporte.com.br	Wagner Souza Lima	\N	\N	\N	true	2026-01-23 12:02:18.428037
75a4b18e-f1a3-4244-8811-0e6e26d84667	Suecia Matriz	16.701.716/0001-56	\N	Av. Fiat, 2000	\N	\N	Citrolândia	Betim	MG	\N	\N	31966554433	operacoes@frotanacional.com.br	Cláudio Ferreira Santos	\N	\N	\N	true	2026-01-23 12:02:18.428037
84775f12-cc49-4873-9cb6-5a4d13c8366b	Laponia	59.275.792/0001-50	\N	Av. Goiás, 1800	\N	\N	Barcelona	São Caetano do Sul	SP	\N	\N	11955443322	comercial@rapidosudeste.com.br	Paulo César Oliveira	\N	\N	\N	true	2026-01-23 12:02:18.428037
d8445226-b6a2-4628-bff6-489cfd299573	Treviso Pernambuco	00.913.443/0001-73	\N	Av. Renault, 1300	\N	\N	Borda do Campo	São José dos Pinhais	PR	\N	\N	41944332211	frota@cargaspesadas.com.br	Eduardo Martins Costa	\N	\N	\N	true	2026-01-23 12:02:18.428037
74cdde0c-ade3-484f-aba0-252c77b5490d	Nors Rio de Janeiro	01.258.466/0001-62	\N	Rod. Luiz de Queiroz, Km 157	\N	\N	Distrito Industrial	Piracicaba	SP	\N	\N	15933221100	entregas@distcentrooeste.com.br	Rodrigo Alves Nunes	\N	\N	\N	true	2026-01-23 12:02:18.428037
5cc6ef4b-4009-4121-b049-03dd5775bb34	Nors Pará	59.104.440/0001-31	\N	Rod. Presidente Dutra, Km 302	\N	\N	Polo Industrial	Resende	RJ	\N	\N	21922110099	operacao@translogrio.com.br	Alexandre Gomes Ribeiro	\N	\N	\N	true	2026-01-23 12:02:18.428037
\.


--
-- Data for Name: collects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.collects (id, vehicle_chassi, manufacturer_id, yard_id, driver_id, status, collect_date, notes, checkin_date_time, checkin_latitude, checkin_longitude, checkin_frontal_photo, checkin_lateral1_photo, checkin_lateral2_photo, checkin_traseira_photo, checkin_odometer_photo, checkin_fuel_level_photo, checkin_damage_photos, checkin_selfie_photo, checkin_notes, checkout_date_time, checkout_latitude, checkout_longitude, checkout_approved_by_id, checkout_frontal_photo, checkout_lateral1_photo, checkout_lateral2_photo, checkout_traseira_photo, checkout_odometer_photo, checkout_fuel_level_photo, checkout_damage_photos, checkout_selfie_photo, checkout_notes, created_at) FROM stdin;
1f8a611e-0b30-4ee4-93a0-bcc86eda7c29	9BW G4GH74 TP7 53	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	91aca4b3-71b9-45d0-a163-1319b792c56d	985eab5f-6f2e-4ffa-9dfd-b6f693cab200	aguardando_checkout	2026-01-23 09:17:00		2026-01-23 12:18:41.237	-25.444	-49.33990	/uploads/1476567c-f87b-43b1-aecc-a7a7ca704a2e.PNG	/uploads/f120dff4-00cb-4275-8235-40dcb8dda266.PNG	/uploads/74198963-34d6-4703-9516-98df1d86f996.PNG	/uploads/c8298b17-8045-4c92-a5ed-b1748f35326a.PNG	/uploads/25e699de-874b-4776-9c21-56f45e8631ce.PNG	/uploads/fb0c1dd2-96d7-47ca-b2e0-d033b8125ace.PNG	{/uploads/7a5bc5f3-4877-4a9f-bdee-b7d7396f28a0.PNG}	/uploads/9f676f24-20d5-4cd9-9fa2-1f99e6c6cc79.PNG		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-23 12:17:46.860906
e9431a9a-f366-44c0-8abd-f32fa2f78ecd	93939393939393939	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	91aca4b3-71b9-45d0-a163-1319b792c56d	23fbc336-ce20-4ba2-9c11-2c700ea74904	aguardando_checkout	2026-01-23 11:05:00		2026-01-23 14:07:03.336									{}	/uploads/3beec462-d1ae-4820-b1db-b1bbfd2e4715.jpg		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-23 14:06:20.904535
d70b5308-c06c-4f3f-abcf-fd7cdeee97d8	39949494944398389	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	91aca4b3-71b9-45d0-a163-1319b792c56d	b6cdfd0d-4576-4e56-bc1b-e4c8caf3db77	aguardando_checkout	2026-02-12 09:34:00		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-02-12 12:35:48.089389
23303f3a-6604-4221-b17d-691ac70835d6	9BW VH9DCX TH0 71	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	91aca4b3-71b9-45d0-a163-1319b792c56d	0725d757-afa2-42ca-b141-5349e5434e6e	aguardando_checkout	2026-01-23 10:17:00		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-01-23 13:17:44.285479
b38119e7-7a6e-4648-90b2-3e422cb0c7cb	90943243209432809	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	91aca4b3-71b9-45d0-a163-1319b792c56d	23fbc336-ce20-4ba2-9c11-2c700ea74904	em_transito	2026-02-19 10:30:00		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-02-19 13:30:59.719101
6a8d4cba-8176-4117-960b-b7ee7d42d0d3	43280948204983280	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	91aca4b3-71b9-45d0-a163-1319b792c56d	0725d757-afa2-42ca-b141-5349e5434e6e	aguardando_checkout	2026-02-19 10:16:00		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-02-19 13:17:43.976868
451f6d65-9a4a-4e3f-b69c-43470fe12fc8	23112313213231232	dfd93366-11fa-44be-b42b-186cf7a565a5	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	b6cdfd0d-4576-4e56-bc1b-e4c8caf3db77	finalizada	2026-02-28 15:20:00		\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-02-28 18:20:54.749158
\.


--
-- Data for Name: contracts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.contracts (id, contract_number, driver_id, contract_type, status, start_date, end_date, payment_type, payment_value, truck_type, license_plate, cnh_required, work_region, notes, created_at, updated_at, title, content) FROM stdin;
aa74bced-2c78-4ecc-bd17-803ae7a18557	OTD0001	\N	pj	ativo	\N	\N	\N	\N	\N	\N	\N	\N	\N	2026-02-19 04:18:43.011486	2026-02-19 04:18:43.011486	Contrato de prestação de serviços PJ Rodando	<h2>Contrato de Prestação de Serviços de Transporte de Cargas</h2><p><strong>CONTRATANTE:</strong> <strong>OTD Logistics</strong>, inscrita no CNPJ sob o nº [Inserir CNPJ], com sede em [Endereço Completo].</p><p><strong>CONTRATADO:</strong> [Nome da Empresa do Motorista], inscrita no CNPJ sob o nº [Inserir CNPJ], representada por [Nome do Motorista], portador do CPF nº [Inserir CPF] e CNH Categoria [Inserir Categoria].</p><h3>1. Objeto do Serviço</h3><p>O objeto deste contrato é a prestação de serviços de transporte rodoviário de cargas, de forma <strong>eventual e não exclusiva</strong>, conforme a demanda da CONTRATANTE e disponibilidade do CONTRATADO.</p><h3>2. Natureza da Relação (Cláusula de Segurança Jurídica)</h3><p>As partes declaram que este contrato é de natureza estritamente <strong>civil/comercial</strong>.</p><ul><li><p><strong>Sem Vínculo:</strong> Não existe subordinação hierárquica, dependência econômica ou horários fixos de jornada.</p></li><li><p><strong>Autonomia:</strong> O CONTRATADO tem plena autonomia para aceitar ou recusar os fretes oferecidos, bem como para prestar serviços a terceiros.</p></li></ul><h3>3. Remuneração e Pagamento</h3><p>O pagamento será realizado por <strong>frete efetivado</strong>, mediante a apresentação de Nota Fiscal de Serviços e comprovantes de entrega (canhotos).</p><ul><li><p>O valor será pactuado previamente a cada viagem (Ordem de Serviço).</p></li><li><p>A CONTRATANTE não se responsabiliza por encargos previdenciários, trabalhistas ou tributários da empresa CONTRATADA.</p></li></ul><h3>4. Responsabilidades do Motorista (PJ)</h3><ul><li><p><strong>Manutenção:</strong> Custos com combustível, pneus, manutenção mecânica e conservação do veículo são de inteira responsabilidade do CONTRATADO.</p></li><li><p><strong>Documentação:</strong> Manter em dia o Registro Nacional de Transportadores Rodoviários de Carga (<strong>RNTRC/ANTT</strong>), além de impostos e seguros obrigatórios.</p></li><li><p><strong>Segurança:</strong> Cumprir as normas de trânsito e as diretrizes de gerenciamento de risco (rastreamento e monitoramento).</p></li></ul><h3>5. Responsabilidade Civil e Cargas</h3><p>O CONTRATADO responde por danos causados à carga, ao veículo ou a terceiros durante a execução do trajeto, salvo quando houver contratação de seguro específico pela CONTRATANTE para a mercadoria.</p><h3>6. Rescisão</h3><p>Por se tratar de um contrato de natureza esporádica, qualquer uma das partes poderá rescindi-lo a qualquer momento, mediante aviso prévio por escrito de [15] dias, sem direito a indenizações trabalhistas.</p><h3>7. Foro</h3><p>Fica eleito o foro da comarca de [Sua Cidade/UF] para dirimir quaisquer dúvidas oriundas deste instrumento.</p>
\.


--
-- Data for Name: delivery_locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.delivery_locations (id, client_id, name, cnpj, cep, address, address_number, complement, neighborhood, city, state, country, latitude, longitude, responsible_name, responsible_phone, emails, is_active, created_at) FROM stdin;
adf58ba1-3136-45dc-848f-4fefbe6c648e	e95751ef-8da0-4e95-9607-152552b2b1c2	Treviso Betim Filial Santos	\N	\N	Av. Ana Costa	500	\N	Gonzaga	Santos	SP	Brasil	-23.9608	-46.3336	Beatriz Rocha	13966665555	{entregas.santos@toyota.com.br}	true	2026-01-23 12:09:31.127139
64e6413f-2c0c-47a0-beb9-929e846fe1b7	75a4b18e-f1a3-4244-8811-0e6e26d84667	Suecia Filial Centro BH	\N	\N	Av. Amazonas	1500	\N	Centro	Belo Horizonte	MG	Brasil	-19.9191	-43.9386	Pedro Alves	31988776655	{entregas.bh@fiat.com.br}	true	2026-01-23 12:09:31.127139
6de37a32-18ba-4448-b63a-b6ea401b5850	75a4b18e-f1a3-4244-8811-0e6e26d84667	Suecia Filial Contagem	\N	\N	Rod. BR-381	2000	\N	Industrial	Contagem	MG	Brasil	-19.9318	-44.0539	Ana Silva	31977665544	{entregas.contagem@fiat.com.br}	true	2026-01-23 12:09:31.127139
b772d395-ffd9-424d-ab63-8b57af486c5a	84775f12-cc49-4873-9cb6-5a4d13c8366b	Laponia Filial São Paulo	\N	\N	Av. Paulista	1200	\N	Bela Vista	São Paulo	SP	Brasil	-23.5614	-46.6565	Ricardo Souza	11988887777	{entregas.sp@gm.com.br}	true	2026-01-23 12:09:31.127139
a41b9542-33ab-46be-a577-45a6a5fb94c9	84775f12-cc49-4873-9cb6-5a4d13c8366b	Laponia Filial Campinas	\N	\N	Rod. Anhanguera	Km 98	\N	Jardim Campos	Campinas	SP	Brasil	-22.9099	-47.0626	Mariana Costa	19977776666	{entregas.campinas@gm.com.br}	true	2026-01-23 12:09:31.127139
49e778e4-55f5-4d35-a17f-cf7d524398c1	30955428-ee26-4ccb-acca-79290271cba1	Nors SP Filial Ribeirão Preto	\N	\N	Av. Francisco Junqueira	800	\N	Centro	Ribeirão Preto	SP	Brasil	-21.1767	-47.8208	Lucas Ferreira	16966665555	{entregas.ribeirao@honda.com.br}	true	2026-01-23 12:09:31.127139
c6857b5f-a555-40f5-936a-86f6f9f9c23f	30955428-ee26-4ccb-acca-79290271cba1	Nors SP Filial Sorocaba	\N	\N	Av. Ipanema	1100	\N	Jardim Vera Cruz	Sorocaba	SP	Brasil	-23.5015	-47.4526	Juliana Martins	15955554444	{entregas.sorocaba@honda.com.br}	true	2026-01-23 12:09:31.127139
b2dc35c1-2c39-4b24-8ed8-0c5ea26bef53	74cdde0c-ade3-484f-aba0-252c77b5490d	Nors RJ Filial Curitiba	\N	\N	Av. Sete de Setembro	3000	\N	Centro	Curitiba	PR	Brasil	-25.4284	-49.2733	Fernando Lima	41944443333	{entregas.curitiba@hyundai.com.br}	true	2026-01-23 12:09:31.127139
a3f7de2b-3c59-4e16-b266-9521429643cd	74cdde0c-ade3-484f-aba0-252c77b5490d	Nors RJ Filial Londrina	\N	\N	Av. Higienópolis	500	\N	Centro	Londrina	PR	Brasil	-23.3045	-51.1696	Patricia Santos	43933332222	{entregas.londrina@hyundai.com.br}	true	2026-01-23 12:09:31.127139
5f6ddfb1-43d6-4636-9221-67c682591503	5cc6ef4b-4009-4121-b049-03dd5775bb34	Nors Pará Filial Rio Centro	\N	\N	Av. Rio Branco	180	\N	Centro	Rio de Janeiro	RJ	Brasil	-22.9068	-43.1729	Carlos Eduardo	21922221111	{entregas.rio@nissan.com.br}	true	2026-01-23 12:09:31.127139
010cc078-9e83-43db-9d66-2ac7f2ca2f6e	5cc6ef4b-4009-4121-b049-03dd5775bb34	Nors Pará Filial Niterói	\N	\N	Av. Ernani do Amaral	400	\N	Centro	Niterói	RJ	Brasil	-22.8839	-43.1032	Amanda Oliveira	21911110000	{entregas.niteroi@nissan.com.br}	true	2026-01-23 12:09:31.127139
7fd0e293-3bdc-44ab-b270-f6547f8f897c	d8445226-b6a2-4628-bff6-489cfd299573	Treviso PE Filial Porto Alegre	\N	\N	Av. Ipiranga	2200	\N	Jardim Botânico	Porto Alegre	RS	Brasil	-30.0346	-51.2177	Roberto Gomes	51999998888	{entregas.poa@renault.com.br}	true	2026-01-23 12:09:31.127139
e5b4510a-ef3d-479e-b2ac-59a67981f93d	d8445226-b6a2-4628-bff6-489cfd299573	Treviso PE Filial Caxias do Sul	\N	\N	Rua Sinimbu	1500	\N	Centro	Caxias do Sul	RS	Brasil	-29.1629	-51.1792	Carla Pereira	54988887777	{entregas.caxias@renault.com.br}	true	2026-01-23 12:09:31.127139
f4e6a161-e1e1-4f5f-8a6a-de9d9a91006f	e95751ef-8da0-4e95-9607-152552b2b1c2	Treviso Betim Filial SBC	\N	\N	Av. Kennedy	900	\N	Jardim do Mar	São Bernardo do Campo	SP	Brasil	-23.7095	-46.5502	Thiago Nascimento	11977776666	{entregas.sbc@toyota.com.br}	true	2026-01-23 12:09:31.127139
2cf3b810-ab15-4c70-a1af-403951bab093	983a543a-931c-48b1-86d0-1e4df69d64d2	Dipesul Filial São Caetano	\N	\N	Av. Goiás	1000	\N	Centro	São Caetano do Sul	SP	Brasil	-23.6229	-46.5548	Bruno Cardoso	11955554444	{entregas.scs@vw.com.br}	true	2026-01-23 12:09:31.127139
c47c6e09-f12a-4fdb-932b-0b5ce117d586	983a543a-931c-48b1-86d0-1e4df69d64d2	Dipesul Filial Santo André	\N	\N	Av. Industrial	800	\N	Campestre	Santo André	SP	Brasil	-23.6737	-46.5432	Renata Almeida	11944443333	{entregas.sa@vw.com.br}	true	2026-01-23 12:09:31.127139
\.


--
-- Data for Name: driver_evaluations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.driver_evaluations (id, transport_id, driver_id, evaluator_id, evaluator_name, postura_profissional, pontualidade, apresentacao_pessoal, cordialidade, cumpriu_processo, had_incident, incident_description, average_score, created_at, weighted_score) FROM stdin;
521e2d77-8c92-4897-9953-1889a193482a	eee41e77-fd77-418f-bea7-e6d56dff7097	8ef68ac3-6182-4d80-a96f-a51b343ed8a2	system	Sistema	pessimo	bom	excelente	bom	excelente	false	\N	3.80	2026-01-23 15:38:23.92201	\N
b823240f-7d22-4bc0-808d-43042868a67d	2e5d8ae5-a3f6-40a2-8416-2eb8790f4032	8ef68ac3-6182-4d80-a96f-a51b343ed8a2	system	Sistema	excelente	regular	bom	regular	regular	true	Batey o veiculo	3.60	2026-02-12 12:58:30.735855	\N
\.


--
-- Data for Name: driver_notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.driver_notifications (id, yard_id, delivery_location_id, departure_date, driver_id, status, responded_at, created_at) FROM stdin;
\.


--
-- Data for Name: drivers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.drivers (id, name, cpf, phone, email, birth_date, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, modality, cnh_type, cnh_front_photo, cnh_back_photo, profile_photo, is_apto, is_active, created_at, documents_approved, documents_approved_at, documents_approved_by, driver_type) FROM stdin;
0caca646-d262-4a2e-860c-528a58811d19	João Silva Santos	123.456.789-01	11999887766	joao.silva@email.com	\N	\N	\N	\N	\N	\N	São Paulo	SP	\N	\N	pj	E	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
0aa12687-d7b3-46b5-a23b-6c2ea66c1ab9	Carlos Eduardo Oliveira	234.567.890-12	21988776655	carlos.oliveira@email.com	\N	\N	\N	\N	\N	\N	Rio de Janeiro	RJ	\N	\N	clt	D	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
55ab7797-ea26-4178-ab3b-55b2ca207b8c	Rafael Pereira Costa	345.678.901-23	31977665544	rafael.costa@email.com	\N	\N	\N	\N	\N	\N	Belo Horizonte	MG	\N	\N	agregado	E	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
985eab5f-6f2e-4ffa-9dfd-b6f693cab200	Fernando Almeida Lima	456.789.012-34	41966554433	fernando.lima@email.com	\N	\N	\N	\N	\N	\N	Curitiba	PR	\N	\N	pj	D	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
8ef68ac3-6182-4d80-a96f-a51b343ed8a2	Marcos Ribeiro Souza	567.890.123-45	51955443322	marcos.souza@email.com	\N	\N	\N	\N	\N	\N	Porto Alegre	RS	\N	\N	clt	E	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
23fbc336-ce20-4ba2-9c11-2c700ea74904	André Fernandes Gomes	678.901.234-56	85944332211	andre.gomes@email.com	\N	\N	\N	\N	\N	\N	Fortaleza	CE	\N	\N	agregado	C	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
0725d757-afa2-42ca-b141-5349e5434e6e	Ricardo Mendes Castro	789.012.345-67	71933221100	ricardo.castro@email.com	\N	\N	\N	\N	\N	\N	Salvador	BA	\N	\N	pj	E	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
b6cdfd0d-4576-4e56-bc1b-e4c8caf3db77	Lucas Barbosa Martins	890.123.456-78	62922110099	lucas.martins@email.com	\N	\N	\N	\N	\N	\N	Goiânia	GO	\N	\N	clt	D	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
cffd9360-0875-4bfd-b0b2-60adaf9a78a7	Bruno Cardoso Rocha	901.234.567-89	81911009988	bruno.rocha@email.com	\N	\N	\N	\N	\N	\N	Recife	PE	\N	\N	agregado	E	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
0072e8cb-0244-412c-b2db-4d216749f9e0	Thiago Araújo Nunes	012.345.678-90	92900998877	thiago.nunes@email.com	\N	\N	\N	\N	\N	\N	Manaus	AM	\N	\N	pj	C	\N	\N	\N	true	true	2026-01-23 11:59:32.574366	pendente	\N	\N	\N
\.


--
-- Data for Name: evaluation_criteria; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluation_criteria (id, name, weight, sort_order, is_active, created_at, penalty_leve, penalty_medio, penalty_grave) FROM stdin;
8f58e7f9-b30f-4895-a8dc-8d7e86b037f9	TELEMETRIA	30.00	3	true	2026-02-27 17:35:46.029822	10.00	50.00	100.00
5f1ade9f-f6d6-4aa0-9ee1-2aa818f743b3	ACERTO DE CONTAS	10.00	2	true	2026-02-19 13:50:23.077022	10.00	50.00	100.00
99eedce4-f82f-4c4b-a012-e9d43881084f	AVARIA	30.00	3	true	2026-02-19 03:53:22.833499	10.00	50.00	100.00
c0bf0f5b-6352-430b-8b9f-bafa5faf5ac3	Conduta profissional	30.00	2	true	2026-02-19 03:53:05.943357	10.00	50.00	100.00
\.


--
-- Data for Name: evaluation_scores; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.evaluation_scores (id, evaluation_id, criteria_id, score, created_at, severity) FROM stdin;
\.


--
-- Data for Name: expense_settlement_items; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_settlement_items (id, settlement_id, type, description, amount, photo_url, photo_status, photo_rejection_reason, created_at, currency) FROM stdin;
fc7d3549-f161-4ed3-a1a2-82e6495d1353	d6416c70-61f1-41d9-8add-326e1050c9a1	combustivel		1500	/uploads/d9e8bc4c-d778-4c37-b9c0-3c96f6ed73de.PNG	ok	\N	2026-01-23 12:40:04.766317	BRL
4aac5e02-74be-42ad-9126-6fbaae6bb585	d6416c70-61f1-41d9-8add-326e1050c9a1	combustivel		200	/uploads/98a45cd3-f29c-4e84-adb8-9f8b9073edfb.PNG	ok	\N	2026-01-23 12:40:04.902659	BRL
a3448efa-2139-4d92-9ff3-5f418d6d9723	d6416c70-61f1-41d9-8add-326e1050c9a1	alimentacao		30	/uploads/c83fae2f-29e0-4a2b-8112-0767c6b1f0a0.PNG	ok	\N	2026-01-23 12:40:05.040319	BRL
86b28afc-c0e8-46af-9546-764651a900f3	d6416c70-61f1-41d9-8add-326e1050c9a1	hospedagem		500	/uploads/870bad22-5fe7-4046-901f-7a966e40938c.PNG	ok	\N	2026-01-23 12:40:05.178237	BRL
977b53c9-eafe-4032-a794-3c5ec6014160	bf1fee15-b204-4853-848e-7a7b662af18f	pedagio		1500	/uploads/9b5921ff-c4d3-46ff-a742-511e8f542a51.jpeg	ok	\N	2026-01-23 15:48:59.134216	BRL
\.


--
-- Data for Name: expense_settlements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.expense_settlements (id, transport_id, driver_id, status, driver_notes, total_expenses, advance_amount, balance_amount, route_distance, estimated_tolls, estimated_fuel, submitted_at, reviewed_at, approved_at, signed_at, reviewed_by_user_id, return_reason, settlement_document_url, driver_signature, created_at) FROM stdin;
d6416c70-61f1-41d9-8add-326e1050c9a1	eee41e77-fd77-418f-bea7-e6d56dff7097	8ef68ac3-6182-4d80-a96f-a51b343ed8a2	aprovado		\N	2000	\N	451.62 km	31.20	733.89	2026-01-23 12:40:04.595	2026-01-23 12:40:35.075	2026-01-23 12:40:35.075	\N	\N	\N	\N	\N	2026-01-23 12:40:04.596789
bf1fee15-b204-4853-848e-7a7b662af18f	2e5d8ae5-a3f6-40a2-8416-2eb8790f4032	8ef68ac3-6182-4d80-a96f-a51b343ed8a2	aprovado		\N	1000.74	\N	719.49 km	49.10	1169.17	2026-01-23 15:48:58.947	2026-01-23 15:56:44.27	2026-01-23 15:56:44.27	\N	\N	\N	\N	\N	2026-01-23 15:48:58.947853
\.


--
-- Data for Name: freight_quotes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.freight_quotes (id, client_id, client_name, client_phone, client_email, valid_until, truck_model_id, valor_bem, distancia_km, frete_otd, retorno_motorista, pedagio, consumo_veiculo, preco_diesel, valor_base, valor_total_cte, impostos, created_at) FROM stdin;
540b4cdc-51ec-4ed9-ba86-e258a62ca48e	75a4b18e-f1a3-4244-8811-0e6e26d84667	Suecia Matriz	31966554433	operacoes@frotanacional.com.br	2026-03-03	4a4ebea7-0883-4560-a430-45e5e5fc61cf	100000.00	500.00	1200.00	400.00	189.00	8.00	6.00	2444.00	3103.49	659.49	2026-02-28 20:41:31.165165
\.


--
-- Data for Name: manufacturers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.manufacturers (id, name, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, phone, email, contact_name, is_active, created_at) FROM stdin;
dfd93366-11fa-44be-b42b-186cf7a565a5	Scania Latin America	\N	Av. Toyota, 1000	\N	\N	Centro	São Bernardo do Campo	SP	\N	\N	11987654321	fabrica@scania.com.br	Magnus Eriksson	true	2026-01-23 12:02:37.559784
ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Volvo Caminhões	\N	Rod. Anhanguera, Km 104	\N	\N	Distrito Industrial	Sumaré	SP	\N	\N	11988776655	producao@volvo.com.br	Lars Johansson	true	2026-01-23 12:02:37.559784
e126853c-3946-4f95-8eb4-9a8fefbe4f87	Mercedes-Benz Caminhões	\N	Via Anchieta, 1500	\N	\N	Demarchi	São Bernardo do Campo	SP	\N	\N	11977665544	fabrica@mercedes-benz.com.br	Klaus Weber	true	2026-01-23 12:02:37.559784
9c178a39-5e4c-4d73-a258-08aaa3d91c7a	DAF Caminhões Brasil	\N	Av. Fiat, 2000	\N	\N	Citrolândia	Betim	MG	\N	\N	31966554433	producao@daf.com.br	Willem de Vries	true	2026-01-23 12:02:37.559784
1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	MAN Latin America	\N	Av. Goiás, 1800	\N	\N	Barcelona	São Caetano do Sul	SP	\N	\N	11955443322	fabrica@man.com.br	Friedrich Bauer	true	2026-01-23 12:02:37.559784
1ea24d39-4bca-4b9b-8abd-dd347e1f3729	Iveco Brasil	\N	Av. Renault, 1300	\N	\N	Borda do Campo	São José dos Pinhais	PR	\N	\N	41944332211	producao@iveco.com.br	Giuseppe Conti	true	2026-01-23 12:02:37.559784
f09bd446-ca7a-4192-b20a-0641f44ec3bf	Ford Caminhões	\N	Rod. Luiz de Queiroz, Km 157	\N	\N	Distrito Industrial	Piracicaba	SP	\N	\N	15933221100	fabrica@ford.com.br	James Williams	true	2026-01-23 12:02:37.559784
1e4eadb5-237d-4601-9410-2d5ae6fd6b5d	Foton Caminhões	\N	Rod. Presidente Dutra, Km 302	\N	\N	Polo Industrial	Resende	RJ	\N	\N	21922110099	producao@foton.com.br	Li Wei	true	2026-01-23 12:02:37.559784
\.


--
-- Data for Name: request_counter; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.request_counter (id, last_number) FROM stdin;
transport_counter	4
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (id, role, feature, created_at) FROM stdin;
\.


--
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.routes (id, name, origin_yard_id, destination_location_id, distance_km, truck_type, diesel_price, fuel_consumption, fuel_cost, arla32_cost, toll_cost, driver_daily_cost, return_ticket, extra_expenses, ad_valorem_percentage, vehicle_value, ad_valorem_cost, profit_margin_percentage, admin_fee, total_cost, suggested_price, net_profit, is_favorite, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (sid, sess, expire) FROM stdin;
\.


--
-- Data for Name: system_users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_users (id, name, email, username, password, role, is_active, created_at) FROM stdin;
\.


--
-- Data for Name: transport_checkpoints; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transport_checkpoints (id, transport_id, checkpoint_id, order_index, status, reached_at, latitude, longitude, notes, created_at) FROM stdin;
\.


--
-- Data for Name: transports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transports (id, request_number, vehicle_chassi, client_id, origin_yard_id, delivery_location_id, driver_id, status, delivery_date, notes, documents, created_at, created_by_user_id, driver_assigned_by_user_id, driver_assigned_at, transit_started_at, checkin_date_time, checkin_latitude, checkin_longitude, checkin_frontal_photo, checkin_lateral1_photo, checkin_lateral2_photo, checkin_traseira_photo, checkin_odometer_photo, checkin_fuel_level_photo, checkin_damage_photos, checkin_selfie_photo, checkin_notes, checkout_date_time, checkout_latitude, checkout_longitude, checkout_frontal_photo, checkout_lateral1_photo, checkout_lateral2_photo, checkout_traseira_photo, checkout_odometer_photo, checkout_fuel_level_photo, checkout_damage_photos, checkout_selfie_photo, checkout_notes, route_distance_km, route_duration_minutes, estimated_tolls, estimated_fuel) FROM stdin;
bdd16671-7c6d-4721-be5b-08a5d8ab32ff	OTD00004	9BWKB45U0LP126006	983a543a-931c-48b1-86d0-1e4df69d64d2	91aca4b3-71b9-45d0-a163-1319b792c56d	c47c6e09-f12a-4fdb-932b-0b5ce117d586	b6cdfd0d-4576-4e56-bc1b-e4c8caf3db77	em_transito	2026-02-13	\N	\N	2026-02-12 12:48:36.834793	37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	2026-02-12 12:48:36.783	2026-02-12 12:50:11.091	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	\N	447.41	359	31.20	727.04
eee41e77-fd77-418f-bea7-e6d56dff7097	OTD00001	9BW G4GH74 TP7 53	983a543a-931c-48b1-86d0-1e4df69d64d2	91aca4b3-71b9-45d0-a163-1319b792c56d	c47c6e09-f12a-4fdb-932b-0b5ce117d586	8ef68ac3-6182-4d80-a96f-a51b343ed8a2	entregue	2026-01-23	\N	\N	2026-01-23 12:24:30.574684	37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	2026-01-23 12:24:30.539	2026-01-23 12:25:59.317	2026-01-23 12:24:56.875	-25.4295	-49.2712	/uploads/e8807c50-f61d-4273-9206-cf87f6bcc0e5.PNG	/uploads/913adef5-5ed8-457e-ba33-a1bc41a071f7.PNG	/uploads/b55e5e7c-81ea-4320-8a0f-9c0d1b6382a6.PNG	/uploads/f078d5d7-112f-4459-8eda-a9a9d66d250c.PNG	/uploads/0cc49bf8-8b9d-4a60-8f59-71413bab16b8.PNG	/uploads/ced0c93e-26bb-4f82-b52a-95dcb3eab06a.PNG	{/uploads/cc65a20c-9b5b-4c3d-98af-617608ade407.PNG}	/uploads/5d74704b-e159-4aed-978f-285babbe42b4.PNG		2026-01-23 12:38:23.062	-34.000	-48.9999	/uploads/853b83a0-fd46-4cf6-b089-aa340f4a96e5.PNG	/uploads/c2d2e33f-32bb-4a63-b2d7-8149f0d15d16.PNG	/uploads/31535e17-0ce9-4165-9819-68fb464770dd.PNG	/uploads/7e42e71b-67b1-4572-a792-e11f9dba45ca.PNG	/uploads/76416101-aa35-4fae-8ce3-752cf70c9795.PNG	/uploads/5c68064a-5cc6-49b3-847d-90ff1ead1c6d.PNG	{/uploads/4a40c61e-c7b5-4c19-a58a-cbdb20a37c80.PNG}	/uploads/1a8151ad-109b-4339-b64c-f8f1385e996e.PNG		451.62	355	31.20	733.89
2e5d8ae5-a3f6-40a2-8416-2eb8790f4032	OTD00003	9BWKB45U0LP128005	d8445226-b6a2-4628-bff6-489cfd299573	91aca4b3-71b9-45d0-a163-1319b792c56d	7fd0e293-3bdc-44ab-b270-f6547f8f897c	8ef68ac3-6182-4d80-a96f-a51b343ed8a2	entregue	2026-01-26	\N	\N	2026-01-23 15:14:19.225622	37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	2026-01-23 15:14:19.183	2026-01-23 15:18:43.289	2026-01-23 15:18:33.06	-25.7719	-49.7167	/uploads/e0ede2d2-8019-4dc3-b03c-59c427accfba.jpeg	/uploads/701faa8e-a0ce-407f-a2fd-30ec55c064b7.jpeg					{}			2026-01-23 15:36:06.316	-25.636444078338393	-49.18057436039454	/uploads/c08eddd5-1fee-48c7-8653-b05997ac6cb6.jpeg						{}			719.49	514	49.10	1169.17
afa8b0bd-33a8-4724-920b-a3d74c575b5c	OTD00002	9BWKB45U0LP124005	983a543a-931c-48b1-86d0-1e4df69d64d2	91aca4b3-71b9-45d0-a163-1319b792c56d	2cf3b810-ab15-4c70-a1af-403951bab093	\N	entregue	2026-01-26	\N	\N	2026-01-23 14:53:28.598876	37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	\N	\N	2026-01-23 15:13:45.585	2026-01-23 15:11:12.389	-25.7719	-49.7167							{}			2026-02-11 23:11:39.607	-25.4295	-49.2712	/uploads/46446a31-5d9d-45a4-9423-eeba087a1cde.PNG	/uploads/ff43d862-3ceb-4c44-8bd7-2b475792a4a1.PNG	/uploads/a9257d3b-c812-448f-9f96-2ed5f489aa45.PNG	/uploads/aced1a04-54cc-4349-916f-67203264c60d.PNG	/uploads/7ff436c2-1e35-4cbf-9f17-7d9097165781.PNG	/uploads/07df4846-4e48-47f3-b942-505c802565d9.PNG	{/uploads/5410e042-23a9-4cde-ba14-8aa0b5b0d05f.PNG}	/uploads/d603a557-7a84-41d9-9ce2-c3780a0893df.jpg		456.71	363	31.20	742.15
\.


--
-- Data for Name: truck_models; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.truck_models (id, brand, model, axle_config, average_consumption, is_active, created_at, vehicle_value) FROM stdin;
aaa73218-65a6-4e07-b43c-4ad9b4910a2f	VOLVO	FH520	7_eixos	5.00	true	2026-02-28 19:52:50.682808	500000.00
4a4ebea7-0883-4560-a430-45e5e5fc61cf	SCANIA	R450	2_eixos	8.00	true	2026-02-28 20:28:12.867039	100000.00
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, username, password_hash, email, first_name, last_name, profile_image_url, role, refresh_token_version, last_login, is_active, created_at, updated_at) FROM stdin;
37e1f1de-fd31-44ca-b9ae-e575a5cb7fe6	admin	$2b$12$pI3InWpzX74OgJ/n.Je24OSPUz6ob/fnYD/91P.tBF7D/5As8zFRi	admin@otdentregas.com	Administrador	Sistema	\N	admin	2026-02-28 21:08:12.95	2026-02-28 20:42:04.34	true	2026-01-23 11:56:29.084261	2026-01-23 11:56:29.084261
\.


--
-- Data for Name: vehicles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.vehicles (chassi, client_id, yard_id, manufacturer_id, color, status, collect_date_time, yard_entry_date_time, dispatch_date_time, delivery_date_time, notes, created_at) FROM stdin;
9BWKB45U0LP126006	75a4b18e-f1a3-4244-8811-0e6e26d84667	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1ea24d39-4bca-4b9b-8abd-dd347e1f3729	Branco	despachado	\N	2025-11-18 08:00:00	2026-02-12 12:50:11.047	\N	\N	2025-11-18 08:00:00
9BWKB45U0LP124005	5cc6ef4b-4009-4121-b049-03dd5775bb34	91aca4b3-71b9-45d0-a163-1319b792c56d	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	entregue	\N	2025-12-10 08:00:00	\N	\N	\N	2025-12-10 08:00:00
9BW G4GH74 TP7 53	\N	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	\N	entregue	\N	2026-01-23 12:18:49.915	\N	\N	\N	2026-01-23 12:17:46.85409
9BWKB45U0LP123001	30955428-ee26-4ccb-acca-79290271cba1	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Branco	em_estoque	\N	2025-08-15 10:30:00	\N	\N	\N	2025-08-15 10:30:00
9BWKB45U0LP123002	30955428-ee26-4ccb-acca-79290271cba1	91aca4b3-71b9-45d0-a163-1319b792c56d	dfd93366-11fa-44be-b42b-186cf7a565a5	Vermelho	em_estoque	\N	2025-09-20 14:00:00	\N	\N	\N	2025-09-20 14:00:00
9BWKB45U0LP123003	30955428-ee26-4ccb-acca-79290271cba1	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Preto	despachado	\N	2025-10-05 09:15:00	\N	\N	\N	2025-10-05 09:15:00
9BWKB45U0LP123004	30955428-ee26-4ccb-acca-79290271cba1	91aca4b3-71b9-45d0-a163-1319b792c56d	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	em_estoque	\N	2025-11-12 11:45:00	\N	\N	\N	2025-11-12 11:45:00
9BWKB45U0LP123005	30955428-ee26-4ccb-acca-79290271cba1	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	entregue	\N	2025-12-01 08:30:00	\N	\N	\N	2025-12-01 08:30:00
9BWKB45U0LP123006	30955428-ee26-4ccb-acca-79290271cba1	91aca4b3-71b9-45d0-a163-1319b792c56d	1ea24d39-4bca-4b9b-8abd-dd347e1f3729	Branco	pre_estoque	\N	2025-12-20 16:00:00	\N	\N	\N	2025-12-20 16:00:00
9BWKB45U0LP123007	30955428-ee26-4ccb-acca-79290271cba1	91aca4b3-71b9-45d0-a163-1319b792c56d	f09bd446-ca7a-4192-b20a-0641f44ec3bf	Verde	em_estoque	\N	2026-01-08 10:00:00	\N	\N	\N	2026-01-08 10:00:00
9BWKB45U0LP123008	30955428-ee26-4ccb-acca-79290271cba1	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1e4eadb5-237d-4601-9410-2d5ae6fd6b5d	Amarelo	em_estoque	\N	2026-01-15 13:30:00	\N	\N	\N	2026-01-15 13:30:00
9BWKB45U0LP124001	5cc6ef4b-4009-4121-b049-03dd5775bb34	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Branco	em_estoque	\N	2025-08-22 09:00:00	\N	\N	\N	2025-08-22 09:00:00
9BWKB45U0LP124002	5cc6ef4b-4009-4121-b049-03dd5775bb34	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	dfd93366-11fa-44be-b42b-186cf7a565a5	Preto	despachado	\N	2025-09-30 11:30:00	\N	\N	\N	2025-09-30 11:30:00
9BWKB45U0LP124003	5cc6ef4b-4009-4121-b049-03dd5775bb34	91aca4b3-71b9-45d0-a163-1319b792c56d	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Vermelho	em_estoque	\N	2025-10-18 14:45:00	\N	\N	\N	2025-10-18 14:45:00
9BWKB45U0LP124004	5cc6ef4b-4009-4121-b049-03dd5775bb34	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	entregue	\N	2025-11-25 10:15:00	\N	\N	\N	2025-11-25 10:15:00
9BWKB45U0LP124006	5cc6ef4b-4009-4121-b049-03dd5775bb34	91aca4b3-71b9-45d0-a163-1319b792c56d	1ea24d39-4bca-4b9b-8abd-dd347e1f3729	Branco	pre_estoque	\N	2026-01-05 15:30:00	\N	\N	\N	2026-01-05 15:30:00
9BWKB45U0LP125001	74cdde0c-ade3-484f-aba0-252c77b5490d	91aca4b3-71b9-45d0-a163-1319b792c56d	dfd93366-11fa-44be-b42b-186cf7a565a5	Preto	em_estoque	\N	2025-08-10 08:30:00	\N	\N	\N	2025-08-10 08:30:00
9BWKB45U0LP125002	74cdde0c-ade3-484f-aba0-252c77b5490d	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Branco	despachado	\N	2025-09-05 10:00:00	\N	\N	\N	2025-09-05 10:00:00
9BWKB45U0LP125003	74cdde0c-ade3-484f-aba0-252c77b5490d	91aca4b3-71b9-45d0-a163-1319b792c56d	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Vermelho	em_estoque	\N	2025-10-12 13:15:00	\N	\N	\N	2025-10-12 13:15:00
9BWKB45U0LP125004	74cdde0c-ade3-484f-aba0-252c77b5490d	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	entregue	\N	2025-11-08 09:45:00	\N	\N	\N	2025-11-08 09:45:00
9BWKB45U0LP125005	74cdde0c-ade3-484f-aba0-252c77b5490d	91aca4b3-71b9-45d0-a163-1319b792c56d	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	em_estoque	\N	2025-12-03 11:00:00	\N	\N	\N	2025-12-03 11:00:00
9BWKB45U0LP125006	74cdde0c-ade3-484f-aba0-252c77b5490d	91aca4b3-71b9-45d0-a163-1319b792c56d	f09bd446-ca7a-4192-b20a-0641f44ec3bf	Verde	pre_estoque	\N	2025-12-28 14:30:00	\N	\N	\N	2025-12-28 14:30:00
9BWKB45U0LP125007	74cdde0c-ade3-484f-aba0-252c77b5490d	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1e4eadb5-237d-4601-9410-2d5ae6fd6b5d	Amarelo	em_estoque	\N	2026-01-18 10:15:00	\N	\N	\N	2026-01-18 10:15:00
9BWKB45U0LP126001	75a4b18e-f1a3-4244-8811-0e6e26d84667	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Branco	em_estoque	\N	2025-08-05 07:30:00	\N	\N	\N	2025-08-05 07:30:00
9BWKB45U0LP126002	75a4b18e-f1a3-4244-8811-0e6e26d84667	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	dfd93366-11fa-44be-b42b-186cf7a565a5	Preto	despachado	\N	2025-08-25 11:00:00	\N	\N	\N	2025-08-25 11:00:00
9BWKB45U0LP126003	75a4b18e-f1a3-4244-8811-0e6e26d84667	91aca4b3-71b9-45d0-a163-1319b792c56d	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Vermelho	em_estoque	\N	2025-09-15 09:45:00	\N	\N	\N	2025-09-15 09:45:00
9BWKB45U0LP126004	75a4b18e-f1a3-4244-8811-0e6e26d84667	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	entregue	\N	2025-10-08 14:30:00	\N	\N	\N	2025-10-08 14:30:00
9BWKB45U0LP126005	75a4b18e-f1a3-4244-8811-0e6e26d84667	91aca4b3-71b9-45d0-a163-1319b792c56d	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	em_estoque	\N	2025-10-28 10:15:00	\N	\N	\N	2025-10-28 10:15:00
9BWKB45U0LP126007	75a4b18e-f1a3-4244-8811-0e6e26d84667	91aca4b3-71b9-45d0-a163-1319b792c56d	f09bd446-ca7a-4192-b20a-0641f44ec3bf	Verde	pre_estoque	\N	2025-12-08 13:45:00	\N	\N	\N	2025-12-08 13:45:00
9BWKB45U0LP126008	75a4b18e-f1a3-4244-8811-0e6e26d84667	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1e4eadb5-237d-4601-9410-2d5ae6fd6b5d	Amarelo	despachado	\N	2025-12-25 11:30:00	\N	\N	\N	2025-12-25 11:30:00
9BWKB45U0LP126009	75a4b18e-f1a3-4244-8811-0e6e26d84667	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Cinza	em_estoque	\N	2026-01-12 09:00:00	\N	\N	\N	2026-01-12 09:00:00
9BWKB45U0LP127001	84775f12-cc49-4873-9cb6-5a4d13c8366b	91aca4b3-71b9-45d0-a163-1319b792c56d	dfd93366-11fa-44be-b42b-186cf7a565a5	Branco	em_estoque	\N	2025-08-18 10:00:00	\N	\N	\N	2025-08-18 10:00:00
9BWKB45U0LP127002	84775f12-cc49-4873-9cb6-5a4d13c8366b	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Preto	despachado	\N	2025-09-28 14:30:00	\N	\N	\N	2025-09-28 14:30:00
9BWKB45U0LP127003	84775f12-cc49-4873-9cb6-5a4d13c8366b	91aca4b3-71b9-45d0-a163-1319b792c56d	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Vermelho	em_estoque	\N	2025-11-05 09:15:00	\N	\N	\N	2025-11-05 09:15:00
9BWKB45U0LP127004	84775f12-cc49-4873-9cb6-5a4d13c8366b	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	entregue	\N	2025-12-15 11:45:00	\N	\N	\N	2025-12-15 11:45:00
9BWKB45U0LP127005	84775f12-cc49-4873-9cb6-5a4d13c8366b	91aca4b3-71b9-45d0-a163-1319b792c56d	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	pre_estoque	\N	2026-01-20 08:30:00	\N	\N	\N	2026-01-20 08:30:00
9BWKB45U0LP128001	983a543a-931c-48b1-86d0-1e4df69d64d2	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Branco	em_estoque	\N	2025-08-08 09:30:00	\N	\N	\N	2025-08-08 09:30:00
9BWKB45U0LP128002	983a543a-931c-48b1-86d0-1e4df69d64d2	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	dfd93366-11fa-44be-b42b-186cf7a565a5	Preto	despachado	\N	2025-09-12 13:00:00	\N	\N	\N	2025-09-12 13:00:00
9BWKB45U0LP128003	983a543a-931c-48b1-86d0-1e4df69d64d2	91aca4b3-71b9-45d0-a163-1319b792c56d	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Vermelho	em_estoque	\N	2025-10-22 10:45:00	\N	\N	\N	2025-10-22 10:45:00
9BWKB45U0LP128004	983a543a-931c-48b1-86d0-1e4df69d64d2	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	entregue	\N	2025-11-15 08:15:00	\N	\N	\N	2025-11-15 08:15:00
9BWKB45U0LP128006	983a543a-931c-48b1-86d0-1e4df69d64d2	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1ea24d39-4bca-4b9b-8abd-dd347e1f3729	Branco	pre_estoque	\N	2025-12-22 11:30:00	\N	\N	\N	2025-12-22 11:30:00
9BWKB45U0LP128007	983a543a-931c-48b1-86d0-1e4df69d64d2	91aca4b3-71b9-45d0-a163-1319b792c56d	f09bd446-ca7a-4192-b20a-0641f44ec3bf	Verde	em_estoque	\N	2026-01-10 09:45:00	\N	\N	\N	2026-01-10 09:45:00
9BWKB45U0LP129001	d8445226-b6a2-4628-bff6-489cfd299573	91aca4b3-71b9-45d0-a163-1319b792c56d	dfd93366-11fa-44be-b42b-186cf7a565a5	Preto	em_estoque	\N	2025-08-12 08:00:00	\N	\N	\N	2025-08-12 08:00:00
9BWKB45U0LP129002	d8445226-b6a2-4628-bff6-489cfd299573	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Branco	despachado	\N	2025-09-25 12:30:00	\N	\N	\N	2025-09-25 12:30:00
9BWKB45U0LP129003	d8445226-b6a2-4628-bff6-489cfd299573	91aca4b3-71b9-45d0-a163-1319b792c56d	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Vermelho	em_estoque	\N	2025-10-30 10:15:00	\N	\N	\N	2025-10-30 10:15:00
9BWKB45U0LP129004	d8445226-b6a2-4628-bff6-489cfd299573	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	entregue	\N	2025-11-28 09:00:00	\N	\N	\N	2025-11-28 09:00:00
9BWKB45U0LP129005	d8445226-b6a2-4628-bff6-489cfd299573	91aca4b3-71b9-45d0-a163-1319b792c56d	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	em_estoque	\N	2025-12-18 14:45:00	\N	\N	\N	2025-12-18 14:45:00
9BWKB45U0LP129006	d8445226-b6a2-4628-bff6-489cfd299573	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1ea24d39-4bca-4b9b-8abd-dd347e1f3729	Branco	pre_estoque	\N	2026-01-08 11:00:00	\N	\N	\N	2026-01-08 11:00:00
9BWKB45U0LP130001	e95751ef-8da0-4e95-9607-152552b2b1c2	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	Branco	em_estoque	\N	2025-08-03 07:45:00	\N	\N	\N	2025-08-03 07:45:00
9BWKB45U0LP130002	e95751ef-8da0-4e95-9607-152552b2b1c2	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	dfd93366-11fa-44be-b42b-186cf7a565a5	Preto	despachado	\N	2025-08-28 11:15:00	\N	\N	\N	2025-08-28 11:15:00
9BWKB45U0LP130003	e95751ef-8da0-4e95-9607-152552b2b1c2	91aca4b3-71b9-45d0-a163-1319b792c56d	e126853c-3946-4f95-8eb4-9a8fefbe4f87	Vermelho	em_estoque	\N	2025-09-18 09:30:00	\N	\N	\N	2025-09-18 09:30:00
9BWKB45U0LP130004	e95751ef-8da0-4e95-9607-152552b2b1c2	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1becc2ba-dcfe-4255-89f7-1ba1bcf5bbd6	Azul	entregue	\N	2025-10-15 14:00:00	\N	\N	\N	2025-10-15 14:00:00
9BWKB45U0LP130005	e95751ef-8da0-4e95-9607-152552b2b1c2	91aca4b3-71b9-45d0-a163-1319b792c56d	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	em_estoque	\N	2025-11-10 10:45:00	\N	\N	\N	2025-11-10 10:45:00
9BWKB45U0LP130006	e95751ef-8da0-4e95-9607-152552b2b1c2	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1ea24d39-4bca-4b9b-8abd-dd347e1f3729	Branco	em_estoque	\N	2025-12-02 08:30:00	\N	\N	\N	2025-12-02 08:30:00
9BWKB45U0LP130007	e95751ef-8da0-4e95-9607-152552b2b1c2	91aca4b3-71b9-45d0-a163-1319b792c56d	f09bd446-ca7a-4192-b20a-0641f44ec3bf	Verde	pre_estoque	\N	2025-12-28 13:15:00	\N	\N	\N	2025-12-28 13:15:00
9BWKB45U0LP130008	e95751ef-8da0-4e95-9607-152552b2b1c2	fe42ffec-6fc3-4ef0-b489-f1b99af8f337	1e4eadb5-237d-4601-9410-2d5ae6fd6b5d	Amarelo	em_estoque	\N	2026-01-15 10:00:00	\N	\N	\N	2026-01-15 10:00:00
93939393939393939	\N	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	\N	em_estoque	\N	2026-01-23 14:07:58.856	\N	\N	\N	2026-01-23 14:06:20.865148
9BWKB45U0LP128005	983a543a-931c-48b1-86d0-1e4df69d64d2	91aca4b3-71b9-45d0-a163-1319b792c56d	9c178a39-5e4c-4d73-a258-08aaa3d91c7a	Prata	entregue	\N	2025-12-05 14:00:00	\N	\N	\N	2025-12-05 14:00:00
39949494944398389	\N	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	\N	em_estoque	\N	2026-02-12 12:37:47.155	\N	\N	\N	2026-02-12 12:35:48.041851
9BW VH9DCX TH0 71	\N	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	\N	em_estoque	\N	2026-02-19 13:17:48.314	\N	\N	\N	2026-01-23 13:17:44.240943
90943243209432809	\N	\N	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	\N	pre_estoque	\N	\N	\N	\N	\N	2026-02-19 13:30:59.680796
43280948204983280	\N	91aca4b3-71b9-45d0-a163-1319b792c56d	ac57ae5a-a880-4279-beee-9b79a3ebeb3f	\N	em_estoque	\N	2026-02-19 13:31:02.967	\N	\N	\N	2026-02-19 13:17:43.939246
23112313213231232	\N	\N	dfd93366-11fa-44be-b42b-186cf7a565a5	\N	pre_estoque	\N	\N	\N	\N	\N	2026-02-28 18:20:54.74189
\.


--
-- Data for Name: yards; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.yards (id, name, cep, address, address_number, complement, neighborhood, city, state, latitude, longitude, phone, max_vehicles, is_active, created_at) FROM stdin;
91aca4b3-71b9-45d0-a163-1319b792c56d	OTD Matriz São José dos Pinhais	83091002	R. Antônio Singer	2682		Campina do Taquaral	São José dos Pinhais	PR	-25.6371909	-49.1812057	(41) 3030-2315	500	true	2026-01-23 12:05:48.817743
fe42ffec-6fc3-4ef0-b489-f1b99af8f337	OTD - Osório - RS	95520000	BR-101	4920		Osório	RS	\N	-29.867501299999997	-50.2512453	(51) 4004-6080	100	true	2026-01-23 12:08:39.593828
\.


--
-- Name: checkpoints checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.checkpoints
    ADD CONSTRAINT checkpoints_pkey PRIMARY KEY (id);


--
-- Name: clients clients_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);


--
-- Name: collects collects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_pkey PRIMARY KEY (id);


--
-- Name: contracts contracts_contract_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_contract_number_unique UNIQUE (contract_number);


--
-- Name: contracts contracts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_pkey PRIMARY KEY (id);


--
-- Name: delivery_locations delivery_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_locations
    ADD CONSTRAINT delivery_locations_pkey PRIMARY KEY (id);


--
-- Name: driver_evaluations driver_evaluations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_evaluations
    ADD CONSTRAINT driver_evaluations_pkey PRIMARY KEY (id);


--
-- Name: driver_notifications driver_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_pkey PRIMARY KEY (id);


--
-- Name: drivers drivers_cpf_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_cpf_unique UNIQUE (cpf);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: evaluation_criteria evaluation_criteria_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_criteria
    ADD CONSTRAINT evaluation_criteria_pkey PRIMARY KEY (id);


--
-- Name: evaluation_scores evaluation_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_scores
    ADD CONSTRAINT evaluation_scores_pkey PRIMARY KEY (id);


--
-- Name: expense_settlement_items expense_settlement_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_settlement_items
    ADD CONSTRAINT expense_settlement_items_pkey PRIMARY KEY (id);


--
-- Name: expense_settlements expense_settlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_pkey PRIMARY KEY (id);


--
-- Name: freight_quotes freight_quotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.freight_quotes
    ADD CONSTRAINT freight_quotes_pkey PRIMARY KEY (id);


--
-- Name: manufacturers manufacturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.manufacturers
    ADD CONSTRAINT manufacturers_pkey PRIMARY KEY (id);


--
-- Name: request_counter request_counter_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_counter
    ADD CONSTRAINT request_counter_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);


--
-- Name: system_users system_users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_email_unique UNIQUE (email);


--
-- Name: system_users system_users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_pkey PRIMARY KEY (id);


--
-- Name: system_users system_users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_users
    ADD CONSTRAINT system_users_username_unique UNIQUE (username);


--
-- Name: transport_checkpoints transport_checkpoints_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_checkpoints
    ADD CONSTRAINT transport_checkpoints_pkey PRIMARY KEY (id);


--
-- Name: transports transports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_pkey PRIMARY KEY (id);


--
-- Name: transports transports_request_number_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_request_number_unique UNIQUE (request_number);


--
-- Name: truck_models truck_models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.truck_models
    ADD CONSTRAINT truck_models_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (chassi);


--
-- Name: yards yards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.yards
    ADD CONSTRAINT yards_pkey PRIMARY KEY (id);


--
-- Name: IDX_session_expire; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "IDX_session_expire" ON public.sessions USING btree (expire);


--
-- Name: collects collects_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: collects collects_manufacturer_id_manufacturers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_manufacturer_id_manufacturers_id_fk FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- Name: collects collects_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collects
    ADD CONSTRAINT collects_yard_id_yards_id_fk FOREIGN KEY (yard_id) REFERENCES public.yards(id);


--
-- Name: contracts contracts_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.contracts
    ADD CONSTRAINT contracts_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: delivery_locations delivery_locations_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.delivery_locations
    ADD CONSTRAINT delivery_locations_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: driver_evaluations driver_evaluations_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_evaluations
    ADD CONSTRAINT driver_evaluations_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_evaluations driver_evaluations_transport_id_transports_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_evaluations
    ADD CONSTRAINT driver_evaluations_transport_id_transports_id_fk FOREIGN KEY (transport_id) REFERENCES public.transports(id);


--
-- Name: driver_notifications driver_notifications_delivery_location_id_delivery_locations_id; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_delivery_location_id_delivery_locations_id FOREIGN KEY (delivery_location_id) REFERENCES public.delivery_locations(id);


--
-- Name: driver_notifications driver_notifications_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: driver_notifications driver_notifications_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.driver_notifications
    ADD CONSTRAINT driver_notifications_yard_id_yards_id_fk FOREIGN KEY (yard_id) REFERENCES public.yards(id);


--
-- Name: evaluation_scores evaluation_scores_criteria_id_evaluation_criteria_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_scores
    ADD CONSTRAINT evaluation_scores_criteria_id_evaluation_criteria_id_fk FOREIGN KEY (criteria_id) REFERENCES public.evaluation_criteria(id);


--
-- Name: evaluation_scores evaluation_scores_evaluation_id_driver_evaluations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evaluation_scores
    ADD CONSTRAINT evaluation_scores_evaluation_id_driver_evaluations_id_fk FOREIGN KEY (evaluation_id) REFERENCES public.driver_evaluations(id);


--
-- Name: expense_settlement_items expense_settlement_items_settlement_id_expense_settlements_id_f; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_settlement_items
    ADD CONSTRAINT expense_settlement_items_settlement_id_expense_settlements_id_f FOREIGN KEY (settlement_id) REFERENCES public.expense_settlements(id);


--
-- Name: expense_settlements expense_settlements_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: expense_settlements expense_settlements_reviewed_by_user_id_system_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_reviewed_by_user_id_system_users_id_fk FOREIGN KEY (reviewed_by_user_id) REFERENCES public.system_users(id);


--
-- Name: expense_settlements expense_settlements_transport_id_transports_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.expense_settlements
    ADD CONSTRAINT expense_settlements_transport_id_transports_id_fk FOREIGN KEY (transport_id) REFERENCES public.transports(id);


--
-- Name: routes routes_destination_location_id_delivery_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_destination_location_id_delivery_locations_id_fk FOREIGN KEY (destination_location_id) REFERENCES public.delivery_locations(id);


--
-- Name: routes routes_origin_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_origin_yard_id_yards_id_fk FOREIGN KEY (origin_yard_id) REFERENCES public.yards(id);


--
-- Name: transport_checkpoints transport_checkpoints_checkpoint_id_checkpoints_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_checkpoints
    ADD CONSTRAINT transport_checkpoints_checkpoint_id_checkpoints_id_fk FOREIGN KEY (checkpoint_id) REFERENCES public.checkpoints(id);


--
-- Name: transport_checkpoints transport_checkpoints_transport_id_transports_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transport_checkpoints
    ADD CONSTRAINT transport_checkpoints_transport_id_transports_id_fk FOREIGN KEY (transport_id) REFERENCES public.transports(id);


--
-- Name: transports transports_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: transports transports_delivery_location_id_delivery_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_delivery_location_id_delivery_locations_id_fk FOREIGN KEY (delivery_location_id) REFERENCES public.delivery_locations(id);


--
-- Name: transports transports_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: transports transports_origin_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_origin_yard_id_yards_id_fk FOREIGN KEY (origin_yard_id) REFERENCES public.yards(id);


--
-- Name: transports transports_vehicle_chassi_vehicles_chassi_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transports
    ADD CONSTRAINT transports_vehicle_chassi_vehicles_chassi_fk FOREIGN KEY (vehicle_chassi) REFERENCES public.vehicles(chassi);


--
-- Name: vehicles vehicles_client_id_clients_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_client_id_clients_id_fk FOREIGN KEY (client_id) REFERENCES public.clients(id);


--
-- Name: vehicles vehicles_manufacturer_id_manufacturers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_manufacturer_id_manufacturers_id_fk FOREIGN KEY (manufacturer_id) REFERENCES public.manufacturers(id);


--
-- Name: vehicles vehicles_yard_id_yards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_yard_id_yards_id_fk FOREIGN KEY (yard_id) REFERENCES public.yards(id);


--
-- PostgreSQL database dump complete
--

\unrestrict Dxk4aD1lrlWjZIqKdMSMcGbaoSrgFTSWHCJRRjaqrWT65N9J3xuBUhbeIoBGt3x

