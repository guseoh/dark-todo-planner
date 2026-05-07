export type FocusMusicProvider = "YOUTUBE" | "YOUTUBE_MUSIC" | "MELON" | "SPOTIFY" | "ETC";

export type FocusMusicLink = {
  id: string;
  title: string;
  url: string;
  provider?: FocusMusicProvider;
  createdAt: string;
};
