CREATE TABLE "line_stations" (
	"line_id" varchar(16) NOT NULL,
	"station_id" varchar(16) NOT NULL,
	"order" integer NOT NULL,
	CONSTRAINT "line_stations_line_id_station_id_pk" PRIMARY KEY("line_id","station_id")
);
--> statement-breakpoint
CREATE TABLE "lines" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" varchar(32) NOT NULL,
	"is_circular" boolean DEFAULT false NOT NULL,
	"color" varchar(7) DEFAULT '#000000' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"report_id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "reports_report_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"station_id" varchar(16) NOT NULL,
	"line_id" varchar(16),
	"direction_id" varchar(16),
	"timestamp" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"source" varchar(16) NOT NULL,
	"client_hash" varchar(32),
	"trust" double precision
);
--> statement-breakpoint
CREATE TABLE "segments" (
	"id" bigint PRIMARY KEY NOT NULL,
	"line_id" varchar(16) NOT NULL,
	"from_station_id" varchar(16) NOT NULL,
	"to_station_id" varchar(16) NOT NULL,
	"position" integer NOT NULL,
	"color" varchar(7) NOT NULL,
	"coordinates" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stations" (
	"id" varchar(16) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eav_station_boards" (
	"station_id" varchar(16) NOT NULL,
	"cod_loc" text NOT NULL,
	"touchpoint" text NOT NULL,
	CONSTRAINT "eav_station_boards_station_id_cod_loc_pk" PRIMARY KEY("station_id","cod_loc")
);
--> statement-breakpoint
CREATE TABLE "timetable_departures" (
	"station_id" varchar(16) NOT NULL,
	"trip_id" text NOT NULL,
	"departure_secs" integer NOT NULL,
	CONSTRAINT "timetable_departures_station_id_trip_id_pk" PRIMARY KEY("station_id","trip_id")
);
--> statement-breakpoint
CREATE TABLE "timetable_service_dates" (
	"service_id" text NOT NULL,
	"date" integer NOT NULL,
	CONSTRAINT "timetable_service_dates_service_id_date_pk" PRIMARY KEY("service_id","date")
);
--> statement-breakpoint
CREATE TABLE "timetable_trips" (
	"trip_id" text PRIMARY KEY NOT NULL,
	"line_id" varchar(16) NOT NULL,
	"service_id" text NOT NULL,
	"headsign" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "line_stations" ADD CONSTRAINT "line_stations_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "line_stations" ADD CONSTRAINT "line_stations_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_station_id_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_direction_id_stations_id_fk" FOREIGN KEY ("direction_id") REFERENCES "public"."stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_line_id_lines_id_fk" FOREIGN KEY ("line_id") REFERENCES "public"."lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_from_station_id_stations_id_fk" FOREIGN KEY ("from_station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "segments" ADD CONSTRAINT "segments_to_station_id_stations_id_fk" FOREIGN KEY ("to_station_id") REFERENCES "public"."stations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reports_station_ts_idx" ON "reports" USING btree ("station_id","timestamp");--> statement-breakpoint
CREATE INDEX "reports_ts_idx" ON "reports" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "reports_line_ts_idx" ON "reports" USING btree ("line_id","timestamp");--> statement-breakpoint
CREATE INDEX "reports_client_ts_idx" ON "reports" USING btree ("client_hash","timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "segments_line_from_to_idx" ON "segments" USING btree ("line_id","from_station_id","to_station_id");--> statement-breakpoint
CREATE INDEX "timetable_departures_station_time_idx" ON "timetable_departures" USING btree ("station_id","departure_secs");--> statement-breakpoint
CREATE INDEX "timetable_service_dates_date_idx" ON "timetable_service_dates" USING btree ("date");