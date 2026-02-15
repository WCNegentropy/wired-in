import type { ContentItem, Platform, Tile } from '../types';

function randomId() {
  return Math.random().toString(36).substring(2, 10);
}

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString();
}

const redditPosts: ContentItem[] = [
  {
    id: randomId(), platform: 'reddit', contentType: 'post',
    title: 'Linux 6.9 released with major performance improvements',
    description: 'The latest kernel release includes significant scheduler updates and memory management improvements that boost performance across workloads.',
    url: 'https://reddit.com/r/technology/1', thumbnailUrl: '',
    author: 'kernel_dev', authorUrl: 'https://reddit.com/u/kernel_dev',
    score: 4892, commentCount: 347, publishedAt: hoursAgo(2), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'reddit', contentType: 'post',
    title: 'OpenAI announces GPT-5 with real-time reasoning capabilities',
    description: 'The new model demonstrates step-by-step reasoning and can solve complex multi-step problems with unprecedented accuracy.',
    url: 'https://reddit.com/r/technology/2', thumbnailUrl: '',
    author: 'ai_watcher', authorUrl: 'https://reddit.com/u/ai_watcher',
    score: 8234, commentCount: 1205, publishedAt: hoursAgo(4), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'reddit', contentType: 'post',
    title: 'EU passes landmark AI regulation bill',
    description: 'The European Union has voted to pass comprehensive AI regulation affecting all companies operating within its borders.',
    url: 'https://reddit.com/r/technology/3', thumbnailUrl: '',
    author: 'euro_tech', authorUrl: 'https://reddit.com/u/euro_tech',
    score: 3156, commentCount: 892, publishedAt: hoursAgo(6), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'reddit', contentType: 'post',
    title: 'Rust adoption in production systems hits all-time high',
    description: 'Survey shows 40% of companies now use Rust in at least one production system, up from 15% two years ago.',
    url: 'https://reddit.com/r/technology/4', thumbnailUrl: '',
    author: 'rustacean42', authorUrl: 'https://reddit.com/u/rustacean42',
    score: 2743, commentCount: 518, publishedAt: hoursAgo(8), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'reddit', contentType: 'post',
    title: 'Apple Vision Pro 2 leaks suggest major price drop',
    description: 'Supply chain reports indicate the next-generation headset will cost significantly less than the current $3,499 model.',
    url: 'https://reddit.com/r/technology/5', thumbnailUrl: '',
    author: 'leak_master', authorUrl: 'https://reddit.com/u/leak_master',
    score: 5621, commentCount: 743, publishedAt: hoursAgo(10), fetchedAt: new Date().toISOString(), metadata: {},
  },
];

const newsPosts: ContentItem[] = [
  {
    id: randomId(), platform: 'news', contentType: 'article',
    title: 'Quantum computing breakthrough enables room-temperature qubits',
    description: 'Researchers at MIT have demonstrated stable qubits operating at room temperature, potentially revolutionizing quantum computing accessibility.',
    url: 'https://news.example.com/1', thumbnailUrl: '',
    author: 'TechDaily', authorUrl: 'https://techdaily.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(1), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'news', contentType: 'article',
    title: 'Global semiconductor shortage expected to ease by Q3',
    description: 'Industry analysts project that new fabrication facilities coming online will significantly reduce chip supply constraints.',
    url: 'https://news.example.com/2', thumbnailUrl: '',
    author: 'Bloomberg Tech', authorUrl: 'https://bloomberg.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(3), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'news', contentType: 'article',
    title: 'SpaceX Starship completes first orbital cargo delivery',
    description: 'The massive rocket successfully delivered a commercial satellite payload to orbit, marking a milestone in reusable launch vehicles.',
    url: 'https://news.example.com/3', thumbnailUrl: '',
    author: 'Space News', authorUrl: 'https://spacenews.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(5), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'news', contentType: 'article',
    title: 'New battery technology promises 1000-mile EV range',
    description: 'Solid-state battery startup demonstrates prototype cells with 5x energy density of current lithium-ion batteries.',
    url: 'https://news.example.com/4', thumbnailUrl: '',
    author: 'EV Weekly', authorUrl: 'https://evweekly.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(7), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'news', contentType: 'article',
    title: 'Major tech companies pledge carbon neutrality by 2028',
    description: 'A coalition of 50 leading technology companies have signed a joint commitment to achieve carbon-neutral operations within three years.',
    url: 'https://news.example.com/5', thumbnailUrl: '',
    author: 'Reuters Tech', authorUrl: 'https://reuters.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(9), fetchedAt: new Date().toISOString(), metadata: {},
  },
];

