import { StarIcon } from "lucide-react";
import { GITHUB_URL } from "@/components/marketing/constants";
import { formatGithubStars } from "@/lib/github-stars";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function GithubStarsButton({
  className,
  stars,
}: {
  readonly className?: string;
  readonly stars: number | null;
}) {
  const label =
    stars === null ? "Star on GitHub" : `${formatGithubStars(stars)} on GitHub`;

  return (
    <Button
      asChild
      className={cn("rounded-full", className)}
      size="sm"
      variant="outline"
    >
      <a
        aria-label={label}
        href={GITHUB_URL}
        rel="noreferrer"
        target="_blank"
      >
        <StarIcon aria-hidden className="size-3.5 fill-current" />
        {stars === null ? (
          <span>Star</span>
        ) : (
          <span className="tabular-nums">{formatGithubStars(stars)}</span>
        )}
      </a>
    </Button>
  );
}
