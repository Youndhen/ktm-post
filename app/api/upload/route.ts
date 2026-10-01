import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/get-session";
import { isStaff } from "@/lib/staff";
import { validateUpload } from "@/lib/upload-validation";
import { prisma } from "@/lib/prisma";

import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary from CLOUDINARY_URL or individual keys
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const alt = (formData.get("alt") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const check = validateUpload(file);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload directly using Cloudinary SDK
    const uploadResult: any = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "ktmpost",
          resource_type: "image",
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // Save to Media table in database
    const media = await prisma.media.create({
      data: {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        alt: alt || file.name.replace(/\.[^.]+$/, "") || null,
        width: uploadResult.width || null,
        height: uploadResult.height || null,
        format: uploadResult.format || null,
        bytes: uploadResult.bytes || null,
      },
    });

    return NextResponse.json({
      id: media.id,
      url: media.url,
      publicId: media.publicId,
      alt: media.alt,
      width: media.width,
      height: media.height,
      format: media.format,
      bytes: media.bytes,
    });
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    return NextResponse.json(
      { error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

// GET: List all media
export async function GET() {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const media = await prisma.media.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(media);
}

// DELETE: Remove media item
export async function DELETE(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isStaff(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing media ID" }, { status: 400 });
  }

  try {
    await prisma.media.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to delete media record" },
      { status: 500 }
    );
  }
}
