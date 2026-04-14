import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const FISH_AUDIO_TTS_URL = 'https://api.fish.audio/v1/tts';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.FISH_AUDIO_API_KEY;
    const voiceId = process.env.FISH_AUDIO_VOICE_ID;

    if (!apiKey || !voiceId) {
      return NextResponse.json({ error: 'TTS not configured' }, { status: 503 });
    }

    const { text } = await request.json();
    if (!text || typeof text !== 'string' || text.length > 500) {
      return NextResponse.json({ error: 'Invalid text' }, { status: 400 });
    }

    const res = await fetch(FISH_AUDIO_TTS_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'model': 's2-pro',
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3',
        temperature: 0.8,
        top_p: 0.8,
      }),
    });

    if (!res.ok) {
      console.error('[TTS] Fish Audio error:', res.status, await res.text());
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
