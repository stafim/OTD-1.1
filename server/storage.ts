import {
  drivers, type Driver, type InsertDriver,
  driverDeletionRequests, type DriverDeletionRequest, type InsertDriverDeletionRequest,
  manufacturers, type Manufacturer, type InsertManufacturer,
  yards, type Yard, type InsertYard,
  clients, type Client, type InsertClient,
  deliveryLocations, type DeliveryLocation, type InsertDeliveryLocation,
  vehicles, type Vehicle, type InsertVehicle,
  collects, type Collect, type InsertCollect,
  transports, type Transport, type InsertTransport,
  driverNotifications, type DriverNotification, type InsertDriverNotification,
  requestCounter,
  systemUsers, type SystemUser, type InsertSystemUser,
  rolePermissions, type RolePermission, type InsertRolePermission, type FeatureKey,
  userTypes, type UserType, type InsertUserType,
  userTypePermissions, type UserTypePermission,
  expenseSettlements, type ExpenseSettlement, type InsertExpenseSettlement,
  expenseSettlementItems, type ExpenseSettlementItem, type InsertExpenseSettlementItem,
  checkpoints, type Checkpoint, type InsertCheckpoint,
  contracts, type Contract, type InsertContract,
  contractDrivers, type ContractDriver, type InsertContractDriver,
  freightContracts, type FreightContract, type InsertFreightContract,
  deletedTransports, type DeletedTransport,
  transportProposals, type TransportProposal, type InsertTransportProposal,
  transportProposalItems, type TransportProposalItem,
  transportProposalDrivers, type TransportProposalDriver,
  chassisRequests, type ChassisRequest, type InsertChassisRequest,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // Drivers
  getDrivers(): Promise<Driver[]>;
  getDriver(id: string): Promise<Driver | undefined>;
  createDriver(driver: InsertDriver): Promise<Driver>;
  updateDriver(id: string, driver: Partial<InsertDriver>): Promise<Driver | undefined>;
  deleteDriver(id: string): Promise<void>;

  // Driver deletion requests (LGPD)
  getDriverDeletionRequests(): Promise<(DriverDeletionRequest & { driverName: string; driverCpf: string; driverPhone: string })[]>;
  getDriverDeletionRequestsByDriver(driverId: string): Promise<DriverDeletionRequest[]>;
  createDriverDeletionRequest(req: InsertDriverDeletionRequest): Promise<DriverDeletionRequest>;
  updateDriverDeletionRequest(id: string, data: Partial<DriverDeletionRequest>): Promise<DriverDeletionRequest | undefined>;
  deleteDriverDeletionRequest(id: string): Promise<void>;

  // Manufacturers
  getManufacturers(): Promise<Manufacturer[]>;
  getManufacturer(id: string): Promise<Manufacturer | undefined>;
  createManufacturer(manufacturer: InsertManufacturer): Promise<Manufacturer>;
  updateManufacturer(id: string, manufacturer: Partial<InsertManufacturer>): Promise<Manufacturer | undefined>;
  deleteManufacturer(id: string): Promise<void>;

  // Yards
  getYards(): Promise<Yard[]>;
  getYard(id: string): Promise<Yard | undefined>;
  createYard(yard: InsertYard): Promise<Yard>;
  updateYard(id: string, yard: Partial<InsertYard>): Promise<Yard | undefined>;
  deleteYard(id: string): Promise<void>;

  // Clients
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(client: InsertClient): Promise<Client>;
  updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined>;
  deleteClient(id: string): Promise<void>;

  // Delivery Locations
  getAllDeliveryLocations(): Promise<DeliveryLocation[]>;
  getDeliveryLocations(clientId: string): Promise<DeliveryLocation[]>;
  getDeliveryLocation(id: string): Promise<DeliveryLocation | undefined>;
  createDeliveryLocation(location: InsertDeliveryLocation): Promise<DeliveryLocation>;
  updateDeliveryLocation(id: string, location: Partial<InsertDeliveryLocation>): Promise<DeliveryLocation | undefined>;
  deleteDeliveryLocation(id: string): Promise<void>;

  // Vehicles
  getVehicles(): Promise<Vehicle[]>;
  getVehicle(chassi: string): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(chassi: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(chassi: string): Promise<void>;

  // Collects
  getCollects(): Promise<Collect[]>;
  getRecentCollects(limit?: number): Promise<Collect[]>;
  getCollect(id: string): Promise<Collect | undefined>;
  createCollect(collect: InsertCollect): Promise<Collect>;
  updateCollect(id: string, collect: Partial<InsertCollect>): Promise<Collect | undefined>;
  deleteCollect(id: string): Promise<void>;

  // Transports
  getTransports(): Promise<Transport[]>;
  getTransportsByDriver(driverId: string): Promise<Transport[]>;
  getRecentTransports(limit?: number): Promise<Transport[]>;
  getTransport(id: string): Promise<Transport | undefined>;
  createTransport(transport: InsertTransport): Promise<Transport>;
  updateTransport(id: string, transport: Partial<InsertTransport>): Promise<Transport | undefined>;
  clearTransportCheckin(id: string): Promise<Transport | undefined>;
  clearTransportCheckout(id: string): Promise<Transport | undefined>;
  deleteTransport(id: string, reason: string, deletedByUserId?: string, deletedByUsername?: string): Promise<void>;
  getDeletedTransports(): Promise<DeletedTransport[]>;
  getNextRequestNumber(): Promise<string>;

  // Driver Notifications
  getDriverNotifications(yardId: string, deliveryLocationId: string, departureDate: string): Promise<DriverNotification[]>;
  createDriverNotification(notification: InsertDriverNotification): Promise<DriverNotification>;
  updateDriverNotification(id: string, data: Partial<InsertDriverNotification>): Promise<DriverNotification | undefined>;

  // System Users
  getSystemUsers(): Promise<SystemUser[]>;
  getSystemUser(id: string): Promise<SystemUser | undefined>;
  createSystemUser(user: InsertSystemUser): Promise<SystemUser>;
  updateSystemUser(id: string, user: Partial<InsertSystemUser>): Promise<SystemUser | undefined>;
  deleteSystemUser(id: string): Promise<void>;

  // Role Permissions
  getRolePermissions(): Promise<RolePermission[]>;
  getPermissionsByRole(role: string): Promise<RolePermission[]>;
  setRolePermissions(role: string, features: FeatureKey[]): Promise<void>;

  // User Types
  getUserTypes(): Promise<UserType[]>;
  getUserType(id: string): Promise<UserType | undefined>;
  createUserType(data: InsertUserType): Promise<UserType>;
  updateUserType(id: string, data: Partial<InsertUserType>): Promise<UserType | undefined>;
  deleteUserType(id: string): Promise<void>;
  getUserTypePermissions(userTypeId: string): Promise<UserTypePermission[]>;
  setUserTypePermissions(userTypeId: string, permissions: { feature: string; canView: string }[]): Promise<void>;

  // Dashboard
  getDashboardStats(): Promise<{
    totalTransports: number;
    collectsInTransit: number;
    vehiclesInStock: number;
    activeDrivers: number;
  }>;

  // Expense Settlements
  getExpenseSettlements(): Promise<ExpenseSettlement[]>;
  getExpenseSettlement(id: string): Promise<ExpenseSettlement | undefined>;
  getExpenseSettlementByTransport(transportId: string): Promise<ExpenseSettlement | undefined>;
  createExpenseSettlement(settlement: InsertExpenseSettlement): Promise<ExpenseSettlement>;
  updateExpenseSettlement(id: string, settlement: Partial<InsertExpenseSettlement>): Promise<ExpenseSettlement | undefined>;
  deleteExpenseSettlement(id: string): Promise<void>;

  // Expense Settlement Items
  getExpenseSettlementItems(settlementId: string): Promise<ExpenseSettlementItem[]>;
  createExpenseSettlementItem(item: InsertExpenseSettlementItem): Promise<ExpenseSettlementItem>;
  updateExpenseSettlementItem(id: string, item: Partial<InsertExpenseSettlementItem>): Promise<ExpenseSettlementItem | undefined>;
  deleteExpenseSettlementItem(id: string): Promise<void>;

  // Checkpoints
  getCheckpoints(): Promise<Checkpoint[]>;
  getCheckpoint(id: string): Promise<Checkpoint | undefined>;
  createCheckpoint(checkpoint: InsertCheckpoint): Promise<Checkpoint>;
  updateCheckpoint(id: string, checkpoint: Partial<InsertCheckpoint>): Promise<Checkpoint | undefined>;
  deleteCheckpoint(id: string): Promise<void>;

  // Contracts
  getContracts(): Promise<Contract[]>;
  getContract(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  createContractWithDrivers(contract: InsertContract, driverIds: string[]): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  updateContractWithDrivers(
    id: string,
    contractData: Partial<InsertContract>,
    driverIds: string[] | undefined,
  ): Promise<{ contract: Contract | undefined; added: string[]; removed: string[]; previousIds: string[] }>;
  deleteContract(id: string): Promise<void>;

  // Contract ↔ Drivers (N:N)
  getContractDrivers(contractId: string): Promise<ContractDriver[]>;
  getContractDriversForContracts(contractIds: string[]): Promise<ContractDriver[]>;
  setContractDrivers(contractId: string, driverIds: string[]): Promise<{ added: string[]; removed: string[] }>;
  addContractDriver(contractId: string, driverId: string): Promise<ContractDriver>;
  removeContractDriver(contractId: string, driverId: string): Promise<void>;
  getContractsForDriver(driverId: string): Promise<Contract[]>;
  upsertContractDriverAutentique(contractId: string, driverId: string, fields: Partial<InsertContractDriver>): Promise<ContractDriver>;
  getContractDriverByDocId(docId: string): Promise<ContractDriver | undefined>;

  // Freight Contracts
  getFreightContracts(): Promise<FreightContract[]>;
  getFreightContract(id: string): Promise<FreightContract | undefined>;
  createFreightContract(contract: InsertFreightContract): Promise<FreightContract>;
  updateFreightContract(id: string, contract: Partial<InsertFreightContract>): Promise<FreightContract | undefined>;
  deleteFreightContract(id: string): Promise<void>;
  getNextFreightContractNumber(): Promise<string>;


  // Transport Proposals
  getTransportProposals(): Promise<TransportProposal[]>;
  getTransportProposal(id: string): Promise<TransportProposal | undefined>;
  createTransportProposal(proposal: Omit<InsertTransportProposal, 'transportIds'>): Promise<TransportProposal>;
  updateTransportProposal(id: string, data: Partial<InsertTransportProposal>): Promise<TransportProposal | undefined>;
  deleteTransportProposal(id: string): Promise<void>;
  getProposalItems(proposalId: string): Promise<TransportProposalItem[]>;
  addProposalItem(proposalId: string, transportId: string): Promise<TransportProposalItem>;
  removeProposalItem(proposalId: string, transportId: string): Promise<void>;
  getProposalDrivers(proposalId: string): Promise<TransportProposalDriver[]>;
  addProposalDriver(proposalId: string, driverId: string): Promise<TransportProposalDriver>;
  updateProposalDriver(id: string, data: Partial<TransportProposalDriver>): Promise<TransportProposalDriver | undefined>;
  removeProposalDriver(proposalId: string, driverId: string): Promise<void>;

  // Chassis Requests
  getChassisRequests(): Promise<ChassisRequest[]>;
  getChassisRequestsByClient(clientId: string): Promise<ChassisRequest[]>;
  createChassisRequest(data: InsertChassisRequest): Promise<ChassisRequest>;
  updateChassisRequest(id: string, data: Partial<ChassisRequest>): Promise<ChassisRequest | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Drivers
  async getDrivers(): Promise<Driver[]> {
    return db.select().from(drivers).orderBy(desc(drivers.createdAt));
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver;
  }

  async createDriver(driver: InsertDriver): Promise<Driver> {
    const [created] = await db.insert(drivers).values(driver).returning();
    return created;
  }

  async updateDriver(id: string, driver: Partial<InsertDriver>): Promise<Driver | undefined> {
    const [updated] = await db.update(drivers).set(driver).where(eq(drivers.id, id)).returning();
    return updated;
  }

  async deleteDriver(id: string): Promise<void> {
    await db.delete(drivers).where(eq(drivers.id, id));
  }

  // Driver deletion requests (LGPD)
  async getDriverDeletionRequests() {
    const rows = await db
      .select({
        id: driverDeletionRequests.id,
        driverId: driverDeletionRequests.driverId,
        channel: driverDeletionRequests.channel,
        notes: driverDeletionRequests.notes,
        status: driverDeletionRequests.status,
        completionNotes: driverDeletionRequests.completionNotes,
        completedAt: driverDeletionRequests.completedAt,
        completedByUserId: driverDeletionRequests.completedByUserId,
        completedByUserName: driverDeletionRequests.completedByUserName,
        requestedByUserId: driverDeletionRequests.requestedByUserId,
        requestedByUserName: driverDeletionRequests.requestedByUserName,
        createdAt: driverDeletionRequests.createdAt,
        driverName: drivers.name,
        driverCpf: drivers.cpf,
        driverPhone: drivers.phone,
      })
      .from(driverDeletionRequests)
      .leftJoin(drivers, eq(drivers.id, driverDeletionRequests.driverId))
      .orderBy(desc(driverDeletionRequests.createdAt));
    return rows.map((r) => ({
      ...r,
      driverName: r.driverName ?? "",
      driverCpf: r.driverCpf ?? "",
      driverPhone: r.driverPhone ?? "",
    }));
  }

  async updateDriverDeletionRequest(id: string, data: Partial<DriverDeletionRequest>): Promise<DriverDeletionRequest | undefined> {
    const [updated] = await db
      .update(driverDeletionRequests)
      .set(data)
      .where(eq(driverDeletionRequests.id, id))
      .returning();
    return updated;
  }

  async getDriverDeletionRequestsByDriver(driverId: string): Promise<DriverDeletionRequest[]> {
    return db
      .select()
      .from(driverDeletionRequests)
      .where(eq(driverDeletionRequests.driverId, driverId))
      .orderBy(desc(driverDeletionRequests.createdAt));
  }

  async createDriverDeletionRequest(req: InsertDriverDeletionRequest): Promise<DriverDeletionRequest> {
    const [created] = await db.insert(driverDeletionRequests).values(req).returning();
    return created;
  }

  async deleteDriverDeletionRequest(id: string): Promise<void> {
    await db.delete(driverDeletionRequests).where(eq(driverDeletionRequests.id, id));
  }

  // Manufacturers
  async getManufacturers(): Promise<Manufacturer[]> {
    return db.select().from(manufacturers).orderBy(desc(manufacturers.createdAt));
  }

  async getManufacturer(id: string): Promise<Manufacturer | undefined> {
    const [manufacturer] = await db.select().from(manufacturers).where(eq(manufacturers.id, id));
    return manufacturer;
  }

  async createManufacturer(manufacturer: InsertManufacturer): Promise<Manufacturer> {
    const [created] = await db.insert(manufacturers).values(manufacturer).returning();
    return created;
  }

  async updateManufacturer(id: string, manufacturer: Partial<InsertManufacturer>): Promise<Manufacturer | undefined> {
    const [updated] = await db.update(manufacturers).set(manufacturer).where(eq(manufacturers.id, id)).returning();
    return updated;
  }

  async deleteManufacturer(id: string): Promise<void> {
    await db.delete(manufacturers).where(eq(manufacturers.id, id));
  }

  // Yards
  async getYards(): Promise<Yard[]> {
    return db.select().from(yards).orderBy(desc(yards.createdAt));
  }

  async getYard(id: string): Promise<Yard | undefined> {
    const [yard] = await db.select().from(yards).where(eq(yards.id, id));
    return yard;
  }

  async createYard(yard: InsertYard): Promise<Yard> {
    const [created] = await db.insert(yards).values(yard).returning();
    return created;
  }

  async updateYard(id: string, yard: Partial<InsertYard>): Promise<Yard | undefined> {
    const [updated] = await db.update(yards).set(yard).where(eq(yards.id, id)).returning();
    return updated;
  }

  async deleteYard(id: string): Promise<void> {
    await db.delete(yards).where(eq(yards.id, id));
  }

  // Clients
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(desc(clients.createdAt));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [client] = await db.select().from(clients).where(eq(clients.id, id));
    return client;
  }

  async createClient(client: InsertClient): Promise<Client> {
    const [created] = await db.insert(clients).values(client).returning();
    return created;
  }

  async updateClient(id: string, client: Partial<InsertClient>): Promise<Client | undefined> {
    const [updated] = await db.update(clients).set(client).where(eq(clients.id, id)).returning();
    return updated;
  }

  async deleteClient(id: string): Promise<void> {
    await db.delete(clients).where(eq(clients.id, id));
  }

  // Delivery Locations
  async getAllDeliveryLocations(): Promise<DeliveryLocation[]> {
    return db.select().from(deliveryLocations);
  }

  async getDeliveryLocations(clientId: string): Promise<DeliveryLocation[]> {
    return db.select().from(deliveryLocations).where(eq(deliveryLocations.clientId, clientId));
  }

  async getDeliveryLocation(id: string): Promise<DeliveryLocation | undefined> {
    const [location] = await db.select().from(deliveryLocations).where(eq(deliveryLocations.id, id));
    return location;
  }

  async createDeliveryLocation(location: InsertDeliveryLocation): Promise<DeliveryLocation> {
    const [created] = await db.insert(deliveryLocations).values(location).returning();
    return created;
  }

  async updateDeliveryLocation(id: string, location: Partial<InsertDeliveryLocation>): Promise<DeliveryLocation | undefined> {
    const [updated] = await db.update(deliveryLocations).set(location).where(eq(deliveryLocations.id, id)).returning();
    return updated;
  }

  async deleteDeliveryLocation(id: string): Promise<void> {
    await db.delete(deliveryLocations).where(eq(deliveryLocations.id, id));
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return db.select().from(vehicles).orderBy(desc(vehicles.createdAt));
  }

  async getVehicle(chassi: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.chassi, chassi));
    return vehicle;
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [created] = await db.insert(vehicles).values(vehicle).returning();
    return created;
  }

  async updateVehicle(chassi: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [updated] = await db.update(vehicles).set(vehicle).where(eq(vehicles.chassi, chassi)).returning();
    return updated;
  }

  async deleteVehicle(chassi: string): Promise<void> {
    await db.delete(vehicles).where(eq(vehicles.chassi, chassi));
  }

  // Collects
  async getCollects(): Promise<Collect[]> {
    return db.select().from(collects).orderBy(desc(collects.createdAt));
  }

  async getRecentCollects(limit = 5): Promise<Collect[]> {
    return db.select().from(collects).orderBy(desc(collects.createdAt)).limit(limit);
  }

  async getCollect(id: string): Promise<Collect | undefined> {
    const [collect] = await db.select().from(collects).where(eq(collects.id, id));
    return collect;
  }

  async createCollect(collect: InsertCollect): Promise<Collect> {
    const [created] = await db.insert(collects).values(collect).returning();
    return created;
  }

  async updateCollect(id: string, collect: Partial<InsertCollect>): Promise<Collect | undefined> {
    const [updated] = await db.update(collects).set(collect).where(eq(collects.id, id)).returning();
    return updated;
  }

  async deleteCollect(id: string): Promise<void> {
    await db.delete(collects).where(eq(collects.id, id));
  }

  // Transports
  async getTransports(): Promise<Transport[]> {
    return db.select().from(transports).orderBy(desc(transports.createdAt));
  }

  async getTransportsByDriver(driverId: string): Promise<Transport[]> {
    return db.select().from(transports)
      .where(eq(transports.driverId, driverId))
      .orderBy(desc(transports.createdAt));
  }

  async getRecentTransports(limit = 5): Promise<Transport[]> {
    return db.select().from(transports).orderBy(desc(transports.createdAt)).limit(limit);
  }

  async getTransport(id: string): Promise<Transport | undefined> {
    const [transport] = await db.select().from(transports).where(eq(transports.id, id));
    return transport;
  }

  async createTransport(transport: InsertTransport): Promise<Transport> {
    const requestNumber = await this.getNextRequestNumber();
    const [created] = await db.insert(transports).values({ ...transport, requestNumber }).returning();
    return created;
  }

  async updateTransport(id: string, transport: Partial<InsertTransport>): Promise<Transport | undefined> {
    const [updated] = await db.update(transports).set(transport).where(eq(transports.id, id)).returning();
    return updated;
  }

  async clearTransportCheckin(id: string): Promise<Transport | undefined> {
    const [updated] = await db.update(transports).set({
      checkinDateTime: sql`NULL`,
      checkinLocation: sql`NULL`,
      checkinFrontalPhoto: "",
      checkinLateral1Photo: "",
      checkinLateral2Photo: "",
      checkinTraseiraPhoto: "",
      checkinOdometerPhoto: "",
      checkinFuelLevelPhoto: "",
      checkinDamagePhotos: [],
      checkinSelfiePhoto: "",
      checkinNotes: "",
      status: "pendente",
    } as any).where(eq(transports.id, id)).returning();
    return updated;
  }

  async clearTransportCheckout(id: string): Promise<Transport | undefined> {
    const [updated] = await db.update(transports).set({
      checkoutDateTime: sql`NULL`,
      checkoutLocation: sql`NULL`,
      checkoutFrontalPhoto: "",
      checkoutLateral1Photo: "",
      checkoutLateral2Photo: "",
      checkoutTraseiraPhoto: "",
      checkoutOdometerPhoto: "",
      checkoutFuelLevelPhoto: "",
      checkoutDamagePhotos: [],
      checkoutSelfiePhoto: "",
      checkoutNotes: "",
      status: "em_transito",
    } as any).where(eq(transports.id, id)).returning();
    return updated;
  }

  async deleteTransport(id: string, reason: string, deletedByUserId?: string, deletedByUsername?: string): Promise<void> {
    const [transport] = await db.select().from(transports).where(eq(transports.id, id));
    if (!transport) throw new Error("Transport not found");

    // Fetch related names for history record
    let clientName: string | undefined;
    let originYardName: string | undefined;
    let deliveryLocationName: string | undefined;
    let driverName: string | undefined;

    if (transport.clientId) {
      const [c] = await db.select({ name: clients.name }).from(clients).where(eq(clients.id, transport.clientId));
      clientName = c?.name;
    }
    if (transport.originYardId) {
      const [y] = await db.select({ name: yards.name }).from(yards).where(eq(yards.id, transport.originYardId));
      originYardName = y?.name;
    }
    if (transport.deliveryLocationId) {
      const [d] = await db.select({ name: deliveryLocations.name }).from(deliveryLocations).where(eq(deliveryLocations.id, transport.deliveryLocationId));
      deliveryLocationName = d?.name;
    }
    if (transport.driverId) {
      const [dr] = await db.select({ name: drivers.name }).from(drivers).where(eq(drivers.id, transport.driverId));
      driverName = dr?.name;
    }

    // Save to deleted transports history. Legacy table has integer id/original_id/deleted_by columns,
    // but our entities use UUID — keep UUIDs inside the JSON `data` payload and let the
    // serial sequence assign the integer id; pass NULLs to the integer FK columns.
    await db.execute(sql`
      INSERT INTO deleted_transports (data, deleted_at)
      VALUES (
        ${JSON.stringify({
          originalId: transport.id,
          requestNumber: transport.requestNumber,
          vehicleChassi: transport.vehicleChassi,
          clientId: transport.clientId,
          clientName: clientName || null,
          originYardId: transport.originYardId,
          originYardName: originYardName || null,
          deliveryLocationId: transport.deliveryLocationId,
          deliveryLocationName: deliveryLocationName || null,
          driverId: transport.driverId || null,
          driverName: driverName || null,
          status: transport.status,
          deletionReason: reason,
          deletedByUserId: deletedByUserId || null,
          deletedByUsername: deletedByUsername || null,
          transportCreatedAt: transport.createdAt,
          deliveryDate: transport.deliveryDate,
          notes: transport.notes,
        })}::jsonb,
        NOW()
      )
    `);

    // Restore vehicle to em_estoque
    await db.update(vehicles)
      .set({ status: "em_estoque" } as any)
      .where(eq(vehicles.chassi, transport.vehicleChassi));

    // Delete the transport
    await db.delete(transports).where(eq(transports.id, id));
  }

  async getDeletedTransports(): Promise<DeletedTransport[]> {
    return db.select().from(deletedTransports).orderBy(desc(deletedTransports.deletedAt));
  }

  async getNextRequestNumber(): Promise<string> {
    // Find the max number already used in existing transports
    const maxResult = await db
      .select({ maxNum: sql<string>`MAX(CAST(SUBSTRING(request_number FROM 4) AS INTEGER))` })
      .from(transports)
      .where(sql`request_number ~ '^OTD[0-9]+$'`);
    const maxExisting = parseInt(maxResult[0]?.maxNum ?? "0") || 0;

    const result = await db
      .insert(requestCounter)
      .values({ id: "transport_counter", lastNumber: maxExisting + 1 })
      .onConflictDoUpdate({
        target: requestCounter.id,
        set: {
          lastNumber: sql`GREATEST(${requestCounter.lastNumber} + 1, ${maxExisting + 1})`,
        },
      })
      .returning();

    const num = result[0]?.lastNumber || maxExisting + 1;
    return `OTD${String(num).padStart(5, "0")}`;
  }

  // Driver Notifications
  async getDriverNotifications(yardId: string, deliveryLocationId: string, departureDate: string): Promise<DriverNotification[]> {
    return db
      .select()
      .from(driverNotifications)
      .where(
        and(
          eq(driverNotifications.yardId, yardId),
          eq(driverNotifications.deliveryLocationId, deliveryLocationId),
          eq(driverNotifications.departureDate, departureDate)
        )
      )
      .orderBy(desc(driverNotifications.createdAt));
  }

  async createDriverNotification(notification: InsertDriverNotification): Promise<DriverNotification> {
    const [created] = await db.insert(driverNotifications).values(notification).returning();
    return created;
  }

  async updateDriverNotification(id: string, data: Partial<InsertDriverNotification>): Promise<DriverNotification | undefined> {
    const [updated] = await db
      .update(driverNotifications)
      .set({ ...data, respondedAt: new Date() })
      .where(eq(driverNotifications.id, id))
      .returning();
    return updated;
  }

  // System Users
  async getSystemUsers(): Promise<SystemUser[]> {
    return db.select().from(systemUsers).orderBy(desc(systemUsers.createdAt));
  }

  async getSystemUser(id: string): Promise<SystemUser | undefined> {
    const [user] = await db.select().from(systemUsers).where(eq(systemUsers.id, id));
    return user;
  }

  async createSystemUser(user: InsertSystemUser): Promise<SystemUser> {
    const [created] = await db.insert(systemUsers).values(user).returning();
    return created;
  }

  async updateSystemUser(id: string, user: Partial<InsertSystemUser>): Promise<SystemUser | undefined> {
    const [updated] = await db.update(systemUsers).set(user).where(eq(systemUsers.id, id)).returning();
    return updated;
  }

  async deleteSystemUser(id: string): Promise<void> {
    await db.delete(systemUsers).where(eq(systemUsers.id, id));
  }

  // Role Permissions
  async getRolePermissions(): Promise<RolePermission[]> {
    return db.select().from(rolePermissions);
  }

  async getPermissionsByRole(role: string): Promise<RolePermission[]> {
    return db.select().from(rolePermissions).where(eq(rolePermissions.role, role as any));
  }

  async setRolePermissions(role: string, features: FeatureKey[]): Promise<void> {
    await db.delete(rolePermissions).where(eq(rolePermissions.role, role as any));
    if (features.length > 0) {
      await db.insert(rolePermissions).values(
        features.map((feature) => ({ role: role as any, feature }))
      );
    }
  }

  // User Types
  async getUserTypes(): Promise<UserType[]> {
    return db.select().from(userTypes).orderBy(userTypes.name);
  }

  async getUserType(id: string): Promise<UserType | undefined> {
    const [row] = await db.select().from(userTypes).where(eq(userTypes.id, id));
    return row;
  }

  async createUserType(data: InsertUserType): Promise<UserType> {
    const [row] = await db.insert(userTypes).values(data).returning();
    return row;
  }

  async updateUserType(id: string, data: Partial<InsertUserType>): Promise<UserType | undefined> {
    const [row] = await db.update(userTypes).set(data).where(eq(userTypes.id, id)).returning();
    return row;
  }

  async deleteUserType(id: string): Promise<void> {
    await db.delete(userTypes).where(eq(userTypes.id, id));
  }

  async getUserTypePermissions(userTypeId: string): Promise<UserTypePermission[]> {
    return db.select().from(userTypePermissions).where(eq(userTypePermissions.userTypeId, userTypeId));
  }

  async setUserTypePermissions(userTypeId: string, permissions: { feature: string; canView: string }[]): Promise<void> {
    await db.delete(userTypePermissions).where(eq(userTypePermissions.userTypeId, userTypeId));
    if (permissions.length > 0) {
      await db.insert(userTypePermissions).values(
        permissions.map(p => ({ userTypeId, feature: p.feature, canView: p.canView }))
      );
    }
  }

  // Dashboard
  async getDashboardStats(): Promise<{
    totalTransports: number;
    collectsInTransit: number;
    vehiclesInStock: number;
    activeDrivers: number;
  }> {
    const [transportCount] = await db.select({ count: sql<number>`count(*)` }).from(transports);
    const [collectCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(collects)
      .where(eq(collects.status, "em_transito"));
    const [vehicleCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(vehicles)
      .where(eq(vehicles.status, "em_estoque"));
    const [driverCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(drivers)
      .where(eq(drivers.isActive, "true"));

    return {
      totalTransports: Number(transportCount?.count || 0),
      collectsInTransit: Number(collectCount?.count || 0),
      vehiclesInStock: Number(vehicleCount?.count || 0),
      activeDrivers: Number(driverCount?.count || 0),
    };
  }

  // Expense Settlements
  async getExpenseSettlements(): Promise<ExpenseSettlement[]> {
    return db.select().from(expenseSettlements).orderBy(desc(expenseSettlements.createdAt));
  }

  async getExpenseSettlement(id: string): Promise<ExpenseSettlement | undefined> {
    const [settlement] = await db.select().from(expenseSettlements).where(eq(expenseSettlements.id, id));
    return settlement;
  }

  async getExpenseSettlementByTransport(transportId: string): Promise<ExpenseSettlement | undefined> {
    const [settlement] = await db.select().from(expenseSettlements).where(eq(expenseSettlements.transportId, transportId));
    return settlement;
  }

  async createExpenseSettlement(settlement: InsertExpenseSettlement): Promise<ExpenseSettlement> {
    const [created] = await db.insert(expenseSettlements).values(settlement).returning();
    return created;
  }

  async updateExpenseSettlement(id: string, settlement: Partial<InsertExpenseSettlement>): Promise<ExpenseSettlement | undefined> {
    const [updated] = await db.update(expenseSettlements).set(settlement).where(eq(expenseSettlements.id, id)).returning();
    return updated;
  }

  async deleteExpenseSettlement(id: string): Promise<void> {
    // First delete items
    await db.delete(expenseSettlementItems).where(eq(expenseSettlementItems.settlementId, id));
    // Then delete settlement
    await db.delete(expenseSettlements).where(eq(expenseSettlements.id, id));
  }

  // Expense Settlement Items
  async getExpenseSettlementItems(settlementId: string): Promise<ExpenseSettlementItem[]> {
    return db.select().from(expenseSettlementItems).where(eq(expenseSettlementItems.settlementId, settlementId)).orderBy(desc(expenseSettlementItems.createdAt));
  }

  async createExpenseSettlementItem(item: InsertExpenseSettlementItem): Promise<ExpenseSettlementItem> {
    const [created] = await db.insert(expenseSettlementItems).values(item).returning();
    return created;
  }

  async updateExpenseSettlementItem(id: string, item: Partial<InsertExpenseSettlementItem>): Promise<ExpenseSettlementItem | undefined> {
    const [updated] = await db.update(expenseSettlementItems).set(item).where(eq(expenseSettlementItems.id, id)).returning();
    return updated;
  }

  async deleteExpenseSettlementItem(id: string): Promise<void> {
    await db.delete(expenseSettlementItems).where(eq(expenseSettlementItems.id, id));
  }

  // Checkpoints
  async getCheckpoints(): Promise<Checkpoint[]> {
    return db.select().from(checkpoints).orderBy(desc(checkpoints.createdAt));
  }

  async getCheckpoint(id: string): Promise<Checkpoint | undefined> {
    const [checkpoint] = await db.select().from(checkpoints).where(eq(checkpoints.id, id));
    return checkpoint;
  }

  async createCheckpoint(checkpoint: InsertCheckpoint): Promise<Checkpoint> {
    const [created] = await db.insert(checkpoints).values(checkpoint).returning();
    return created;
  }

  async updateCheckpoint(id: string, checkpoint: Partial<InsertCheckpoint>): Promise<Checkpoint | undefined> {
    const [updated] = await db.update(checkpoints).set(checkpoint).where(eq(checkpoints.id, id)).returning();
    return updated;
  }

  async deleteCheckpoint(id: string): Promise<void> {
    await db.delete(checkpoints).where(eq(checkpoints.id, id));
  }

  // Contracts
  async getContracts(): Promise<Contract[]> {
    return db.select().from(contracts).orderBy(desc(contracts.createdAt));
  }

  async getContract(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(contracts).where(eq(contracts.id, id));
    return contract;
  }

  async createContract(contract: InsertContract): Promise<Contract> {
    const [created] = await db.insert(contracts).values(contract).returning();
    return created;
  }

  // Atomic: insert contract row + initial N:N driver links in a single transaction.
  async createContractWithDrivers(
    contract: InsertContract,
    driverIds: string[],
  ): Promise<Contract> {
    return db.transaction(async (tx) => {
      const [created] = await tx.insert(contracts).values(contract).returning();
      if (driverIds.length > 0) {
        await tx.insert(contractDrivers)
          .values(driverIds.map((driverId) => ({ contractId: created.id, driverId })))
          .onConflictDoNothing();
      }
      return created;
    });
  }

  async updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined> {
    const [updated] = await db.update(contracts).set({ ...contract, updatedAt: new Date() }).where(eq(contracts.id, id)).returning();
    return updated;
  }

  // Atomic update: contract row + N:N driver links in a single transaction.
  // If `driverIds` is undefined, only the contract row is updated.
  async updateContractWithDrivers(
    id: string,
    contractData: Partial<InsertContract>,
    driverIds: string[] | undefined,
  ): Promise<{ contract: Contract | undefined; added: string[]; removed: string[]; previousIds: string[] }> {
    return db.transaction(async (tx) => {
      // Lock contract row first to serialize concurrent PATCHes for the same contract.
      await tx.execute(sql`SELECT id FROM contracts WHERE id = ${id} FOR UPDATE`);
      const [updated] = await tx
        .update(contracts)
        .set({ ...contractData, updatedAt: new Date() })
        .where(eq(contracts.id, id))
        .returning();
      if (!updated) {
        return { contract: undefined, added: [], removed: [], previousIds: [] };
      }
      const previous = await tx.select().from(contractDrivers).where(eq(contractDrivers.contractId, id));
      const previousIds = previous.map((p) => p.driverId);
      let added: string[] = [];
      let removed: string[] = [];
      if (driverIds !== undefined) {
        const existingIds = new Set(previousIds);
        const targetIds = new Set(driverIds);
        added = driverIds.filter((d) => !existingIds.has(d));
        removed = previousIds.filter((d) => !targetIds.has(d));
        if (added.length > 0) {
          await tx.insert(contractDrivers)
            .values(added.map((driverId) => ({ contractId: id, driverId })))
            .onConflictDoNothing();
        }
        if (removed.length > 0) {
          await tx.delete(contractDrivers).where(
            and(eq(contractDrivers.contractId, id), inArray(contractDrivers.driverId, removed))
          );
        }
      }
      return { contract: updated, added, removed, previousIds };
    });
  }

  async deleteContract(id: string): Promise<void> {
    await db.delete(contracts).where(eq(contracts.id, id));
  }

  // Contract ↔ Drivers (N:N)
  async getContractDrivers(contractId: string): Promise<ContractDriver[]> {
    return db.select().from(contractDrivers)
      .where(eq(contractDrivers.contractId, contractId))
      .orderBy(contractDrivers.createdAt, contractDrivers.id);
  }

  async getContractDriversForContracts(contractIds: string[]): Promise<ContractDriver[]> {
    if (contractIds.length === 0) return [];
    return db.select().from(contractDrivers)
      .where(inArray(contractDrivers.contractId, contractIds))
      .orderBy(contractDrivers.createdAt, contractDrivers.id);
  }

  async setContractDrivers(contractId: string, driverIds: string[]): Promise<{ added: string[]; removed: string[] }> {
    // Atomic: read-diff-write inside a single transaction with row lock to avoid
    // lost-update race conditions across concurrent PATCHes on the same contract.
    return db.transaction(async (tx) => {
      // Lock the parent contract row to serialize concurrent driver-link mutations.
      await tx.execute(sql`SELECT id FROM contracts WHERE id = ${contractId} FOR UPDATE`);
      const existing = await tx.select().from(contractDrivers)
        .where(eq(contractDrivers.contractId, contractId));
      const existingIds = new Set(existing.map((cd) => cd.driverId));
      const targetIds = new Set(driverIds);
      const toAdd = driverIds.filter((id) => !existingIds.has(id));
      const toRemove = [...existingIds].filter((id) => !targetIds.has(id));
      if (toAdd.length > 0) {
        await tx.insert(contractDrivers).values(
          toAdd.map((driverId) => ({ contractId, driverId }))
        ).onConflictDoNothing();
      }
      if (toRemove.length > 0) {
        await tx.delete(contractDrivers).where(
          and(eq(contractDrivers.contractId, contractId), inArray(contractDrivers.driverId, toRemove))
        );
      }
      return { added: toAdd, removed: toRemove };
    });
  }

  async addContractDriver(contractId: string, driverId: string): Promise<ContractDriver> {
    const [created] = await db.insert(contractDrivers)
      .values({ contractId, driverId })
      .onConflictDoNothing()
      .returning();
    if (created) return created;
    const [existing] = await db.select().from(contractDrivers)
      .where(and(eq(contractDrivers.contractId, contractId), eq(contractDrivers.driverId, driverId)));
    return existing;
  }

  async removeContractDriver(contractId: string, driverId: string): Promise<void> {
    await db.delete(contractDrivers).where(
      and(eq(contractDrivers.contractId, contractId), eq(contractDrivers.driverId, driverId))
    );
  }

  async getContractsForDriver(driverId: string): Promise<Contract[]> {
    const links = await db.select().from(contractDrivers).where(eq(contractDrivers.driverId, driverId));
    if (links.length === 0) return [];
    const ids = links.map((l) => l.contractId);
    return db.select().from(contracts).where(inArray(contracts.id, ids)).orderBy(desc(contracts.createdAt));
  }

  async upsertContractDriverAutentique(
    contractId: string,
    driverId: string,
    fields: Partial<InsertContractDriver>,
  ): Promise<ContractDriver> {
    const [existing] = await db.select().from(contractDrivers)
      .where(and(eq(contractDrivers.contractId, contractId), eq(contractDrivers.driverId, driverId)));
    if (existing) {
      const [updated] = await db.update(contractDrivers)
        .set(fields)
        .where(eq(contractDrivers.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(contractDrivers)
      .values({ contractId, driverId, ...fields })
      .returning();
    return created;
  }

  async getContractDriverByDocId(docId: string): Promise<ContractDriver | undefined> {
    const [row] = await db.select().from(contractDrivers).where(eq(contractDrivers.autentiqueDocId, docId));
    return row;
  }

  // Freight Contracts
  async getFreightContracts(): Promise<FreightContract[]> {
    return db.select().from(freightContracts).orderBy(desc(freightContracts.createdAt));
  }

  async getFreightContract(id: string): Promise<FreightContract | undefined> {
    const [contract] = await db.select().from(freightContracts).where(eq(freightContracts.id, id));
    return contract;
  }

  async createFreightContract(contract: InsertFreightContract): Promise<FreightContract> {
    const [created] = await db.insert(freightContracts).values(contract).returning();
    return created;
  }

  async updateFreightContract(id: string, contract: Partial<InsertFreightContract>): Promise<FreightContract | undefined> {
    const [updated] = await db.update(freightContracts).set({ ...contract, updatedAt: new Date() }).where(eq(freightContracts.id, id)).returning();
    return updated;
  }

  async deleteFreightContract(id: string): Promise<void> {
    await db.delete(freightContracts).where(eq(freightContracts.id, id));
  }

  async getNextFreightContractNumber(): Promise<string> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(freightContracts);
    const next = (Number(result?.count ?? 0) + 1).toString().padStart(4, "0");
    return `CTF-${next}`;
  }


  // Transport Proposals
  async getTransportProposals(): Promise<TransportProposal[]> {
    return db.select().from(transportProposals).orderBy(desc(transportProposals.createdAt));
  }

  async getTransportProposal(id: string): Promise<TransportProposal | undefined> {
    const [proposal] = await db.select().from(transportProposals).where(eq(transportProposals.id, id));
    return proposal;
  }

  async getNextProposalNumber(): Promise<string> {
    const result = await db
      .insert(requestCounter)
      .values({ id: "proposal_counter", lastNumber: 1 })
      .onConflictDoUpdate({
        target: requestCounter.id,
        set: { lastNumber: sql`${requestCounter.lastNumber} + 1` },
      })
      .returning();
    const num = result[0]?.lastNumber || 1;
    return `PRP${String(num).padStart(5, "0")}`;
  }

  async createTransportProposal(proposal: Omit<InsertTransportProposal, 'transportIds'>): Promise<TransportProposal> {
    const proposalNumber = await this.getNextProposalNumber();
    const values = { ...proposal, proposalNumber } as any;
    if (values.startDate !== undefined && values.startDate !== null) {
      const d = values.startDate instanceof Date ? values.startDate : new Date(String(values.startDate));
      if (isNaN(d.getTime())) throw new Error(`Data de início inválida: "${values.startDate}"`);
      values.startDate = d;
    }
    const [created] = await db.insert(transportProposals).values(values).returning();
    return created;
  }

  async updateTransportProposal(id: string, data: Partial<InsertTransportProposal>): Promise<TransportProposal | undefined> {
    const { transportIds, ...rest } = data as any;
    if (rest.startDate && typeof rest.startDate === "string") {
      rest.startDate = new Date(rest.startDate);
    }
    const [updated] = await db.update(transportProposals).set(rest).where(eq(transportProposals.id, id)).returning();
    return updated;
  }

  async deleteTransportProposal(id: string): Promise<void> {
    await db.delete(transportProposals).where(eq(transportProposals.id, id));
  }

  async getProposalItems(proposalId: string): Promise<TransportProposalItem[]> {
    return db.select().from(transportProposalItems).where(eq(transportProposalItems.proposalId, proposalId));
  }

  async addProposalItem(proposalId: string, transportId: string): Promise<TransportProposalItem> {
    const [item] = await db.insert(transportProposalItems).values({ proposalId, transportId }).returning();
    return item;
  }

  async removeProposalItem(proposalId: string, transportId: string): Promise<void> {
    await db.delete(transportProposalItems).where(
      and(eq(transportProposalItems.proposalId, proposalId), eq(transportProposalItems.transportId, transportId))
    );
  }

  async getProposalDrivers(proposalId: string): Promise<TransportProposalDriver[]> {
    return db.select().from(transportProposalDrivers)
      .where(eq(transportProposalDrivers.proposalId, proposalId))
      .orderBy(desc(transportProposalDrivers.createdAt));
  }

  async addProposalDriver(proposalId: string, driverId: string): Promise<TransportProposalDriver> {
    const [driver] = await db.insert(transportProposalDrivers).values({ proposalId, driverId }).returning();
    return driver;
  }

  async updateProposalDriver(id: string, data: Partial<TransportProposalDriver>): Promise<TransportProposalDriver | undefined> {
    const [updated] = await db.update(transportProposalDrivers).set(data).where(eq(transportProposalDrivers.id, id)).returning();
    return updated;
  }

  async removeProposalDriver(proposalId: string, driverId: string): Promise<void> {
    await db.delete(transportProposalDrivers).where(
      and(eq(transportProposalDrivers.proposalId, proposalId), eq(transportProposalDrivers.driverId, driverId))
    );
  }

  // Chassis Requests
  async getChassisRequests(): Promise<ChassisRequest[]> {
    return db.select().from(chassisRequests).orderBy(desc(chassisRequests.createdAt));
  }

  async getChassisRequestsByClient(clientId: string): Promise<ChassisRequest[]> {
    return db.select().from(chassisRequests)
      .where(eq(chassisRequests.clientId, clientId))
      .orderBy(desc(chassisRequests.createdAt));
  }

  async createChassisRequest(data: InsertChassisRequest): Promise<ChassisRequest> {
    const [req] = await db.insert(chassisRequests).values(data).returning();
    return req;
  }

  async updateChassisRequest(id: string, data: Partial<ChassisRequest>): Promise<ChassisRequest | undefined> {
    const [updated] = await db.update(chassisRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(chassisRequests.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
