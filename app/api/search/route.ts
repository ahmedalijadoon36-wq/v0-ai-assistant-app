import { NextResponse } from "next/server"

interface SerpApiResult {
  organic_results?: Array<{
    title: string
    snippet: string
    link: string
  }>
}

export async function POST(req: Request) {
  const { query } = await req.json()

  if (!query) {
    return NextResponse.json({ error: "Query is required" }, { status: 400 })
  }

  const apiKey = process.env.SERPAPI_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: "SerpAPI key not configured" },
      { status: 500 }
    )
  }

  try {
    const searchUrl = new URL("https://serpapi.com/search.json")
    searchUrl.searchParams.set("q", query)
    searchUrl.searchParams.set("api_key", apiKey)
    searchUrl.searchParams.set("engine", "google")
    searchUrl.searchParams.set("num", "5")

    const response = await fetch(searchUrl.toString())
    const data: SerpApiResult = await response.json()

    if (!response.ok) {
      throw new Error("SerpAPI request failed")
    }

    const results = data.organic_results?.map((result) => ({
      title: result.title,
      snippet: result.snippet,
      link: result.link,
    })) || []

    return NextResponse.json({ results })
  } catch (error) {
    console.error("Search error:", error)
    return NextResponse.json(
      { error: "Failed to perform search" },
      { status: 500 }
    )
  }
}
