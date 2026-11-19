/**
 * Shared marketing type classes. Keep hierarchy consistent across sections;
 * do not reuse these for the chat app shell.
 */
export const marketingType = {
  display:
    "text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl lg:text-6xl",
  sectionTitle: "text-3xl font-medium tracking-tight text-balance sm:text-4xl",
  body: "text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg sm:leading-relaxed",
  caption: "text-sm leading-snug tracking-tight text-muted-foreground",
} as const;
