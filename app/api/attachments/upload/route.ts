import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { Buffer } from "node:buffer";
import {
  getServiceSupabaseClient,
  getServerSupabaseClient,
} from "@/lib/supabaseServer";
import { DEMO_ROOM_ID } from "@/lib/chatTypes";

const BUCKET_NAME = "message-attachments";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  const roomId = formData.get("roomId");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing file in request." },
      { status: 400 }
    );
  }

  if (typeof roomId !== "string" || roomId.length === 0) {
    return NextResponse.json(
      { error: "Missing room identifier for attachment." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5 MB)" },
      { status: 413 }
    );
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "รองรับเฉพาะไฟล์ภาพ PNG, JPG, GIF หรือ WebP เท่านั้น" },
      { status: 415 }
    );
  }

  try {
    const supabaseServer = await getServerSupabaseClient();
    const { data: userResult } = await supabaseServer.auth.getUser();
    const user = userResult.user;

    if (!user) {
      return NextResponse.json(
        { error: "กรุณาเข้าสู่ระบบก่อนแนบไฟล์" },
        { status: 401 }
      );
    }

    if (roomId !== DEMO_ROOM_ID) {
      const { data: membership } = await supabaseServer
        .from("room_members")
        .select("id")
        .eq("room_id", roomId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!membership) {
        return NextResponse.json(
          { error: "คุณไม่มีสิทธิ์อัปโหลดไฟล์ในห้องนี้" },
          { status: 403 }
        );
      }
    }

    const supabase = getServiceSupabaseClient();

    const { error: createBucketError } = await supabase.storage.createBucket(
      BUCKET_NAME,
      {
        public: true,
        fileSizeLimit: `${MAX_FILE_SIZE}`,
        allowedMimeTypes: ALLOWED_TYPES,
      }
    );

    if (
      createBucketError &&
      !createBucketError.message?.toLowerCase().includes("already exists")
    ) {
      if (!createBucketError.message?.toLowerCase().includes("bucket")) {
        console.warn("Attachment bucket creation warning", createBucketError);
      }
      return NextResponse.json(
        { error: createBucketError.message },
        { status: 500 }
      );
    }

    const extension = file.name.split(".").pop() ?? "bin";
    const fileName = `${roomId}/${randomUUID()}.${extension}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let uploadResult = await supabase.storage.from(BUCKET_NAME).upload(fileName, fileBuffer, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type,
    });

    if (uploadResult.error) {
      const msg = uploadResult.error.message?.toLowerCase() ?? "";
      if (msg.includes("bucket") || msg.includes("not found")) {
        const retryCreate = await supabase.storage.createBucket(BUCKET_NAME, {
          public: true,
          fileSizeLimit: `${MAX_FILE_SIZE}`,
          allowedMimeTypes: ALLOWED_TYPES,
        });
        if (
          retryCreate.error &&
          !retryCreate.error.message?.toLowerCase().includes("already exists")
        ) {
          return NextResponse.json(
            { error: retryCreate.error.message },
            { status: 500 }
          );
        }

        uploadResult = await supabase.storage.from(BUCKET_NAME).upload(fileName, fileBuffer, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      }

      if (uploadResult.error) {
        return NextResponse.json(
          { error: uploadResult.error.message },
          { status: 500 }
        );
      }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return NextResponse.json({
      url: publicUrl,
      name: file.name,
      type: file.type,
      size: file.size,
      path: fileName,
    });
  } catch (error) {
    console.error("Attachment upload failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "ไม่สามารถอัปโหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง",
      },
      { status: 500 }
    );
  }
}
