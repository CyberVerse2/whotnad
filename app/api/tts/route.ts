import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== 'string' || text.length > 500) {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }

    const res = await fetch(OPENAI_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'onyx',
        input: text,
        speed: 1.05,
        response_format: 'mp3',
      }),
    });

    if (!res.ok) {
      console.error('[TTS] OpenAI error:', res.status, await res.text());
      return NextResponse.json({ error: 'TTS generation failed' }, { status: 502 });
    }

    const audioBuffer = await res.arrayBuffer();

    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[TTS] Error:', error);
    return NextResponse.json({ error: 'TTS error' }, { status: 500 });
  }
}
