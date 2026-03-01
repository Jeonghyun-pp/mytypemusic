import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = path.resolve(process.cwd(), "../../outputs/reels/uploads");

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("video") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No video file" }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const ext = path.extname(file.name) || ".mp4";
    const id = crypto.randomBytes(8).toString("hex");
    const filename = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    const url = `/api/reels/file?name=${encodeURIComponent(filename)}`;
    return NextResponse.json({ url, filename });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
