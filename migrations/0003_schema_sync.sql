CREATE UNIQUE INDEX IF NOT EXISTS "uniq_active_transport_per_chassi" ON "transports" USING btree ("vehicle_chassi") WHERE "transports"."status" NOT IN ('entregue', 'cancelado');
