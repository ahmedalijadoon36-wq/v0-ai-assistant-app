"use client"

import { useSpotify } from "@/hooks/use-spotify"
import { Button } from "@/components/ui/button"
import { Play, Pause, SkipBack, SkipForward, Music2, Wifi, WifiOff } from "lucide-react"

export function SpotifyPlayer() {
  const {
    connected,
    playing,
    track,
    device,
    noDevice,
    loading,
    error,
    play,
    pause,
    next,
    previous,
    connect,
    disconnect,
  } = useSpotify()

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary/30 border border-border">
        <Music2 className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span className="text-xs text-muted-foreground">Loading Spotify...</span>
      </div>
    )
  }

  if (!connected) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={connect}
        className="gap-2 border-green-500/30 text-green-500 hover:bg-green-500/10 hover:text-green-400"
      >
        <Music2 className="h-4 w-4" />
        Connect Spotify
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3 rounded-lg bg-secondary/30 border border-border min-w-[280px]">
      {/* Connection status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-xs text-muted-foreground">
            {device || "Spotify Connected"}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
        >
          <WifiOff className="h-3 w-3" />
        </Button>
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* No device warning */}
      {noDevice && !track && (
        <p className="text-xs text-amber-500">
          Open Spotify on a device to play music
        </p>
      )}

      {/* Now playing */}
      {track && (
        <div className="flex items-center gap-3">
          {track.albumArt && (
            <img
              src={track.albumArt}
              alt={track.album}
              className="h-12 w-12 rounded object-cover"
            />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {track.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {track.artist}
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={previous}
          className="h-8 w-8 p-0"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => (playing ? pause() : play())}
          className="h-10 w-10 p-0 rounded-full"
        >
          {playing ? (
            <Pause className="h-4 w-4" />
          ) : (
            <Play className="h-4 w-4 ml-0.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={next}
          className="h-8 w-8 p-0"
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
