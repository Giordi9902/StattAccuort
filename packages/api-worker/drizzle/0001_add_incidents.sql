CREATE TABLE "incidents" (
	"incident_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "incidents_incident_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" varchar(16) NOT NULL,
	"station_id" varchar(16),
	"line_id" varchar(16),
	"delay_minutes" smallint,
	"timestamp" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"source" varchar(16) NOT NULL,
	"client_hash" varchar(32),
	CONSTRAINT "incidents_has_place" CHECK ("incidents"."station_id" is not null or "incidents"."line_id" is not null)
);
--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incidents_ts_idx" ON "incidents" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "incidents_client_kind_ts_idx" ON "incidents" USING btree ("client_hash","kind","timestamp");