import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// This is a simple Prometheus-compatible metrics endpoint
export async function GET(req: NextRequest) {
  try {
    const proofCount = await prisma.proof.count();
    
    // In a real app, you'd use a library like prom-client to track request durations, error rates, etc.
    // Here we'll output some basic metrics in Prometheus format
    const metrics = [
      '# HELP snapproof_total_proofs The total number of proofs indexed',
      '# TYPE snapproof_total_proofs gauge',
      `snapproof_total_proofs ${proofCount}`,
      '',
      '# HELP snapproof_api_up Is the SnapProof API up',
      '# TYPE snapproof_api_up gauge',
      'snapproof_api_up 1',
    ].join('\n');

    return new NextResponse(metrics, {
      headers: {
        'Content-Type': 'text/plain; version=0.0.4',
      },
    });
  } catch (error) {
    console.error("Metrics Error:", error);
    return new NextResponse('Error fetching metrics', { status: 500 });
  }
}
