import { tool } from "ai"
import { z } from "zod"

// Define all PC control tools that Friday can use
export const pcControlTools = {
  // Spotify playback control - play music
  spotifyPlay: tool({
    description: "Play music on Spotify. Use this when the user wants to play a specific song, artist, or music. This will control their actual Spotify app.",
    parameters: z.object({
      query: z.string().optional().describe("Song name, artist, or what to play (e.g., 'Shape of You by Ed Sheeran', 'jazz music', 'The Weeknd')"),
    }),
    execute: async ({ query }) => {
      return {
        action: "spotifyApi",
        apiAction: "play",
        query,
        message: query ? `Playing "${query}" on Spotify` : "Resuming Spotify playback",
      }
    },
  }),

  // Spotify pause
  spotifyPause: tool({
    description: "Pause Spotify playback. Use when the user wants to pause, stop, or halt the music.",
    parameters: z.object({}),
    execute: async () => {
      return {
        action: "spotifyApi",
        apiAction: "pause",
        message: "Pausing Spotify playback",
      }
    },
  }),

  // Spotify next track
  spotifyNext: tool({
    description: "Skip to the next track on Spotify. Use when the user wants to skip a song or play the next one.",
    parameters: z.object({}),
    execute: async () => {
      return {
        action: "spotifyApi",
        apiAction: "next",
        message: "Skipping to next track",
      }
    },
  }),

  // Spotify previous track
  spotifyPrevious: tool({
    description: "Go back to the previous track on Spotify. Use when the user wants to replay or go back to the last song.",
    parameters: z.object({}),
    execute: async () => {
      return {
        action: "spotifyApi",
        apiAction: "previous",
        message: "Going back to previous track",
      }
    },
  }),

  // Spotify volume control
  spotifyVolume: tool({
    description: "Set Spotify volume. Use when the user wants to adjust the music volume.",
    parameters: z.object({
      volume: z.number().min(0).max(100).describe("Volume level from 0 to 100"),
    }),
    execute: async ({ volume }) => {
      return {
        action: "spotifyApi",
        apiAction: "volume",
        volume,
        message: `Setting Spotify volume to ${volume}%`,
      }
    },
  }),

  // Spotify shuffle
  spotifyShuffle: tool({
    description: "Toggle shuffle mode on Spotify.",
    parameters: z.object({
      enabled: z.boolean().describe("Whether to enable or disable shuffle"),
    }),
    execute: async ({ enabled }) => {
      return {
        action: "spotifyApi",
        apiAction: "shuffle",
        state: enabled,
        message: `Turning shuffle ${enabled ? "on" : "off"}`,
      }
    },
  }),

  // Spotify search (returns results without playing)
  spotifySearch: tool({
    description: "Search for music on Spotify without playing. Use when the user wants to find or look up songs, artists, or albums.",
    parameters: z.object({
      query: z.string().describe("Search query for songs, artists, albums, or playlists"),
    }),
    execute: async ({ query }) => {
      return {
        action: "spotifyApi",
        apiAction: "search",
        query,
        message: `Searching Spotify for "${query}"`,
      }
    },
  }),

  // Open Spotify web player (fallback for when API auth is not available)
  openSpotify: tool({
    description: "Opens Spotify web player in the browser. Use as fallback when Spotify API is not connected, or when user explicitly wants to open Spotify website.",
    parameters: z.object({
      query: z.string().optional().describe("Optional search query for a song, artist, album, or playlist"),
    }),
    execute: async ({ query }) => {
      let url = "https://open.spotify.com"
      
      if (query) {
        url = `https://open.spotify.com/search/${encodeURIComponent(query)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: query 
          ? `Opening Spotify to search for "${query}"` 
          : "Opening Spotify web player",
      }
    },
  }),

  // Search Google
  searchGoogle: tool({
    description: "Searches Google for information. Use this when the user wants to look something up, search the web, or find information online.",
    parameters: z.object({
      query: z.string().describe("The search query to look up on Google"),
    }),
    execute: async ({ query }) => {
      const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`
      
      return {
        action: "openUrl",
        url,
        message: `Searching Google for "${query}"`,
      }
    },
  }),

  // Open YouTube
  openYouTube: tool({
    description: "Opens YouTube to watch or search for videos. Use this when the user wants to watch videos, search for content on YouTube, or open YouTube.",
    parameters: z.object({
      query: z.string().optional().describe("Optional search query for videos"),
      videoId: z.string().optional().describe("Optional specific video ID to play"),
    }),
    execute: async ({ query, videoId }) => {
      let url = "https://www.youtube.com"
      
      if (videoId) {
        url = `https://www.youtube.com/watch?v=${videoId}`
      } else if (query) {
        url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: query 
          ? `Opening YouTube to search for "${query}"` 
          : videoId 
            ? "Opening YouTube video"
            : "Opening YouTube",
      }
    },
  }),

  // Open a website
  openWebsite: tool({
    description: "Opens a specific website or URL. Use this when the user wants to go to a specific website, open a URL, or navigate to a webpage.",
    parameters: z.object({
      url: z.string().describe("The URL or website name to open (e.g., 'twitter.com', 'https://github.com')"),
    }),
    execute: async ({ url }) => {
      // Add https:// if not present
      let finalUrl = url
      if (!url.startsWith("http://") && !url.startsWith("https://")) {
        finalUrl = `https://${url}`
      }
      
      return {
        action: "openUrl",
        url: finalUrl,
        message: `Opening ${url}`,
      }
    },
  }),

  // Open Gmail
  openGmail: tool({
    description: "Opens Gmail to check or compose emails. Use this when the user wants to check email, send an email, or open their inbox.",
    parameters: z.object({
      compose: z.boolean().optional().describe("Whether to open the compose window"),
      to: z.string().optional().describe("Email address to send to (if composing)"),
      subject: z.string().optional().describe("Email subject (if composing)"),
    }),
    execute: async ({ compose, to, subject }) => {
      let url = "https://mail.google.com"
      
      if (compose) {
        const params = new URLSearchParams()
        if (to) params.set("to", to)
        if (subject) params.set("su", subject)
        url = `https://mail.google.com/mail/?view=cm&${params.toString()}`
      }
      
      return {
        action: "openUrl",
        url,
        message: compose ? "Opening Gmail to compose a new email" : "Opening Gmail inbox",
      }
    },
  }),

  // Open Google Calendar
  openCalendar: tool({
    description: "Opens Google Calendar to view or manage schedule. Use this when the user wants to check their calendar, schedule something, or view events.",
    parameters: z.object({
      createEvent: z.boolean().optional().describe("Whether to open the create event dialog"),
    }),
    execute: async ({ createEvent }) => {
      const url = createEvent 
        ? "https://calendar.google.com/calendar/r/eventedit"
        : "https://calendar.google.com"
      
      return {
        action: "openUrl",
        url,
        message: createEvent ? "Opening Google Calendar to create an event" : "Opening Google Calendar",
      }
    },
  }),

  // Open Google Drive
  openDrive: tool({
    description: "Opens Google Drive to access files and documents. Use this when the user wants to access their files, documents, or cloud storage.",
    parameters: z.object({
      search: z.string().optional().describe("Optional search query to find files"),
    }),
    execute: async ({ search }) => {
      let url = "https://drive.google.com"
      
      if (search) {
        url = `https://drive.google.com/drive/search?q=${encodeURIComponent(search)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: search ? `Searching Google Drive for "${search}"` : "Opening Google Drive",
      }
    },
  }),

  // Open Google Maps
  openMaps: tool({
    description: "Opens Google Maps for navigation or location search. Use this when the user wants directions, to find a place, or view a map.",
    parameters: z.object({
      query: z.string().optional().describe("Location or place to search for"),
      directions: z.object({
        from: z.string().optional().describe("Starting location"),
        to: z.string().describe("Destination"),
      }).optional().describe("Get directions from one place to another"),
    }),
    execute: async ({ query, directions }) => {
      let url = "https://www.google.com/maps"
      
      if (directions) {
        const params = new URLSearchParams()
        params.set("api", "1")
        if (directions.from) params.set("origin", directions.from)
        params.set("destination", directions.to)
        url = `https://www.google.com/maps/dir/?${params.toString()}`
      } else if (query) {
        url = `https://www.google.com/maps/search/${encodeURIComponent(query)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: directions 
          ? `Getting directions to ${directions.to}` 
          : query 
            ? `Searching Google Maps for "${query}"`
            : "Opening Google Maps",
      }
    },
  }),

  // Open Netflix
  openNetflix: tool({
    description: "Opens Netflix to watch movies and shows. Use this when the user wants to watch Netflix or stream content.",
    parameters: z.object({
      search: z.string().optional().describe("Optional search query for movies or shows"),
    }),
    execute: async ({ search }) => {
      let url = "https://www.netflix.com"
      
      if (search) {
        url = `https://www.netflix.com/search?q=${encodeURIComponent(search)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: search ? `Searching Netflix for "${search}"` : "Opening Netflix",
      }
    },
  }),

  // Open Twitter/X
  openTwitter: tool({
    description: "Opens Twitter (X) to view tweets and social media. Use this when the user wants to check Twitter, tweet, or view social media.",
    parameters: z.object({
      search: z.string().optional().describe("Optional search query or hashtag"),
      compose: z.boolean().optional().describe("Whether to open compose tweet"),
      text: z.string().optional().describe("Pre-filled tweet text"),
    }),
    execute: async ({ search, compose, text }) => {
      let url = "https://x.com"
      
      if (compose || text) {
        url = `https://x.com/intent/tweet${text ? `?text=${encodeURIComponent(text)}` : ""}`
      } else if (search) {
        url = `https://x.com/search?q=${encodeURIComponent(search)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: compose ? "Opening Twitter to compose a tweet" : search ? `Searching Twitter for "${search}"` : "Opening Twitter",
      }
    },
  }),

  // Open GitHub
  openGitHub: tool({
    description: "Opens GitHub to view repositories and code. Use this when the user wants to check GitHub, view repositories, or access code.",
    parameters: z.object({
      repo: z.string().optional().describe("Repository name (format: owner/repo)"),
      search: z.string().optional().describe("Search query for repositories"),
    }),
    execute: async ({ repo, search }) => {
      let url = "https://github.com"
      
      if (repo) {
        url = `https://github.com/${repo}`
      } else if (search) {
        url = `https://github.com/search?q=${encodeURIComponent(search)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: repo ? `Opening GitHub repository ${repo}` : search ? `Searching GitHub for "${search}"` : "Opening GitHub",
      }
    },
  }),

  // Set a timer/reminder (opens Google Timer)
  setTimer: tool({
    description: "Sets a timer or alarm. Use this when the user wants to set a timer, countdown, or alarm.",
    parameters: z.object({
      minutes: z.number().describe("Number of minutes for the timer"),
    }),
    execute: async ({ minutes }) => {
      const url = `https://www.google.com/search?q=timer+${minutes}+minutes`
      
      return {
        action: "openUrl",
        url,
        message: `Setting a ${minutes} minute timer`,
      }
    },
  }),

  // Weather lookup
  getWeather: tool({
    description: "Gets weather information for a location. Use this when the user asks about weather.",
    parameters: z.object({
      location: z.string().describe("The city or location to get weather for"),
    }),
    execute: async ({ location }) => {
      const url = `https://www.google.com/search?q=weather+${encodeURIComponent(location)}`
      
      return {
        action: "openUrl",
        url,
        message: `Checking weather for ${location}`,
      }
    },
  }),

  // Calculator
  openCalculator: tool({
    description: "Opens a calculator or performs calculations. Use this when the user wants to calculate something.",
    parameters: z.object({
      expression: z.string().optional().describe("Math expression to calculate"),
    }),
    execute: async ({ expression }) => {
      const url = expression 
        ? `https://www.google.com/search?q=${encodeURIComponent(expression)}`
        : "https://www.google.com/search?q=calculator"
      
      return {
        action: "openUrl",
        url,
        message: expression ? `Calculating ${expression}` : "Opening calculator",
      }
    },
  }),

  // Translate
  translate: tool({
    description: "Translates text between languages. Use this when the user wants to translate something.",
    parameters: z.object({
      text: z.string().describe("Text to translate"),
      targetLanguage: z.string().optional().describe("Target language (e.g., 'spanish', 'french')"),
    }),
    execute: async ({ text, targetLanguage }) => {
      const query = targetLanguage 
        ? `translate "${text}" to ${targetLanguage}`
        : `translate "${text}"`
      const url = `https://translate.google.com/?sl=auto&tl=${targetLanguage || "en"}&text=${encodeURIComponent(text)}`
      
      return {
        action: "openUrl",
        url,
        message: `Translating "${text}"${targetLanguage ? ` to ${targetLanguage}` : ""}`,
      }
    },
  }),

  // Open ChatGPT
  openChatGPT: tool({
    description: "Opens ChatGPT for AI assistance. Use this when the user wants to use ChatGPT specifically.",
    parameters: z.object({}),
    execute: async () => {
      return {
        action: "openUrl",
        url: "https://chat.openai.com",
        message: "Opening ChatGPT",
      }
    },
  }),

  // Open Amazon
  openAmazon: tool({
    description: "Opens Amazon for shopping. Use this when the user wants to shop online or find products.",
    parameters: z.object({
      search: z.string().optional().describe("Product search query"),
    }),
    execute: async ({ search }) => {
      let url = "https://www.amazon.com"
      
      if (search) {
        url = `https://www.amazon.com/s?k=${encodeURIComponent(search)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: search ? `Searching Amazon for "${search}"` : "Opening Amazon",
      }
    },
  }),

  // Open LinkedIn
  openLinkedIn: tool({
    description: "Opens LinkedIn for professional networking. Use this when the user wants to check LinkedIn or network professionally.",
    parameters: z.object({
      search: z.string().optional().describe("Search query for people or jobs"),
    }),
    execute: async ({ search }) => {
      let url = "https://www.linkedin.com"
      
      if (search) {
        url = `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(search)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: search ? `Searching LinkedIn for "${search}"` : "Opening LinkedIn",
      }
    },
  }),

  // Open Reddit
  openReddit: tool({
    description: "Opens Reddit to browse communities and discussions. Use this when the user wants to browse Reddit or find communities.",
    parameters: z.object({
      subreddit: z.string().optional().describe("Specific subreddit to open (without r/)"),
      search: z.string().optional().describe("Search query"),
    }),
    execute: async ({ subreddit, search }) => {
      let url = "https://www.reddit.com"
      
      if (subreddit) {
        url = `https://www.reddit.com/r/${subreddit}`
      } else if (search) {
        url = `https://www.reddit.com/search/?q=${encodeURIComponent(search)}`
      }
      
      return {
        action: "openUrl",
        url,
        message: subreddit ? `Opening r/${subreddit}` : search ? `Searching Reddit for "${search}"` : "Opening Reddit",
      }
    },
  }),
}

// Type for action results
export type PCAction = {
  action: "openUrl" | "notification"
  url?: string
  message: string
}