const youtubePosts: ContentItem[] = [
  {
    id: randomId(), platform: 'youtube', contentType: 'video',
    title: 'Building a Full-Stack App with React Server Components',
    description: 'Complete walkthrough of building a production-ready application using the latest React Server Components patterns.',
    url: 'https://youtube.com/watch?v=abc1', thumbnailUrl: 'https://picsum.photos/seed/yt1/320/180',
    author: 'Fireship', authorUrl: 'https://youtube.com/@fireship',
    score: 145000, commentCount: 2340, publishedAt: hoursAgo(12), fetchedAt: new Date().toISOString(), metadata: { views: 145000 },
  },
  {
    id: randomId(), platform: 'youtube', contentType: 'video',
    title: 'Rust vs Go in 2025 - Which Should You Learn?',
    description: 'An in-depth comparison of Rust and Go for systems programming, web backends, and CLI tools.',
    url: 'https://youtube.com/watch?v=abc2', thumbnailUrl: 'https://picsum.photos/seed/yt2/320/180',
    author: 'ThePrimeagen', authorUrl: 'https://youtube.com/@theprimeagen',
    score: 89000, commentCount: 1876, publishedAt: hoursAgo(24), fetchedAt: new Date().toISOString(), metadata: { views: 89000 },
  },
  {
    id: randomId(), platform: 'youtube', contentType: 'video',
    title: 'Understanding Transformers - The Architecture Behind LLMs',
    description: 'Visual explanation of the transformer architecture that powers modern large language models.',
    url: 'https://youtube.com/watch?v=abc3', thumbnailUrl: 'https://picsum.photos/seed/yt3/320/180',
    author: '3Blue1Brown', authorUrl: 'https://youtube.com/@3blue1brown',
    score: 567000, commentCount: 4521, publishedAt: hoursAgo(48), fetchedAt: new Date().toISOString(), metadata: { views: 567000 },
  },
  {
    id: randomId(), platform: 'youtube', contentType: 'video',
    title: 'Docker in 100 Seconds',
    description: 'A fast-paced overview of Docker containerization and how it simplifies application deployment.',
    url: 'https://youtube.com/watch?v=abc4', thumbnailUrl: 'https://picsum.photos/seed/yt4/320/180',
    author: 'Fireship', authorUrl: 'https://youtube.com/@fireship',
    score: 234000, commentCount: 987, publishedAt: hoursAgo(72), fetchedAt: new Date().toISOString(), metadata: { views: 234000 },
  },
];

const xPosts: ContentItem[] = [
  {
    id: randomId(), platform: 'x', contentType: 'post',
    title: 'Just shipped our new distributed database engine. 10x faster writes, 5x faster reads. Open source soon.',
    description: '', url: 'https://x.com/status/1', thumbnailUrl: '',
    author: '@techfounder', authorUrl: 'https://x.com/techfounder',
    score: 12400, commentCount: 342, publishedAt: hoursAgo(1), fetchedAt: new Date().toISOString(), metadata: { retweets: 3200 },
  },
  {
    id: randomId(), platform: 'x', contentType: 'post',
    title: 'Hot take: TypeScript has become more important than JavaScript. The ecosystem has fully shifted.',
    description: '', url: 'https://x.com/status/2', thumbnailUrl: '',
    author: '@webdev_sarah', authorUrl: 'https://x.com/webdev_sarah',
    score: 8900, commentCount: 1205, publishedAt: hoursAgo(3), fetchedAt: new Date().toISOString(), metadata: { retweets: 2100 },
  },
  {
    id: randomId(), platform: 'x', contentType: 'post',
    title: 'Excited to announce that our team just crossed 1M users. What a journey from a weekend hackathon project.',
    description: '', url: 'https://x.com/status/3', thumbnailUrl: '',
    author: '@indie_hacker', authorUrl: 'https://x.com/indie_hacker',
    score: 24300, commentCount: 567, publishedAt: hoursAgo(5), fetchedAt: new Date().toISOString(), metadata: { retweets: 5800 },
  },
];

const rssPosts: ContentItem[] = [
  {
    id: randomId(), platform: 'rss', contentType: 'article',
    title: 'A Deep Dive into WebAssembly Component Model',
    description: 'Exploring the new component model that enables cross-language interoperability in WebAssembly applications.',
    url: 'https://blog.example.com/wasm', thumbnailUrl: '',
    author: 'Bytecode Alliance Blog', authorUrl: 'https://blog.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(6), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'rss', contentType: 'article',
    title: 'PostgreSQL 17: What Developers Need to Know',
    description: 'A comprehensive overview of new features, performance improvements, and migration considerations.',
    url: 'https://blog.example.com/pg17', thumbnailUrl: '',
    author: 'Database Weekly', authorUrl: 'https://dbweekly.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(12), fetchedAt: new Date().toISOString(), metadata: {},
  },
  {
    id: randomId(), platform: 'rss', contentType: 'article',
    title: 'The State of CSS in 2025',
    description: 'Survey results reveal adoption trends for container queries, cascade layers, and the new color spaces.',
    url: 'https://blog.example.com/css2025', thumbnailUrl: '',
    author: 'CSS Tricks', authorUrl: 'https://css-tricks.example.com',
    score: undefined, commentCount: undefined, publishedAt: hoursAgo(18), fetchedAt: new Date().toISOString(), metadata: {},
  },
];

const mockDataMap: Record<Platform, ContentItem[]> = {
  reddit: redditPosts,
  news: newsPosts,
  youtube: youtubePosts,
  x: xPosts,
  rss: rssPosts,
};

export function getMockContent(tile: Tile): ContentItem[] {
  const items = mockDataMap[tile.platform] ?? [];
  const max = tile.config.maxItems ?? 10;
  return items.slice(0, max);
}
