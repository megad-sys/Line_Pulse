import { NextResponse, type NextRequest } from "next/server";
import Papa from "papaparse";
import { createServiceClient } from "@/lib/supabase/server";

const REQUIRED_COLS = ["work_order_id", "part_id", "station_name", "scan_type", "scanned_at"];
const VALID_SCAN_TYPES = new Set(["entry", "exit", "defect"]);

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file     = formData.get("file") as File | null;
  const shift_id  = formData.get("shift_id") as string | null;
  const tenant_id = formData.get("tenant_id") as string | null;

  if (!file || !shift_id || !tenant_id) {
    return NextResponse.json(
      { error: "file, shift_id, and tenant_id are required" },
      { status: 400 }
    );
  }

  const text = await file.text();

  const { data: rows, errors: parseErrors } = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseErrors.length) {
    return NextResponse.json(
      { error: "CSV parse error", details: parseErrors.map((e) => e.message) },
      { status: 400 }
    );
  }

  const validRows: object[] = [];
  const errorMessages: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const lineNum = i + 2; // 1-indexed + header row

    // Check required columns
    const missing = REQUIRED_COLS.filter((col) => !row[col]?.trim());
    if (missing.length) {
      errorMessages.push(`Row ${lineNum}: missing ${missing.join(", ")}`);
      continue;
    }

    // Validate scan_type
    if (!VALID_SCAN_TYPES.has(row.scan_type)) {
      errorMessages.push(`Row ${lineNum}: invalid scan_type "${row.scan_type}" (must be entry, exit, or defect)`);
      continue;
    }

    // Validate scanned_at
    const ts = new Date(row.scanned_at);
    if (isNaN(ts.getTime())) {
      errorMessages.push(`Row ${lineNum}: invalid scanned_at "${row.scanned_at}"`);
      continue;
    }

    validRows.push({
      tenant_id,
      shift_id,
      work_order_id: row.work_order_id || null,
      part_id:       row.part_id       || null,
      station_name:  row.station_name,
      scan_type:     row.scan_type,
      scanned_at:    ts.toISOString(),
      operator_id:   row.operator_id   || null,
      source:        "csv_import",
    });
  }

  if (validRows.length === 0) {
    return NextResponse.json({
      inserted: 0,
      skipped: rows.length,
      errors: errorMessages,
    });
  }

  const db = createServiceClient();
  const CHUNK = 500;
  let inserted = 0;

  for (let i = 0; i < validRows.length; i += CHUNK) {
    const { error } = await db.from("scan_events").insert(validRows.slice(i, i + CHUNK));
    if (error) {
      return NextResponse.json(
        { error: "Database insert failed", details: error.message },
        { status: 500 }
      );
    }
    inserted += Math.min(CHUNK, validRows.length - i);
  }

  return NextResponse.json({
    inserted,
    skipped: rows.length - validRows.length,
    errors: errorMessages,
  });
}
