import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  const baseUrl = getBaseUrl();

  if (!orderId) {
    return NextResponse.redirect(`${baseUrl}/?payment=failed`);
  }

  const order = await prisma.paymentOrder.findUnique({
    where: { id: orderId },
  });

  if (!order) {
    return NextResponse.redirect(`${baseUrl}/?payment=failed`);
  }

  let paymentResult: string;
  switch (order.status) {
    case "APPROVED":
      paymentResult = "success";
      break;
    case "REJECTED":
      paymentResult = "failed";
      break;
    default:
      paymentResult = "pending";
  }

  return NextResponse.redirect(`${baseUrl}/?payment=${paymentResult}`);
}
