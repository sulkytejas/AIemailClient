// src/app/api/clerk/webhook/route.ts
import { db } from "@/server/db";

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    console.log("Webhook received:", payload);

    // Check if this is a webhook event structure or direct user data
    // Clerk can send data in different formats
    let userData;
    let eventType;

    if (payload.type && payload.data) {
      // Event wrapper format: { type: "user.created", data: {...} }
      eventType = payload.type;
      userData = payload.data;
    } else if (payload.object === "user") {
      // Direct user object format
      eventType = "user.created";
      userData = payload;
    } else {
      console.log("Unknown webhook format");
      return new Response("Unknown webhook format", { status: 200 });
    }

    // Only process user.created events
    if (eventType !== "user.created") {
      return new Response("Event not handled", { status: 200 });
    }

    const userToCreate = {
      id: userData.id,
      emailAddress:
        userData.email_addresses?.[0]?.email_address ||
        `${userData.id}@placeholder.com`,
      firstName: userData.first_name || "Unknown",
      lastName: userData.last_name || "User",
      imageUrl: userData.image_url || null,
    };

    console.log("Processing user:", userToCreate);

    // Use upsert to handle duplicate attempts
    const user = await db.user.upsert({
      where: {
        id: userToCreate.id,
      },
      update: {
        // Update these fields if user exists
        firstName: userToCreate.firstName,
        lastName: userToCreate.lastName,
        imageUrl: userToCreate.imageUrl,
        // Don't update emailAddress as it might cause unique constraint issues
      },
      create: userToCreate,
    });

    console.log("User processed successfully:", user.id);

    return new Response(
      JSON.stringify({
        success: true,
        userId: user.id,
        action: user ? "updated" : "created",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Webhook error:", error);

    // Handle specific Prisma errors
    if (error instanceof Error && error.message.includes("P2002")) {
      // Unique constraint error - user already exists
      console.log("User already exists, returning success");
      return new Response(
        JSON.stringify({
          success: true,
          message: "User already exists",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: errorMessage,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function GET() {
  return new Response("Method not allowed", { status: 405 });
}
