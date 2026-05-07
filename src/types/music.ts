export type MusicProvider = "YOUTUBE" | "YOUTUBE_MUSIC" | "MELON" | "SPOTIFY" | "ETC";

export type MusicLink = {
  id: string;
  userId: string;
  title: string;
  url: string;
  provider?: MusicProvider;
  memo?: string;
  createdAt: string;
  updatedAt: string;
};

export type MusicLinkInput = {
  title: string;
  url: string;
  provider?: MusicProvider;
  memo?: string;
};
