import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,16}$/;

export async function POST(request: NextRequest) {
  try {
    const { username } = await request.json();

    if (!username || typeof username !== 'string') {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    const trimmed = username.trim();

    if (!USERNAME_REGEX.test(trimmed)) {
      return NextResponse.json(
        { error: 'Username must be 3-16 characters, letters, numbers, and underscores only' },
        { status: 400 }
      );
    }

    // Check uniqueness (case-insensitive)
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.displayName, trimmed))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
    }

    // Create user
    const privyId = `user-${randomUUID().slice(0, 12)}`;
    const [created] = await db
      .insert(users)
      .values({
        privyId,
        displayName: trimmed,
      })
      .returning();

    return NextResponse.json({
      userId: created.privyId,
      username: created.displayName,
    });
  } catch (error) {
    console.error('Signup failed:', error);
    return NextResponse.json({ error: 'Signup failed' }, { status: 500 });
  }
}
