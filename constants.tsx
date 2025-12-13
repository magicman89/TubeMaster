

import { Channel } from "./types";

// Mock data removed - channels are now loaded from Supabase
export const MOCK_CHANNELS: Channel[] = [];

export const INITIAL_SCHEDULE = [
  { id: '1', projectId: 'p1', date: new Date(Date.now() + 86400000), title: 'Top 10 Indie Games', channelId: '1' },
  { id: '2', projectId: 'p2', date: new Date(Date.now() + 172800000), title: 'AI Gadgets Review', channelId: '2' },
];