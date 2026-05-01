import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, date, integer, pgEnum, numeric, customType, jsonb, serial, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users as authUsers } from "./models/auth";

function parseEWKBPoint(hex: string): { longitude: number; latitude: number } | null {
  if (!hex || hex.length < 42) return null;
  const buf = Buffer.from(hex, "hex");
  const isLittleEndian = buf[0] === 1;
  const offset = hex.length >= 50 ? 5 : 1;
  const lng = isLittleEndian ? buf.readDoubleLE(offset + 4) : buf.readDoubleBE(offset + 4);
  const lat = isLittleEndian ? buf.readDoubleLE(offset + 12) : buf.readDoubleBE(offset + 12);
  return { longitude: lng, latitude: lat };
}

const geometry = customType<{
  data: { type: "Point"; coordinates: [number, number] } | null;
  driverParam: string;
}>({
  dataType() {
    return "geometry(Point, 4326)";
  },
  toDriver(value) {
    if (!value) return null as any;
    return `SRID=4326;POINT(${value.coordinates[0]} ${value.coordinates[1]})`;
  },
  fromDriver(value: unknown): { type: "Point"; coordinates: [number, number] } | null {
    if (!value || typeof value !== "string") return null;
    const parsed = parseEWKBPoint(value);
    if (!parsed) return null;
    return {
      type: "Point" as const,
      coordinates: [parsed.longitude, parsed.latitude],
    };
  },
});

// Re-export auth models
export * from "./models/auth";

// Enums
export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "pre_estoque",
  "em_estoque",
  "em_transferencia",
  "despachado",
  "entregue",
  "retirado"
]);

export const transferStatusEnum_UNUSED = pgEnum("transfer_status", [
  "pendente",
  "autorizada",
  "em_transito",
  "concluida",
  "cancelada",
]);

export const transportStatusEnum = pgEnum("transport_status", [
  "pendente",
  "pendente_aprovacao",
  "aguardando_saida",
  "em_transito",
  "entregue",
  "cancelado"
]);

export const collectStatusEnum = pgEnum("collect_status", [
  "em_transito",
  "autorizado_portaria",
  "finalizada"
]);

export const driverTypeEnum = pgEnum("driver_type", [
  "coleta",
  "transporte",
]);

export const driverModalityEnum = pgEnum("driver_modality", [
  "pj",
  "clt",
  "agregado"
]);

export const driverNotificationStatusEnum = pgEnum("driver_notification_status", [
  "pendente",
  "aceito",
  "recusado"
]);

// Brazilian states
export const brazilianStates = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
] as const;

// CNH Types
export const cnhTypes = ["A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"] as const;

