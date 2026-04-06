import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const { text } = await req.json()

  if (!text) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 })
  }

  const apiKey = process.env.ELEVENLABS_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "ElevenLabs API key not configured" },
      { status: 500 }
    )
  }

  try {
    // Rachel - default ElevenLabs voice (available on free tier)
    const voiceId = "21m00Tcm4TlvDq8ikWAM"

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_flash_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error("ElevenLabs error:", errorText)
      throw new Error("ElevenLabs TTS request failed")
    }

    // Stream the audio response
    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    })
  } catch (error) {
    console.error("TTS error:", error)
    return NextResponse.json(
      { error: "Failed to generate speech" },
      { status: 500 }
    )
  }
}
