import { NextResponse } from 'next/server'

/**
 * Catch-all route for /startup/peec-ai requests
 * This stops the constant 404 spam in the logs
 */

export async function GET() {
  return NextResponse.json({ status: 'ok', message: 'Startup route found' })
}

export async function POST() {
  return NextResponse.json({ status: 'ok', message: 'Startup route found' })
}

export async function PUT() {
  return NextResponse.json({ status: 'ok', message: 'Startup route found' })
}

export async function DELETE() {
  return NextResponse.json({ status: 'ok', message: 'Startup route found' })
}