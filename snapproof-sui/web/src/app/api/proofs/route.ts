import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Simple in-memory rate limiting map for MVP (In production, use Redis)
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const RATE_LIMIT_MAX = 100; // max requests
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  if (!record || record.expiresAt < now) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  if (record.count >= RATE_LIMIT_MAX) {
    return false;
  }
  record.count++;
  return true;
}

export async function GET(req: NextRequest) {
  // 1. Rate Limiting
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        type: "https://snapproof.app/probs/rate-limit",
        title: "Too Many Requests",
        status: 429,
        detail: "You have exceeded the 100 requests per minute limit.",
      },
      { status: 429, headers: { 'Content-Type': 'application/problem+json' } }
    );
  }

  try {
    // 2. Pagination (cursor-based)
    const { searchParams } = new URL(req.url);
    const cursor = searchParams.get('cursor');
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    // Ensure limit is reasonable
    const take = Math.min(Math.max(1, limit), 50);

    const proofs = await prisma.proof.findMany({
      take: take + 1, // Fetch one extra to determine if there's a next page
      ...(cursor
        ? {
            cursor: { txDigest: cursor }, // Assuming txDigest is unique and sequential enough, or use createdAt
            skip: 1, // Skip the cursor itself
          }
        : {}),
      orderBy: {
        createdAt: 'desc',
      },
    });

    let nextCursor: string | null = null;
    if (proofs.length > take) {
      const nextItem = proofs.pop(); // Remove the extra item
      nextCursor = nextItem!.txDigest;
    }

    return NextResponse.json({
      data: proofs,
      pagination: {
        nextCursor,
        hasMore: nextCursor !== null,
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    // Standard RFC 7807 Error Response
    return NextResponse.json(
      {
        type: "https://snapproof.app/probs/internal-error",
        title: "Internal Server Error",
        status: 500,
        detail: "An unexpected error occurred while fetching proofs from the indexer.",
      },
      { status: 500, headers: { 'Content-Type': 'application/problem+json' } }
    );
  }
}