// ============== MOTORISTAS (Drivers) ==============
export const drivers = pgTable("drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cpf: varchar("cpf", { length: 14 }).notNull().unique(),
  rg: varchar("rg", { length: 20 }),
  cnpj: varchar("cnpj", { length: 20 }),
  companyName: text("company_name"),
  phone: varchar("phone", { length: 20 }).notNull(),
  email: varchar("email", { length: 255 }),
  birthDate: date("birth_date"),
  cep: varchar("cep", { length: 10 }),
  address: text("address"),
  addressNumber: varchar("address_number", { length: 20 }),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  latitude: text("latitude"),
  longitude: text("longitude"),
  driverType: driverTypeEnum("driver_type"),
  modality: driverModalityEnum("modality"),
  cnhType: varchar("cnh_type", { length: 5 }).notNull(),
  cnhFrontPhoto: text("cnh_front_photo"),
  cnhBackPhoto: text("cnh_back_photo"),
  rgPhoto: text("rg_photo"),
  addressProofPhoto: text("address_proof_photo"),
  profilePhoto: text("profile_photo"),
  isApto: text("is_apto").default("false"),
  isActive: text("is_active").default("true"),
  documentsApproved: text("documents_approved").default("pendente"),
  documentsApprovedAt: timestamp("documents_approved_at"),
  documentsApprovedBy: text("documents_approved_by"),
  freightContractId: varchar("freight_contract_id"),
  registrationSource: varchar("registration_source", { length: 20 }).default("sistema"),
  deviceToken: text("device_token"),
  collectType: text("collect_type").default("coleta"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driversRelations = relations(drivers, ({ many }) => ({
  transports: many(transports),
  collects: many(collects),
  driverNotifications: many(driverNotifications),
}));

export const insertDriverSchema = createInsertSchema(drivers).omit({
  id: true,
  createdAt: true,
}).extend({
  cpf: z.string().min(11, "CPF inválido").max(14),
  rg: z.string().optional().or(z.literal("")),
  cnpj: z.string().optional().or(z.literal("")),
  companyName: z.string().optional().or(z.literal("")),
  phone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  modality: z.enum(["pj", "clt", "agregado"]),
  cnhType: z.enum(cnhTypes),
  state: z.enum(brazilianStates).optional(),
});

export type InsertDriver = z.infer<typeof insertDriverSchema>;
export type Driver = typeof drivers.$inferSelect;

// LGPD - Driver deletion requests
export const driverDeletionRequests = pgTable("driver_deletion_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  channel: text("channel").notNull(),
  notes: text("notes"),
  status: text("status").notNull().default("em_aberto"),
  completionNotes: text("completion_notes"),
  completedAt: timestamp("completed_at"),
  completedByUserId: varchar("completed_by_user_id"),
  completedByUserName: text("completed_by_user_name"),
  requestedByUserId: varchar("requested_by_user_id"),
  requestedByUserName: text("requested_by_user_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDriverDeletionRequestSchema = createInsertSchema(driverDeletionRequests).omit({
  id: true,
  createdAt: true,
}).extend({
  channel: z.string().min(1, "Canal é obrigatório"),
});

export type InsertDriverDeletionRequest = z.infer<typeof insertDriverDeletionRequestSchema>;
export type DriverDeletionRequest = typeof driverDeletionRequests.$inferSelect;

// ============== MONTADORAS (Manufacturers) ==============
export const manufacturers = pgTable("manufacturers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cep: varchar("cep", { length: 10 }),
  address: text("address"),
  addressNumber: varchar("address_number", { length: 20 }),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  latitude: text("latitude"),
  longitude: text("longitude"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  contactName: text("contact_name"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const manufacturersRelations = relations(manufacturers, ({ many }) => ({
  collects: many(collects),
  vehicles: many(vehicles),
}));

export const insertManufacturerSchema = createInsertSchema(manufacturers).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Nome é obrigatório"),
  state: z.enum(brazilianStates).optional().or(z.literal("")).transform(val => val === "" ? undefined : val),
});

export type InsertManufacturer = z.infer<typeof insertManufacturerSchema>;
export type Manufacturer = typeof manufacturers.$inferSelect;

// ============== PÁTIOS (Yards) ==============
export const yards = pgTable("yards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cep: varchar("cep", { length: 10 }),
  address: text("address"),
  addressNumber: varchar("address_number", { length: 20 }),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  latitude: text("latitude"),
  longitude: text("longitude"),
  phone: varchar("phone", { length: 20 }),
  maxVehicles: integer("max_vehicles"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const yardsRelations = relations(yards, ({ many }) => ({
  collectsAsOrigin: many(collects, { relationName: "collectOriginYard" }),
  collectsAsDestination: many(collects, { relationName: "collectDestinationYard" }),
  transportsAsOrigin: many(transports),
  vehicles: many(vehicles),
  driverNotifications: many(driverNotifications),
}));

export const insertYardSchema = createInsertSchema(yards).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Nome é obrigatório"),
  state: z.enum(brazilianStates).optional().or(z.literal("")).transform(val => val === "" ? undefined : val),
});

export type InsertYard = z.infer<typeof insertYardSchema>;
export type Yard = typeof yards.$inferSelect;

// ============== CLIENTES (Clients) ==============
export const clients = pgTable("clients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  cnpj: varchar("cnpj", { length: 20 }),
  cep: varchar("cep", { length: 10 }),
  address: text("address"),
  addressNumber: varchar("address_number", { length: 20 }),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  latitude: text("latitude"),
  longitude: text("longitude"),
  phone: varchar("phone", { length: 20 }),
  email: varchar("email", { length: 255 }),
  contactName: text("contact_name"),
  dailyCost: text("daily_cost"),
  yardGraceDays: integer("yard_grace_days").default(0),
  username: varchar("username", { length: 100 }),
  password: varchar("password", { length: 255 }),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const clientsRelations = relations(clients, ({ many }) => ({
  deliveryLocations: many(deliveryLocations),
  vehicles: many(vehicles),
  transports: many(transports),
}));

export const insertClientSchema = createInsertSchema(clients).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Nome é obrigatório"),
  cnpj: z.string().optional(),
});

export type InsertClient = z.infer<typeof insertClientSchema>;
export type Client = typeof clients.$inferSelect;

// ============== LOCAIS DE ENTREGA (Delivery Locations) ==============
export const deliveryLocations = pgTable("delivery_locations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  name: text("name").notNull(),
  cnpj: varchar("cnpj", { length: 20 }),
  cep: varchar("cep", { length: 20 }),
  address: text("address").notNull(),
  addressNumber: varchar("address_number", { length: 20 }),
  complement: text("complement"),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  state: varchar("state", { length: 50 }),
  country: varchar("country", { length: 50 }).default("Brasil"),
  latitude: text("latitude"),
  longitude: text("longitude"),
  responsibleName: text("responsible_name"),
  responsiblePhone: varchar("responsible_phone", { length: 20 }),
  emails: text("emails").array(),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deliveryLocationsRelations = relations(deliveryLocations, ({ one, many }) => ({
  client: one(clients, {
    fields: [deliveryLocations.clientId],
    references: [clients.id],
  }),
  transports: many(transports),
  driverNotifications: many(driverNotifications),
}));

export const insertDeliveryLocationSchema = createInsertSchema(deliveryLocations).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Nome do local é obrigatório"),
  cnpj: z.string().optional(),
  cep: z.string().optional(),
  address: z.string().min(5, "Endereço é obrigatório"),
  addressNumber: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().min(2, "Município é obrigatório"),
  state: z.string().optional(),
  responsibleName: z.string().min(2, "Nome do responsável é obrigatório"),
  responsiblePhone: z.string().optional(),
  emails: z.array(z.string().email("Email inválido")).min(1, "Pelo menos um email é obrigatório"),
});

export type InsertDeliveryLocation = z.infer<typeof insertDeliveryLocationSchema>;
export type DeliveryLocation = typeof deliveryLocations.$inferSelect;

// ============== ESTOQUE / VEÍCULOS (Vehicles) ==============
export const vehicles = pgTable("vehicles", {
  chassi: varchar("chassi", { length: 50 }).primaryKey(),
  clientId: varchar("client_id").references(() => clients.id),
  yardId: varchar("yard_id").references(() => yards.id),
  manufacturerId: varchar("manufacturer_id").references(() => manufacturers.id),
  color: text("color"),
  status: vehicleStatusEnum("status").default("pre_estoque").notNull(),
  collectDateTime: timestamp("collect_date_time"),
  yardEntryDateTime: timestamp("yard_entry_date_time"),
  dispatchDateTime: timestamp("dispatch_date_time"),
  deliveryDateTime: timestamp("delivery_date_time"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vehiclesRelations = relations(vehicles, ({ one, many }) => ({
  client: one(clients, {
    fields: [vehicles.clientId],
    references: [clients.id],
  }),
  yard: one(yards, {
    fields: [vehicles.yardId],
    references: [yards.id],
  }),
  manufacturer: one(manufacturers, {
    fields: [vehicles.manufacturerId],
    references: [manufacturers.id],
  }),
  collects: many(collects),
  transports: many(transports),
}));

const emptyToNull = z.string().trim().transform((v) => (v === "" ? null : v)).nullable();

export const insertVehicleSchema = createInsertSchema(vehicles).omit({
  createdAt: true,
}).extend({
  chassi: z.string().min(7, "Chassi deve ter no mínimo 7 caracteres").max(50),
  status: z.enum(["pre_estoque", "em_estoque", "despachado", "entregue", "retirado"]).optional(),
  clientId: emptyToNull.optional(),
  yardId: emptyToNull.optional(),
  manufacturerId: emptyToNull.optional(),
});

export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// ============== COLETAS (Collects) ==============
export const collects = pgTable("collects", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleChassi: varchar("vehicle_chassi", { length: 50 }).notNull(),
  manufacturerId: varchar("manufacturer_id").references(() => manufacturers.id),
  originYardId: varchar("origin_yard_id").references(() => yards.id),
  yardId: varchar("yard_id").notNull().references(() => yards.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  collectType: text("collect_type").default("coleta").notNull(),
  status: collectStatusEnum("status").default("em_transito").notNull(),
  collectDate: timestamp("collect_date"),
  notes: text("notes"),
  startLatitude: varchar("start_latitude"),
  startLongitude: varchar("start_longitude"),
  endLatitude: varchar("end_latitude"),
  endLongitude: varchar("end_longitude"),
  latitude: varchar("latitude"),
  longitude: varchar("longitude"),
  // Check-in fields (at manufacturer pickup)
  checkinDateTime: timestamp("checkin_date_time"),
  checkinLocation: geometry("checkin_location"),
  checkinFrontalPhoto: text("checkin_frontal_photo"),
  checkinLateral1Photo: text("checkin_lateral1_photo"),
  checkinLateral2Photo: text("checkin_lateral2_photo"),
  checkinTraseiraPhoto: text("checkin_traseira_photo"),
  checkinOdometerPhoto: text("checkin_odometer_photo"),
  checkinFuelLevelPhoto: text("checkin_fuel_level_photo"),
  checkinDamagePhotos: text("checkin_damage_photos").array(),
  checkinSelfiePhoto: text("checkin_selfie_photo"),
  checkinNotes: text("checkin_notes"),
  // Check-out fields (at yard delivery)
  checkoutDateTime: timestamp("checkout_date_time"),
  checkoutLocation: geometry("checkout_location"),
  checkoutApprovedById: varchar("checkout_approved_by_id"),
  checkoutFrontalPhoto: text("checkout_frontal_photo"),
  checkoutLateral1Photo: text("checkout_lateral1_photo"),
  checkoutLateral2Photo: text("checkout_lateral2_photo"),
  checkoutTraseiraPhoto: text("checkout_traseira_photo"),
  checkoutOdometerPhoto: text("checkout_odometer_photo"),
  checkoutFuelLevelPhoto: text("checkout_fuel_level_photo"),
  checkoutDamagePhotos: text("checkout_damage_photos").array(),
  checkoutSelfiePhoto: text("checkout_selfie_photo"),
  checkoutNotes: text("checkout_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const collectsRelations = relations(collects, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [collects.vehicleChassi],
    references: [vehicles.chassi],
  }),
  manufacturer: one(manufacturers, {
    fields: [collects.manufacturerId],
    references: [manufacturers.id],
  }),
  originYard: one(yards, {
    fields: [collects.originYardId],
    references: [yards.id],
    relationName: "collectOriginYard",
  }),
  yard: one(yards, {
    fields: [collects.yardId],
    references: [yards.id],
    relationName: "collectDestinationYard",
  }),
  driver: one(drivers, {
    fields: [collects.driverId],
    references: [drivers.id],
  }),
}));

const geometryPointSchema = z.object({
  type: z.literal("Point"),
  coordinates: z.tuple([z.number(), z.number()]),
}).nullable().optional();

export const insertCollectSchema = createInsertSchema(collects).omit({
  id: true,
  createdAt: true,
}).extend({
  vehicleChassi: z.string().min(7, "Chassi deve ter no mínimo 7 caracteres"),
  manufacturerId: z.string().optional(),
  originYardId: z.string().optional(),
  yardId: z.string().min(1, "Pátio de destino é obrigatório"),
  collectType: z.enum(["coleta", "transferencia"]).default("coleta"),
  driverId: z.string().optional(),
  collectDate: z.union([z.string(), z.date()]).optional().transform(val => val ? new Date(val) : undefined),
  notes: z.string().optional(),
  startLatitude: z.union([z.string(), z.number()]).optional().transform(val => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  startLongitude: z.union([z.string(), z.number()]).optional().transform(val => val !== undefined && val !== null && val !== "" ? String(val) : undefined),
  endLatitude: z.union([z.string(), z.number()]).optional().transform(val => val !== undefined && val !== null ? String(val) : undefined),
  endLongitude: z.union([z.string(), z.number()]).optional().transform(val => val !== undefined && val !== null ? String(val) : undefined),
  checkinDateTime: z.union([z.string(), z.date()]).optional().transform(val => val ? new Date(val) : undefined),
  checkinLocation: geometryPointSchema,
  checkinFrontalPhoto: z.string().optional(),
  checkinLateral1Photo: z.string().optional(),
  checkinLateral2Photo: z.string().optional(),
  checkinTraseiraPhoto: z.string().optional(),
  checkinOdometerPhoto: z.string().optional(),
  checkinFuelLevelPhoto: z.string().optional(),
  checkinDamagePhotos: z.array(z.string()).optional(),
  checkinSelfiePhoto: z.string().optional(),
  checkinNotes: z.string().optional(),
  checkoutDateTime: z.union([z.string(), z.date()]).optional().transform(val => val ? new Date(val) : undefined),
  checkoutLocation: geometryPointSchema,
  checkoutFrontalPhoto: z.string().optional(),
  checkoutLateral1Photo: z.string().optional(),
  checkoutLateral2Photo: z.string().optional(),
  checkoutTraseiraPhoto: z.string().optional(),
  checkoutOdometerPhoto: z.string().optional(),
  checkoutFuelLevelPhoto: z.string().optional(),
  checkoutDamagePhotos: z.array(z.string()).optional(),
  checkoutSelfiePhoto: z.string().optional(),
  checkoutNotes: z.string().optional(),
});

export type InsertCollect = z.infer<typeof insertCollectSchema>;
export type Collect = typeof collects.$inferSelect;

// ============== TRANSPORTES (Transports) ==============
export const transports = pgTable("transports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  requestNumber: varchar("request_number", { length: 20 }).notNull().unique(),
  vehicleChassi: varchar("vehicle_chassi", { length: 50 }).notNull().references(() => vehicles.chassi),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  originYardId: varchar("origin_yard_id").notNull().references(() => yards.id),
  deliveryLocationId: varchar("delivery_location_id").notNull().references(() => deliveryLocations.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  travelRateId: varchar("travel_rate_id"),
  status: transportStatusEnum("status").default("pendente").notNull(),
  deliveryDate: timestamp("delivery_date"),
  scheduledDeparture: timestamp("scheduled_departure"),
  notes: text("notes"),
  documents: text("documents").array(),
  createdAt: timestamp("created_at").defaultNow(),
  createdByUserId: varchar("created_by_user_id"),
  driverAssignedByUserId: varchar("driver_assigned_by_user_id"),
  driverAssignedAt: timestamp("driver_assigned_at"),
  transitStartedAt: timestamp("transit_started_at"),
  // Check-in fields (pickup from yard)
  checkinDateTime: timestamp("checkin_date_time"),
  checkinLocation: geometry("checkin_location"),
  checkinFrontalPhoto: text("checkin_frontal_photo"),
  checkinLateral1Photo: text("checkin_lateral1_photo"),
  checkinLateral2Photo: text("checkin_lateral2_photo"),
  checkinTraseiraPhoto: text("checkin_traseira_photo"),
  checkinOdometerPhoto: text("checkin_odometer_photo"),
  checkinFuelLevelPhoto: text("checkin_fuel_level_photo"),
  checkinDamagePhotos: text("checkin_damage_photos").array(),
  checkinInteriorPhotos: text("checkin_interior_photos").array(),
  checkinSelfiePhoto: text("checkin_selfie_photo"),
  checkinNotes: text("checkin_notes"),
  // Check-out fields (delivery to client)
  checkoutDateTime: timestamp("checkout_date_time"),
  checkoutLocation: geometry("checkout_location"),
  checkoutFrontalPhoto: text("checkout_frontal_photo"),
  checkoutLateral1Photo: text("checkout_lateral1_photo"),
  checkoutLateral2Photo: text("checkout_lateral2_photo"),
  checkoutTraseiraPhoto: text("checkout_traseira_photo"),
  checkoutOdometerPhoto: text("checkout_odometer_photo"),
  checkoutFuelLevelPhoto: text("checkout_fuel_level_photo"),
  checkoutDamagePhotos: text("checkout_damage_photos").array(),
  checkoutInteriorPhotos: text("checkout_interior_photos").array(),
  checkoutSelfiePhoto: text("checkout_selfie_photo"),
  checkoutNotes: text("checkout_notes"),
  // Route information (calculated when transport is created)
  routeDistanceKm: numeric("route_distance_km"),
  routeDurationMinutes: integer("route_duration_minutes"),
  estimatedTolls: numeric("estimated_tolls"),
  estimatedFuel: numeric("estimated_fuel"),
  // Travel rate approval workflow
  travelRateApprovalStatus: text("travel_rate_approval_status"),
  travelRateApprovedBy: varchar("travel_rate_approved_by"),
  travelRateApprovedAt: timestamp("travel_rate_approved_at"),
  travelRateApprovalNote: text("travel_rate_approval_note"),
}, (t) => ({
  uniqActiveTransportPerChassi: uniqueIndex("uniq_active_transport_per_chassi")
    .on(t.vehicleChassi)
    .where(sql`${t.status} NOT IN ('entregue', 'cancelado')`),
}));

export const transportsRelations = relations(transports, ({ one }) => ({
  vehicle: one(vehicles, {
    fields: [transports.vehicleChassi],
    references: [vehicles.chassi],
  }),
  client: one(clients, {
    fields: [transports.clientId],
    references: [clients.id],
  }),
  originYard: one(yards, {
    fields: [transports.originYardId],
    references: [yards.id],
  }),
  deliveryLocation: one(deliveryLocations, {
    fields: [transports.deliveryLocationId],
    references: [deliveryLocations.id],
  }),
  driver: one(drivers, {
    fields: [transports.driverId],
    references: [drivers.id],
  }),
  createdByUser: one(systemUsers, {
    fields: [transports.createdByUserId],
    references: [systemUsers.id],
  }),
  driverAssignedByUser: one(systemUsers, {
    fields: [transports.driverAssignedByUserId],
    references: [systemUsers.id],
  }),
}));

export const insertTransportSchema = createInsertSchema(transports).omit({
  id: true,
  requestNumber: true,
  createdAt: true,
}).extend({
  vehicleChassi: z.string().min(7, "Chassi é obrigatório"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  originYardId: z.string().min(1, "Pátio de origem é obrigatório"),
  deliveryLocationId: z.string().min(1, "Local de entrega é obrigatório"),
  driverId: z.string().optional().nullable(),
  status: z.enum(["pendente", "pendente_aprovacao", "aguardando_saida", "em_transito", "entregue", "cancelado"]).default("pendente"),
  deliveryDate: z.union([z.string(), z.date()]).optional().nullable().transform(val => (val && val !== "") ? new Date(val) : undefined),
  scheduledDeparture: z.union([z.string(), z.date()]).optional().nullable().transform(val => (val && val !== "") ? new Date(val) : undefined),
  transitStartedAt: z.union([z.string(), z.date()]).optional().nullable().transform(val => (val && val !== "") ? new Date(val) : undefined),
  notes: z.string().optional().nullable(),
  documents: z.array(z.string()).optional().nullable(),
  // Check-in fields
  checkinDateTime: z.union([z.string(), z.date()]).optional().transform(val => val ? new Date(val) : undefined),
  checkinFrontalPhoto: z.string().optional(),
  checkinLateral1Photo: z.string().optional(),
  checkinLateral2Photo: z.string().optional(),
  checkinTraseiraPhoto: z.string().optional(),
  checkinOdometerPhoto: z.string().optional(),
  checkinFuelLevelPhoto: z.string().optional(),
  checkinDamagePhotos: z.array(z.string()).optional(),
  checkinInteriorPhotos: z.array(z.string()).optional(),
  checkinSelfiePhoto: z.string().optional(),
  checkinNotes: z.string().optional(),
  // Check-out fields
  checkoutDateTime: z.union([z.string(), z.date()]).optional().transform(val => val ? new Date(val) : undefined),
  checkoutFrontalPhoto: z.string().optional(),
  checkoutLateral1Photo: z.string().optional(),
  checkoutLateral2Photo: z.string().optional(),
  checkoutTraseiraPhoto: z.string().optional(),
  checkoutOdometerPhoto: z.string().optional(),
  checkoutFuelLevelPhoto: z.string().optional(),
  checkoutDamagePhotos: z.array(z.string()).optional(),
  checkoutInteriorPhotos: z.array(z.string()).optional(),
  checkoutSelfiePhoto: z.string().optional(),
  checkoutNotes: z.string().optional(),
});

export type InsertTransport = z.infer<typeof insertTransportSchema>;
export type Transport = typeof transports.$inferSelect;

// ============== NOTIFICAÇÕES DE MOTORISTA (Driver Notifications) ==============
export const driverNotifications = pgTable("driver_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  yardId: varchar("yard_id").notNull().references(() => yards.id),
  deliveryLocationId: varchar("delivery_location_id").notNull().references(() => deliveryLocations.id),
  departureDate: date("departure_date").notNull(),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  status: driverNotificationStatusEnum("status").default("pendente").notNull(),
  respondedAt: timestamp("responded_at"),
  notifiedAt: timestamp("notified_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const driverNotificationsRelations = relations(driverNotifications, ({ one }) => ({
  yard: one(yards, {
    fields: [driverNotifications.yardId],
    references: [yards.id],
  }),
  deliveryLocation: one(deliveryLocations, {
    fields: [driverNotifications.deliveryLocationId],
    references: [deliveryLocations.id],
  }),
  driver: one(drivers, {
    fields: [driverNotifications.driverId],
    references: [drivers.id],
  }),
}));

export const insertDriverNotificationSchema = createInsertSchema(driverNotifications).omit({
  id: true,
  createdAt: true,
  respondedAt: true,
});

export type InsertDriverNotification = z.infer<typeof insertDriverNotificationSchema>;
export type DriverNotification = typeof driverNotifications.$inferSelect;

// ============== REQUEST COUNTER (for OTD numbers) ==============
export const requestCounter = pgTable("request_counter", {
  id: varchar("id").primaryKey().default("transport_counter"),
  lastNumber: integer("last_number").default(0).notNull(),
});

export type RequestCounter = typeof requestCounter.$inferSelect;

// ============== USUÁRIOS DO SISTEMA (System Users) ==============
export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "operador",
  "visualizador"
]);

export const systemUsers = pgTable("system_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  password: varchar("password", { length: 255 }).notNull(),
  role: varchar("role", { length: 50 }).default("operador").notNull(),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSystemUserSchema = createInsertSchema(systemUsers).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido"),
  username: z.string().min(3, "Usuário deve ter no mínimo 3 caracteres"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export type InsertSystemUser = z.infer<typeof insertSystemUserSchema>;
export type SystemUser = typeof systemUsers.$inferSelect;

// ============== PERMISSÕES POR PERFIL (Role Permissions) ==============
export const featureKeys = [
  "dashboard",
  "transportes",
  "coletas",
  "motoristas",
  "montadoras",
  "api-docs",
  "patios",
  "clientes",
  "locais",
  "veiculos",
  "usuarios",
  "proposta-transporte",
  "trafego-agora",
  "portaria",
  "financeiro",
] as const;

export type FeatureKey = typeof featureKeys[number];

// ============== TIPOS DE USUÁRIO (User Types / Custom Roles) ==============
export const userTypes = pgTable("user_types", {
  id: varchar("id", { length: 50 }).primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: text("is_system").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserTypeSchema = createInsertSchema(userTypes).omit({ createdAt: true });
export type InsertUserType = z.infer<typeof insertUserTypeSchema>;
export type UserType = typeof userTypes.$inferSelect;

export const userTypePermissions = pgTable("user_type_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userTypeId: varchar("user_type_id", { length: 50 }).notNull().references(() => userTypes.id, { onDelete: "cascade" }),
  feature: varchar("feature", { length: 100 }).notNull(),
  canView: text("can_view").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserTypePermissionSchema = createInsertSchema(userTypePermissions).omit({ id: true, createdAt: true });
export type InsertUserTypePermission = z.infer<typeof insertUserTypePermissionSchema>;
export type UserTypePermission = typeof userTypePermissions.$inferSelect;

export const menuFeatures = [
  { key: "dashboard", label: "Dashboard", group: "Dados" },
  { key: "consulta-inteligente", label: "Consulta Inteligente", group: "Dados" },
  { key: "coletas", label: "Coletas", group: "Operação" },
  { key: "transportes", label: "Transportes", group: "Operação" },
  { key: "proposta-transporte", label: "Proposta de Transporte", group: "Operação" },
  { key: "aprovacao-tarifa", label: "Aprovação de Tarifa", group: "Operação" },
  { key: "portaria", label: "Portaria", group: "Operação" },
  { key: "solicitacoes-cliente", label: "Solicitações Cliente", group: "Operação" },
  { key: "perfil-motorista", label: "Perfil do Motorista", group: "Motorista" },
  { key: "status-motoristas", label: "Status dos Motoristas", group: "Motorista" },
  { key: "performance-motoristas", label: "Performance Motorista", group: "Motorista" },
  { key: "ranking-motoristas", label: "Ranking de Motoristas", group: "Motorista" },
  { key: "avaliacao", label: "Avaliação", group: "Motorista" },
  { key: "criterios-avaliacao", label: "Critérios de Avaliação", group: "Motorista" },
  { key: "broadcast", label: "Broadcast", group: "Motorista" },
  { key: "informe-exclusao", label: "Informe de Exclusão LGPD", group: "Motorista" },
  { key: "jornada-veiculo", label: "Jornada do Veículo", group: "Relatórios" },
  { key: "relatorio-avarias", label: "Relatório de Avarias", group: "Relatórios" },
  { key: "relatorio-propostas", label: "Propostas de Transporte", group: "Relatórios" },
  { key: "relatorio-propostas-justificadas", label: "Propostas Justificadas", group: "Relatórios" },
  { key: "prestacao-de-contas", label: "Prestação de Contas", group: "Financeiro" },
  { key: "dashboard-financeiro", label: "Dashboard Financeiro", group: "Financeiro" },
  { key: "relatorio-patio", label: "Relatório de Pátio", group: "Financeiro" },
  { key: "fechamento-mensal", label: "Fechamento Mensal", group: "Financeiro" },
  { key: "cadastro-motoristas", label: "Motoristas", group: "Cadastros" },
  { key: "rastreadores", label: "Rastreadores", group: "Cadastros" },
  { key: "montadoras", label: "Montadoras", group: "Cadastros" },
  { key: "clientes", label: "Clientes", group: "Cadastros" },
  { key: "patios", label: "Pátios", group: "Cadastros" },
  { key: "estoque", label: "Estoque", group: "Cadastros" },
  { key: "modelos", label: "Modelos", group: "Cadastros" },
  { key: "tarifas-viagem", label: "Tarifas de Viagem", group: "Cadastros" },
  { key: "gestao-rotas", label: "Gestão de Rotas", group: "Cadastros" },
  { key: "contratos", label: "Gestor de Contratos", group: "Cadastros" },
  { key: "contratos-frete", label: "Contratos de Frete", group: "Cadastros" },
  { key: "assinatura-digital", label: "Assinatura Digital", group: "Cadastros" },
  { key: "cotacao-frete", label: "Cotação de Frete", group: "Cadastros" },
  { key: "observabilidade-engajamento", label: "Engajamento", group: "Observabilidade" },
  { key: "usuarios", label: "Usuários", group: "Configurações" },
  { key: "integracoes", label: "Integrações", group: "Configurações" },
  { key: "lista-endpoints", label: "Lista de Endpoints", group: "Configurações" },
  { key: "logs-api", label: "Log de API", group: "Configurações" },
  { key: "backup", label: "Backup", group: "Configurações" },
  { key: "permissoes", label: "Permissões", group: "Configurações" },
  { key: "criar-usuarios", label: "Criar/Editar Usuários", group: "Configurações" },
  { key: "push-mensagens", label: "Mensagens", group: "Configurações" },
  { key: "ranking-config", label: "Ranking Motoristas (config)", group: "Configurações" },
  { key: "controle-versao", label: "Controle de Versão", group: "Configurações" },
] as const;

// ============== SYSTEM VERSIONS (CONTROLE DE VERSÃO) ==============
export const systemVersions = pgTable("system_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: varchar("type", { length: 10 }).notNull(), // "web" | "app"
  version: varchar("version", { length: 50 }).notNull(),
  description: text("description"),
  deployDate: timestamp("deploy_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSystemVersionSchema = createInsertSchema(systemVersions, {
  type: z.enum(["web", "app"]),
  version: z.string().min(1, "Informe a versão"),
  deployDate: z.coerce.date(),
}).omit({ id: true, createdAt: true });

export type InsertSystemVersion = z.infer<typeof insertSystemVersionSchema>;
export type SystemVersion = typeof systemVersions.$inferSelect;

export const rolePermissions = pgTable("role_permissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: userRoleEnum("role").notNull(),
  feature: varchar("feature", { length: 50 }).notNull().$type<FeatureKey>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
  id: true,
  createdAt: true,
});

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// ============== PRESTAÇÃO DE CONTAS (Expense Settlements) ==============
export const expenseSettlementStatusEnum = pgEnum("expense_settlement_status", [
  "pendente",        // Aguardando envio pelo motorista
  "enviado",         // Enviado pelo motorista, aguardando análise
  "devolvido",       // Devolvido para o motorista (foto ruim, etc)
  "aprovado",        // Aprovado pelo financeiro
  "assinado"         // Assinado pelo motorista no app
]);

export const expenseTypeEnum = pgEnum("expense_type", [
  "pedagio",
  "combustivel",
  "alimentacao",
  "hospedagem",
  "manutencao",
  "multa",
  "estacionamento",
  "lavagem",
  "passagem",
  "outros"
]);

export const expenseSettlements = pgTable("expense_settlements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transportId: varchar("transport_id").notNull().references(() => transports.id),
  driverId: varchar("driver_id").references(() => drivers.id),
  status: expenseSettlementStatusEnum("status").default("pendente"),
  
  // Resumo enviado pelo motorista
  driverNotes: text("driver_notes"),
  totalExpenses: text("total_expenses"),  // Valor total das despesas
  
  // Adiantamento e saldo
  advanceAmount: text("advance_amount"),  // Valor adiantado ao motorista
  balanceAmount: text("balance_amount"),  // Saldo (despesas - adiantamento): positivo = a receber, negativo = a devolver
  
  // Valores do transporte (copiados para referência)
  routeDistance: text("route_distance"),
  estimatedTolls: text("estimated_tolls"),
  estimatedFuel: text("estimated_fuel"),
  
  // Datas importantes
  submittedAt: timestamp("submitted_at"),        // Quando motorista enviou
  reviewedAt: timestamp("reviewed_at"),          // Quando foi analisado
  approvedAt: timestamp("approved_at"),          // Quando foi aprovado
  signedAt: timestamp("signed_at"),              // Quando foi assinado
  driverFinishedSubmissionAt: timestamp("driver_finished_submission_at"), // Quando o motorista clicou "Finalizar envio" no app
  
  // Usuário que analisou
  reviewedByUserId: varchar("reviewed_by_user_id").references(() => authUsers.id),
  
  // Motivo da devolução (se aplicável)
  returnReason: text("return_reason"),
  
  // Documento gerado (URL do PDF)
  settlementDocumentUrl: text("settlement_document_url"),
  
  // Assinatura do motorista (imagem base64 ou URL)
  driverSignature: text("driver_signature"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseSettlementsRelations = relations(expenseSettlements, ({ one, many }) => ({
  transport: one(transports, {
    fields: [expenseSettlements.transportId],
    references: [transports.id],
  }),
  driver: one(drivers, {
    fields: [expenseSettlements.driverId],
    references: [drivers.id],
  }),
  reviewedByUser: one(authUsers, {
    fields: [expenseSettlements.reviewedByUserId],
    references: [authUsers.id],
  }),
  items: many(expenseSettlementItems),
}));

// Itens da prestação de contas (cada despesa com foto)
export const expenseSettlementItems = pgTable("expense_settlement_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  settlementId: varchar("settlement_id").notNull().references(() => expenseSettlements.id),
  type: expenseTypeEnum("type").notNull(),
  description: text("description"),
  country: varchar("country", { length: 10 }),  // BR, AR, CL, PE, UY
  currency: varchar("currency", { length: 10 }).notNull().default("BRL"), // BRL, ARS, CLP, PEN, UYU
  amount: text("amount").notNull(),         // Valor na moeda selecionada
  photoUrl: text("photo_url").notNull(),    // Foto do comprovante
  
  // Status da foto (para devoluções)
  photoStatus: text("photo_status").default("ok"),  // ok, borrada, ilegivel
  photoRejectionReason: text("photo_rejection_reason"),
  
  // Status de aprovação do item pelo admin
  itemStatus: text("item_status").default("pendente"),  // pendente, aprovado, reprovado
  approvedAmount: text("approved_amount"),              // Valor aprovado pelo admin (em BRL)
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const expenseSettlementItemsRelations = relations(expenseSettlementItems, ({ one }) => ({
  settlement: one(expenseSettlements, {
    fields: [expenseSettlementItems.settlementId],
    references: [expenseSettlements.id],
  }),
}));

export const insertExpenseSettlementSchema = createInsertSchema(expenseSettlements).omit({
  id: true,
  createdAt: true,
});

export const insertExpenseSettlementItemSchema = createInsertSchema(expenseSettlementItems).omit({
  id: true,
  createdAt: true,
});

export type InsertExpenseSettlement = z.infer<typeof insertExpenseSettlementSchema>;
export type ExpenseSettlement = typeof expenseSettlements.$inferSelect;
export type InsertExpenseSettlementItem = z.infer<typeof insertExpenseSettlementItemSchema>;
export type ExpenseSettlementItem = typeof expenseSettlementItems.$inferSelect;

// ============== CHECK POINTS ==============
export const checkpoints = pgTable("checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  city: text("city"),
  state: varchar("state", { length: 2 }),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCheckpointSchema = createInsertSchema(checkpoints).omit({
  id: true,
  createdAt: true,
});

export type InsertCheckpoint = z.infer<typeof insertCheckpointSchema>;
export type Checkpoint = typeof checkpoints.$inferSelect;

// Transport Checkpoints - associação de checkpoints a transportes
export const transportCheckpoints = pgTable("transport_checkpoints", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transportId: varchar("transport_id").notNull().references(() => transports.id),
  checkpointId: varchar("checkpoint_id").notNull().references(() => checkpoints.id),
  orderIndex: integer("order_index").notNull(), // ordem do checkpoint na rota
  status: varchar("status", { length: 20 }).default("pendente").notNull(), // pendente, alcancado, concluido
  reachedAt: timestamp("reached_at"), // quando o motorista alcançou o checkpoint
  latitude: text("latitude"), // localização real quando alcançou
  longitude: text("longitude"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transportCheckpointsRelations = relations(transportCheckpoints, ({ one }) => ({
  transport: one(transports, {
    fields: [transportCheckpoints.transportId],
    references: [transports.id],
  }),
  checkpoint: one(checkpoints, {
    fields: [transportCheckpoints.checkpointId],
    references: [checkpoints.id],
  }),
}));

export const insertTransportCheckpointSchema = createInsertSchema(transportCheckpoints).omit({
  id: true,
  createdAt: true,
});

export type InsertTransportCheckpoint = z.infer<typeof insertTransportCheckpointSchema>;
export type TransportCheckpoint = typeof transportCheckpoints.$inferSelect;

// ============== CRITÉRIOS DE AVALIAÇÃO (Evaluation Criteria) ==============
export const evaluationCriteria = pgTable("evaluation_criteria", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  weight: numeric("weight", { precision: 5, scale: 2 }).notNull(),
  penaltyLeve: numeric("penalty_leve", { precision: 5, scale: 2 }).default("10"),
  penaltyMedio: numeric("penalty_medio", { precision: 5, scale: 2 }).default("50"),
  penaltyGrave: numeric("penalty_grave", { precision: 5, scale: 2 }).default("100"),
  order: integer("sort_order").default(0),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertEvaluationCriteriaSchema = createInsertSchema(evaluationCriteria).omit({
  id: true,
  createdAt: true,
});

export type InsertEvaluationCriteria = z.infer<typeof insertEvaluationCriteriaSchema>;
export type EvaluationCriteria = typeof evaluationCriteria.$inferSelect;

// ============== AVALIAÇÕES DE MOTORISTAS (Driver Evaluations) ==============
export const ratingValueEnum = pgEnum("rating_value", [
  "pessimo",
  "ruim",
  "regular",
  "bom",
  "excelente"
]);

export const driverEvaluations = pgTable("driver_evaluations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  transportId: varchar("transport_id").notNull().references(() => transports.id),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  evaluatorId: varchar("evaluator_id").notNull(),
  evaluatorName: text("evaluator_name").notNull(),

  posturaProfissional: ratingValueEnum("postura_profissional"),
  pontualidade: ratingValueEnum("pontualidade"),
  apresentacaoPessoal: ratingValueEnum("apresentacao_pessoal"),
  cordialidade: ratingValueEnum("cordialidade"),
  cumpriuProcesso: ratingValueEnum("cumpriu_processo"),

  hadIncident: text("had_incident").default("false"),
  incidentDescription: text("incident_description"),

  averageScore: numeric("average_score", { precision: 5, scale: 2 }),
  weightedScore: numeric("weighted_score", { precision: 5, scale: 2 }),

  status: varchar("status").default("em_andamento"),

  createdAt: timestamp("created_at").defaultNow(),
});

// ============== NOTAS POR CRITÉRIO (Evaluation Scores) ==============
export const evaluationSeverityEnum = pgEnum("evaluation_severity", [
  "sem_ocorrencia",
  "leve",
  "medio",
  "grave",
]);

export const evaluationScores = pgTable("evaluation_scores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  evaluationId: varchar("evaluation_id").notNull().references(() => driverEvaluations.id),
  criteriaId: varchar("criteria_id").notNull().references(() => evaluationCriteria.id),
  score: numeric("score", { precision: 5, scale: 2 }).notNull(),
  severity: evaluationSeverityEnum("severity").default("sem_ocorrencia"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const evaluationScoresRelations = relations(evaluationScores, ({ one }) => ({
  evaluation: one(driverEvaluations, {
    fields: [evaluationScores.evaluationId],
    references: [driverEvaluations.id],
  }),
  criteria: one(evaluationCriteria, {
    fields: [evaluationScores.criteriaId],
    references: [evaluationCriteria.id],
  }),
}));

export const driverEvaluationsRelations = relations(driverEvaluations, ({ one, many }) => ({
  transport: one(transports, {
    fields: [driverEvaluations.transportId],
    references: [transports.id],
  }),
  driver: one(drivers, {
    fields: [driverEvaluations.driverId],
    references: [drivers.id],
  }),
  scores: many(evaluationScores),
}));

export const insertDriverEvaluationSchema = createInsertSchema(driverEvaluations).omit({
  id: true,
  createdAt: true,
});

export const insertEvaluationScoreSchema = createInsertSchema(evaluationScores).omit({
  id: true,
  createdAt: true,
});

export type InsertDriverEvaluation = z.infer<typeof insertDriverEvaluationSchema>;
export type DriverEvaluation = typeof driverEvaluations.$inferSelect;
export type InsertEvaluationScore = z.infer<typeof insertEvaluationScoreSchema>;
export type EvaluationScore = typeof evaluationScores.$inferSelect;

// ============== MODELOS DE CAMINHÃO (Truck Models) ==============
export const truckModels = pgTable("truck_models", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  axleConfig: text("axle_config").notNull(),
  averageConsumption: numeric("average_consumption", { precision: 5, scale: 2 }).notNull(),
  vehicleValue: numeric("vehicle_value", { precision: 12, scale: 2 }),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTruckModelSchema = createInsertSchema(truckModels).omit({
  id: true,
  createdAt: true,
});

export type InsertTruckModel = z.infer<typeof insertTruckModelSchema>;
export type TruckModel = typeof truckModels.$inferSelect;

// ============== COTAÇÕES DE FRETE (Freight Quotes) ==============
export const freightQuotes = pgTable("freight_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  quoteName: text("quote_name"),
  clientId: varchar("client_id"),
  clientName: text("client_name").notNull(),
  clientPhone: varchar("client_phone", { length: 20 }),
  clientEmail: varchar("client_email", { length: 255 }),
  validUntil: date("valid_until"),
  truckModelId: varchar("truck_model_id"),
  valorBem: numeric("valor_bem", { precision: 12, scale: 2 }).notNull(),
  distanciaKm: numeric("distancia_km", { precision: 10, scale: 2 }).notNull(),
  freteOtd: numeric("frete_otd", { precision: 10, scale: 2 }).notNull(),
  retornoMotorista: numeric("retorno_motorista", { precision: 10, scale: 2 }).notNull(),
  pedagio: numeric("pedagio", { precision: 10, scale: 2 }).notNull(),
  consumoVeiculo: numeric("consumo_veiculo", { precision: 5, scale: 2 }).notNull(),
  precoDiesel: numeric("preco_diesel", { precision: 6, scale: 2 }).notNull(),
  valorBase: numeric("valor_base", { precision: 12, scale: 2 }).notNull(),
  valorTotalCte: numeric("valor_total_cte", { precision: 12, scale: 2 }).notNull(),
  impostos: numeric("impostos", { precision: 12, scale: 2 }).notNull(),
  convertedToContractId: varchar("converted_to_contract_id"),
  convertedAt: timestamp("converted_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFreightQuoteSchema = createInsertSchema(freightQuotes).omit({
  id: true,
  createdAt: true,
});

export type InsertFreightQuote = z.infer<typeof insertFreightQuoteSchema>;
export type FreightQuote = typeof freightQuotes.$inferSelect;

// ============== TIPOS DE CAMINHÃO (Truck Types for Toll Calculation) ==============
export const truckTypeEnum = pgEnum("truck_type", [
  "2_eixos",
  "3_eixos",
  "4_eixos",
  "5_eixos",
  "6_eixos",
  "7_eixos",
  "9_eixos"
]);

// ============== GESTÃO DE ROTAS (Route Management) ==============
export const routes = pgTable("routes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  
  // Origem e Destino
  originYardId: varchar("origin_yard_id").notNull().references(() => yards.id),
  destinationLocationId: varchar("destination_location_id").notNull().references(() => deliveryLocations.id),
  
  // Dados da rota
  distanceKm: numeric("distance_km", { precision: 10, scale: 2 }),
  truckType: truckTypeEnum("truck_type").default("2_eixos"),
  
  // Parâmetros de combustível
  dieselPrice: numeric("diesel_price", { precision: 10, scale: 2 }), // R$/litro
  fuelConsumption: numeric("fuel_consumption", { precision: 5, scale: 2 }), // km/litro
  
  // Custos calculados e manuais
  fuelCost: numeric("fuel_cost", { precision: 10, scale: 2 }), // (distância / consumo) * preço
  arla32Cost: numeric("arla32_cost", { precision: 10, scale: 2 }), // 5% do combustível
  tollCost: numeric("toll_cost", { precision: 10, scale: 2 }), // Inserção manual
  
  // Logística do motorista
  driverDailyCost: numeric("driver_daily_cost", { precision: 10, scale: 2 }),
  returnTicket: numeric("return_ticket", { precision: 10, scale: 2 }),
  extraExpenses: numeric("extra_expenses", { precision: 10, scale: 2 }), // Uber, alimentação
  foodCost: numeric("food_cost", { precision: 10, scale: 2 }), // Alimentação
  othersCost: numeric("others_cost", { precision: 10, scale: 2 }), // Outros
  
  // Taxas e lucro
  adValoremPercentage: numeric("ad_valorem_percentage", { precision: 5, scale: 2 }), // % sobre valor veículo
  vehicleValue: numeric("vehicle_value", { precision: 15, scale: 2 }), // Valor do veículo para cálculo
  adValoremCost: numeric("ad_valorem_cost", { precision: 10, scale: 2 }), // Calculado
  profitMarginPercentage: numeric("profit_margin_percentage", { precision: 5, scale: 2 }), // % markup
  adminFee: numeric("admin_fee", { precision: 10, scale: 2 }), // Taxa fixa
  
  // Totais calculados
  totalCost: numeric("total_cost", { precision: 15, scale: 2 }),
  suggestedPrice: numeric("suggested_price", { precision: 15, scale: 2 }),
  netProfit: numeric("net_profit", { precision: 15, scale: 2 }),
  
  // Controle
  isFavorite: text("is_favorite").default("false"),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const routesRelations = relations(routes, ({ one }) => ({
  originYard: one(yards, {
    fields: [routes.originYardId],
    references: [yards.id],
  }),
  destinationLocation: one(deliveryLocations, {
    fields: [routes.destinationLocationId],
    references: [deliveryLocations.id],
  }),
}));

export const insertRouteSchema = createInsertSchema(routes).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  name: z.string().min(2, "Nome é obrigatório"),
});

export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

// ============== CONTRATOS (Contracts) ==============
export const contractStatusEnum = pgEnum("contract_status", [
  "ativo",
  "suspenso",
  "expirado",
  "cancelado"
]);

export const paymentTypeEnum = pgEnum("payment_type", [
  "por_km",
  "fixo_mensal",
  "por_entrega",
  "comissao"
]);

export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractNumber: varchar("contract_number", { length: 50 }).notNull().unique(),
  title: text("title").notNull(),
  driverId: varchar("driver_id").references(() => drivers.id),
  contractType: driverModalityEnum("contract_type").notNull(),
  status: contractStatusEnum("status").default("ativo").notNull(),
  content: text("content"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  paymentType: paymentTypeEnum("payment_type"),
  paymentValue: numeric("payment_value", { precision: 12, scale: 2 }),
  truckType: text("truck_type"),
  licensePlate: varchar("license_plate", { length: 10 }),
  cnhRequired: varchar("cnh_required", { length: 5 }),
  workRegion: text("work_region"),
  notes: text("notes"),
  // Driver signature date (populated when driver signs)
  driverSignedAt: timestamp("driver_signed_at"),
  // Autentique digital signature integration
  autentiqueDocId: varchar("autentique_doc_id"),
  autentiqueStatus: varchar("autentique_status", { length: 50 }),
  autentiqueSignedUrl: text("autentique_signed_url"),
  autentiqueOriginalUrl: text("autentique_original_url"),
  autentiqueSentAt: timestamp("autentique_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Junction table for N:N contract↔driver relationship.
// Each row stores per-driver Autentique signature info, allowing the same
// contract to be sent independently to multiple drivers.
export const contractDrivers = pgTable("contract_drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractId: varchar("contract_id").notNull().references(() => contracts.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  driverSignedAt: timestamp("driver_signed_at"),
  autentiqueDocId: varchar("autentique_doc_id"),
  autentiqueStatus: varchar("autentique_status", { length: 50 }),
  autentiqueSignedUrl: text("autentique_signed_url"),
  autentiqueOriginalUrl: text("autentique_original_url"),
  autentiqueSentAt: timestamp("autentique_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqContractDriver: uniqueIndex("uniq_contract_driver").on(t.contractId, t.driverId),
}));

export const contractDriversRelations = relations(contractDrivers, ({ one }) => ({
  contract: one(contracts, {
    fields: [contractDrivers.contractId],
    references: [contracts.id],
  }),
  driver: one(drivers, {
    fields: [contractDrivers.driverId],
    references: [drivers.id],
  }),
}));

export const contractsRelations = relations(contracts, ({ one, many }) => ({
  // Deprecated 1:1 relation — kept for backwards-compat reads
  driver: one(drivers, {
    fields: [contracts.driverId],
    references: [drivers.id],
  }),
  contractDrivers: many(contractDrivers),
}));

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  contractNumber: z.string().min(1, "Número do contrato é obrigatório"),
  title: z.string().min(1, "Título é obrigatório"),
  contractType: z.enum(["pj", "clt", "agregado"]),
  status: z.enum(["ativo", "suspenso", "expirado", "cancelado"]).optional(),
  paymentType: z.enum(["por_km", "fixo_mensal", "por_entrega", "comissao"]).optional().nullable(),
  paymentValue: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  content: z.string().optional().nullable(),
  driverIds: z.array(z.string()).optional(),
});

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export const insertContractDriverSchema = createInsertSchema(contractDrivers).omit({
  id: true,
  createdAt: true,
});
export type InsertContractDriver = z.infer<typeof insertContractDriverSchema>;
export type ContractDriver = typeof contractDrivers.$inferSelect;

// ============== CONTRATOS DE FRETE (Freight Contracts) ==============
export const freightContracts = pgTable("freight_contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contractNumber: varchar("contract_number", { length: 50 }).notNull().unique(),
  quoteId: varchar("quote_id"),
  clientId: varchar("client_id"),
  clientName: text("client_name").notNull(),
  clientPhone: varchar("client_phone", { length: 20 }),
  clientEmail: varchar("client_email", { length: 255 }),
  distanciaKm: numeric("distancia_km", { precision: 10, scale: 2 }),
  valorTotalCte: numeric("valor_total_cte", { precision: 12, scale: 2 }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: contractStatusEnum("status").default("ativo").notNull(),
  notes: text("notes"),
  content: text("content"),
  // Autentique digital signature integration
  autentiqueDocId: varchar("autentique_doc_id"),
  autentiqueStatus: varchar("autentique_status", { length: 50 }),
  autentiqueSignedUrl: text("autentique_signed_url"),
  autentiqueOriginalUrl: text("autentique_original_url"),
  autentiqueSentAt: timestamp("autentique_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertFreightContractSchema = createInsertSchema(freightContracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  contractNumber: z.string().min(1, "Número do contrato é obrigatório"),
  clientName: z.string().min(1, "Nome do cliente é obrigatório"),
  status: z.enum(["ativo", "suspenso", "expirado", "cancelado"]).optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  distanciaKm: z.string().optional().nullable(),
  valorTotalCte: z.string().optional().nullable(),
});

export type InsertFreightContract = z.infer<typeof insertFreightContractSchema>;
export type FreightContract = typeof freightContracts.$inferSelect;
// ============== TRANSFERÊNCIAS (somente leitura — página removida) ==============
export const transfers = pgTable("transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  vehicleChassi: varchar("vehicle_chassi").notNull(),
  originYardId: varchar("origin_yard_id").notNull(),
  destinationYardId: varchar("destination_yard_id").notNull(),
  driverId: varchar("driver_id"),
  requestedBy: varchar("requested_by"),
  authorizedBy: varchar("authorized_by"),
  status: transferStatusEnum_UNUSED("status").default("pendente").notNull(),
  notes: text("notes"),
  authorizedAt: timestamp("authorized_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type Transfer = typeof transfers.$inferSelect;

// ============== TARIFAS DE VIAGEM ==============
export const travelRateTypeEnum = pgEnum("travel_rate_type", [
  "por_km",
  "fixo",
  "por_veiculo",
]);

export const travelRates = pgTable("travel_rates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  originCity: text("origin_city"),
  originState: varchar("origin_state", { length: 2 }),
  destinationCity: text("destination_city"),
  destinationState: varchar("destination_state", { length: 2 }),
  rateType: travelRateTypeEnum("rate_type").notNull().default("fixo"),
  rateValue: numeric("rate_value", { precision: 12, scale: 2 }).notNull(),
  minDistance: numeric("min_distance", { precision: 8, scale: 2 }),
  maxDistance: numeric("max_distance", { precision: 8, scale: 2 }),
  vehicleType: text("vehicle_type"),
  notes: text("notes"),
  isActive: text("is_active").default("true"),
  requiresApproval: text("requires_approval").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTravelRateSchema = createInsertSchema(travelRates).omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(2, "Nome é obrigatório"),
  rateValue: z.string().min(1, "Valor é obrigatório"),
});

export type InsertTravelRate = z.infer<typeof insertTravelRateSchema>;
export type TravelRate = typeof travelRates.$inferSelect;

// ============== APROVADORES DE TARIFA ==============
export const travelRateApprovers = pgTable("travel_rate_approvers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  travelRateId: varchar("travel_rate_id").notNull().references(() => travelRates.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TravelRateApprover = typeof travelRateApprovers.$inferSelect;

// ============== FECHAMENTO MENSAL DE PÁTIO ==============
export const yardMonthlyInvoices = pgTable("yard_monthly_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id"),
  clientName: text("client_name").notNull(),
  referenceMonth: integer("reference_month").notNull(),
  referenceYear: integer("reference_year").notNull(),
  totalValue: text("total_value").notNull().default("0"),
  status: text("status").notNull().default("pending"),
  paymentDate: timestamp("payment_date"),
  dailyCostSnapshot: text("daily_cost_snapshot"),
  graceDaysSnapshot: integer("grace_days_snapshot").default(0),
  notes: text("notes"),
  generatedAt: timestamp("generated_at").defaultNow(),
});

export const yardMonthlyInvoiceItems = pgTable("yard_monthly_invoice_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  invoiceId: varchar("invoice_id").notNull(),
  chassi: varchar("chassi").notNull(),
  yardName: text("yard_name"),
  entryDate: timestamp("entry_date"),
  totalDaysInPatio: integer("total_days_in_patio").notNull().default(0),
  daysInPeriod: integer("days_in_period").notNull().default(0),
  graceDaysApplied: integer("grace_days_applied").notNull().default(0),
  billableDays: integer("billable_days").notNull().default(0),
  dailyCost: text("daily_cost").notNull().default("0"),
  subtotal: text("subtotal").notNull().default("0"),
});

export const insertYardMonthlyInvoiceSchema = createInsertSchema(yardMonthlyInvoices).omit({ id: true, generatedAt: true });
export type InsertYardMonthlyInvoice = z.infer<typeof insertYardMonthlyInvoiceSchema>;
export type YardMonthlyInvoice = typeof yardMonthlyInvoices.$inferSelect;

export const insertYardMonthlyInvoiceItemSchema = createInsertSchema(yardMonthlyInvoiceItems).omit({ id: true });
export type InsertYardMonthlyInvoiceItem = z.infer<typeof insertYardMonthlyInvoiceItemSchema>;
export type YardMonthlyInvoiceItem = typeof yardMonthlyInvoiceItems.$inferSelect;

// ============== LOG DE API ==============
export const apiLogs = pgTable("api_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  method: varchar("method", { length: 10 }).notNull(),
  path: varchar("path", { length: 500 }).notNull(),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms"),
  userId: varchar("user_id"),
  username: varchar("username", { length: 100 }),
  userRole: varchar("user_role", { length: 50 }),
  ipAddress: varchar("ip_address", { length: 100 }),
  requestBody: text("request_body"),
  responsePreview: text("response_preview"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertApiLogSchema = createInsertSchema(apiLogs).omit({ id: true });
export type InsertApiLog = z.infer<typeof insertApiLogSchema>;
export type ApiLog = typeof apiLogs.$inferSelect;

// ============== CONFIGURAÇÕES DO SISTEMA ==============
export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),
  value: text("value"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type AppSetting = typeof appSettings.$inferSelect;

// ============== TRANSPORTES EXCLUÍDOS ==============
// Tabela legada — guarda o snapshot do transporte excluído como JSON em `data`.
// IDs (id/original_id/deleted_by) são integer/serial por compatibilidade histórica.
export const deletedTransports = pgTable("deleted_transports", {
  id: serial("id").primaryKey(),
  originalId: integer("original_id"),
  data: jsonb("data").notNull(),
  deletedBy: integer("deleted_by"),
  deletedAt: timestamp("deleted_at").notNull().defaultNow(),
});

export type DeletedTransport = typeof deletedTransports.$inferSelect;
export type InsertDeletedTransport = typeof deletedTransports.$inferInsert;

// ============== PROPOSTAS DE TRANSPORTE ==============
export const proposalStatusEnum = pgEnum("proposal_status", ["ativa", "encerrada", "cancelada"]);
export const proposalDriverStatusEnum = pgEnum("proposal_driver_status", ["pendente", "aceito", "recusado"]);

export const transportProposals = pgTable("transport_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalNumber: varchar("proposal_number", { length: 20 }),
  originYardId: varchar("origin_yard_id").notNull().references(() => yards.id),
  clientId: varchar("client_id").notNull().references(() => clients.id),
  deliveryLocationId: varchar("delivery_location_id").notNull().references(() => deliveryLocations.id),
  travelRateId: varchar("travel_rate_id").references(() => travelRates.id),
  startDate: timestamp("start_date").notNull(),
  distanceKm: numeric("distance_km"),
  totalSlots: integer("total_slots").notNull().default(1),
  status: proposalStatusEnum("status").default("ativa").notNull(),
  notes: text("notes"),
  isEmergency: text("is_emergency").default("false"),
  estimatedValue: numeric("estimated_value"),
  rateApprovalStatus: text("rate_approval_status"),
  rateApprovalNote: text("rate_approval_note"),
  rateApprovedAt: timestamp("rate_approved_at"),
  rateApprovedBy: text("rate_approved_by"),
  advanceAmount: numeric("advance_amount"),
  advanceMethod: text("advance_method"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transportProposalItems = pgTable("transport_proposal_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull().references(() => transportProposals.id, { onDelete: "cascade" }),
  transportId: varchar("transport_id").notNull().references(() => transports.id, { onDelete: "cascade" }),
});

export const transportProposalDrivers = pgTable("transport_proposal_drivers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull().references(() => transportProposals.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id").notNull().references(() => drivers.id),
  status: proposalDriverStatusEnum("status").default("pendente").notNull(),
  respondedAt: timestamp("responded_at"),
  assignedTransportId: varchar("assigned_transport_id").references(() => transports.id),
  rankJustification: text("rank_justification"),
  caseStatus: varchar("case_status").default("aberto"),
  caseNotes: text("case_notes"),
  caseClosedAt: timestamp("case_closed_at"),
  caseClosedBy: varchar("case_closed_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transportProposalsRelations = relations(transportProposals, ({ one, many }) => ({
  originYard: one(yards, { fields: [transportProposals.originYardId], references: [yards.id] }),
  client: one(clients, { fields: [transportProposals.clientId], references: [clients.id] }),
  deliveryLocation: one(deliveryLocations, { fields: [transportProposals.deliveryLocationId], references: [deliveryLocations.id] }),
  travelRate: one(travelRates, { fields: [transportProposals.travelRateId], references: [travelRates.id] }),
  items: many(transportProposalItems),
  driverResponses: many(transportProposalDrivers),
}));

export const transportProposalItemsRelations = relations(transportProposalItems, ({ one }) => ({
  proposal: one(transportProposals, { fields: [transportProposalItems.proposalId], references: [transportProposals.id] }),
  transport: one(transports, { fields: [transportProposalItems.transportId], references: [transports.id] }),
}));

export const transportProposalDriversRelations = relations(transportProposalDrivers, ({ one }) => ({
  proposal: one(transportProposals, { fields: [transportProposalDrivers.proposalId], references: [transportProposals.id] }),
  driver: one(drivers, { fields: [transportProposalDrivers.driverId], references: [drivers.id] }),
  assignedTransport: one(transports, { fields: [transportProposalDrivers.assignedTransportId], references: [transports.id] }),
}));

export const insertTransportProposalSchema = createInsertSchema(transportProposals).omit({
  id: true,
  proposalNumber: true,
  createdAt: true,
}).extend({
  originYardId: z.string().min(1, "Pátio de saída é obrigatório"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  deliveryLocationId: z.string().min(1, "Local de entrega é obrigatório"),
  startDate: z.string().min(1, "Data de início é obrigatória"),
  totalSlots: z.number().int().optional(),
  distanceKm: z.union([z.string(), z.number()]).optional().nullable(),
  estimatedValue: z.union([z.string(), z.number()]).optional().nullable(),
  notes: z.string().optional().nullable(),
  advanceAmount: z.union([z.string(), z.number()]).optional().nullable(),
  advanceMethod: z.string().optional().nullable(),
  transportIds: z.array(z.string()).optional(),
});

export type InsertTransportProposal = z.infer<typeof insertTransportProposalSchema>;
export type TransportProposal = typeof transportProposals.$inferSelect;
export type TransportProposalItem = typeof transportProposalItems.$inferSelect;
export type TransportProposalDriver = typeof transportProposalDrivers.$inferSelect;

// ============== HISTÓRICO DE PROPOSTAS ==============
export const transportProposalLogs = pgTable("transport_proposal_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  proposalId: varchar("proposal_id").notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  description: text("description").notNull(),
  performedBy: varchar("performed_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type TransportProposalLog = typeof transportProposalLogs.$inferSelect;

// ============== RECUPERAÇÃO DE SENHA ==============
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  code: varchar("code", { length: 6 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: text("used").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============== BROADCAST (Mensagens em Massa) ==============
export const broadcastSeverityEnum = pgEnum("broadcast_severity", ["info", "alerta", "urgente", "critico"]);

export const broadcasts = pgTable("broadcasts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  message: text("message").notNull(),
  severity: broadcastSeverityEnum("severity").default("info").notNull(),
  geoFilter: jsonb("geo_filter"),
  driverFilter: jsonb("driver_filter"),
  totalSent: integer("total_sent").default(0),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const broadcastRecipients = pgTable("broadcast_recipients", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  broadcastId: varchar("broadcast_id").notNull().references(() => broadcasts.id, { onDelete: "cascade" }),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  sentAt: timestamp("sent_at"),
  receivedAt: timestamp("received_at"),
  readAt: timestamp("read_at"),
});

export const broadcastsRelations = relations(broadcasts, ({ many }) => ({
  recipients: many(broadcastRecipients),
}));

export const broadcastRecipientsRelations = relations(broadcastRecipients, ({ one }) => ({
  broadcast: one(broadcasts, { fields: [broadcastRecipients.broadcastId], references: [broadcasts.id] }),
  driver: one(drivers, { fields: [broadcastRecipients.driverId], references: [drivers.id] }),
}));

export const insertBroadcastSchema = createInsertSchema(broadcasts).omit({ id: true, createdAt: true, totalSent: true });
export type InsertBroadcast = z.infer<typeof insertBroadcastSchema>;
export type Broadcast = typeof broadcasts.$inferSelect;
export type BroadcastRecipient = typeof broadcastRecipients.$inferSelect;

// ============== RANKING DE MOTORISTAS — CONFIGURAÇÃO ==============
export const driverRankingWeights = pgTable("driver_ranking_weights", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ratingWeight: integer("rating_weight").notNull().default(5),
  tripsWeight: integer("trips_weight").notNull().default(5),
  responseTimeWeight: integer("response_time_weight").notNull().default(5),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type DriverRankingWeights = typeof driverRankingWeights.$inferSelect;

// ============== HISTÓRICO DE STATUS DO MOTORISTA ==============
export const driverStatusLogs = pgTable("driver_status_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  driverId: varchar("driver_id").notNull().references(() => drivers.id, { onDelete: "cascade" }),
  action: varchar("action", { length: 20 }).notNull(), // "ativado" | "desativado"
  reason: text("reason").notNull(),
  performedByUserId: varchar("performed_by_user_id"),
  performedByName: text("performed_by_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertDriverStatusLogSchema = createInsertSchema(driverStatusLogs).omit({
  id: true,
  createdAt: true,
});

export type InsertDriverStatusLog = z.infer<typeof insertDriverStatusLogSchema>;
export type DriverStatusLog = typeof driverStatusLogs.$inferSelect;

// ============== SOLICITAÇÕES DE CHASSI (PORTAL DO CLIENTE) ==============
export const chassisRequestStatusEnum = pgEnum("chassis_request_status", [
  "pendente",
  "em_analise",
  "aprovado",
  "rejeitado",
]);

export const chassisRequests = pgTable("chassis_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  clientId: varchar("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
  chassi: varchar("chassi", { length: 50 }).notNull(),
  deliveryAddress: text("delivery_address"),
  notes: text("notes"),
  status: chassisRequestStatusEnum("status").notNull().default("pendente"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertChassisRequestSchema = createInsertSchema(chassisRequests).omit({
  id: true,
  status: true,
  adminNotes: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertChassisRequest = z.infer<typeof insertChassisRequestSchema>;
export type ChassisRequest = typeof chassisRequests.$inferSelect;
