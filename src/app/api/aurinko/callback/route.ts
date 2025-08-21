import { exchangeCodeForAccessToken, getAccountDetails } from "@/lib/aurinko";
import { auth } from "@clerk/nextjs/server";
import { NextResponse, NextRequest } from "next/server";
import { waitUntil } from "@vercel/functions";

import { db } from "@/server/db";
import axios from "axios";
import { error } from "console";

export const GET = async (req: NextRequest) => {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const params = req.nextUrl.searchParams;
  const status = params.get("status");

  if (status !== "success") {
    return NextResponse.json(
      { message: "Failed to link account" },
      { status: 400 },
    );
  }

  const code = params.get("code");

  if (!code) {
    return NextResponse.json({ message: "No code provided" }, { status: 400 });
  }

  const token = await exchangeCodeForAccessToken(code);

  if (!token) {
    return NextResponse.json({ message: "Failed to exchange the token" });
  }

  const accountDetails = await getAccountDetails(token.accessToken);

  await db.account.upsert({
    where: { id: token.accountId.toString() },
    update: { token: token.accessToken },
    create: {
      id: token.accountId.toString(),
      userId,
      emailAddress: accountDetails.email,
      name: accountDetails.name,
      token: token.accessToken,
      provider: "google",
    },
  });

  waitUntil(
    axios
      .post(`${process.env.NEXT_PUBLIC_URL}/api/initial-sync`, {
        accountId: token.accountId.toString(),
        userId,
      })
      .then((response) => {
        console.log("response from account details", response.data);
      })
      .catch((error) => console.log(error)),
  );
  return NextResponse.redirect(new URL("/mail", req.url));
};
