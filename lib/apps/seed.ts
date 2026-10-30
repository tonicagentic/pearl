/** Minimal Next.js seed checked into each new pearl-* repo. */

export type SeedFile = {
  readonly path: string;
  readonly content: string;
};

export function pearlAppSeed(args: {
  readonly title: string;
  readonly slug: string;
}): readonly SeedFile[] {
  const packageName = args.slug;
  return [
    {
      path: "package.json",
      content: `${JSON.stringify(
        {
          name: packageName,
          version: "0.1.0",
          private: true,
          scripts: {
            // Bind all interfaces so Vercel Sandbox port publish can reach Next.
            dev: "next dev --hostname 0.0.0.0 -p 3000",
            build: "next build",
            start: "next start --hostname 0.0.0.0 -p 3000",
          },
          dependencies: {
            next: "16.3.1",
            react: "19.2.8",
            "react-dom": "19.2.8",
          },
          devDependencies: {
            typescript: "5.9.3",
            "@types/node": "^22.0.0",
            "@types/react": "^19.0.0",
            "@types/react-dom": "^19.0.0",
          },
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "tsconfig.json",
      content: `${JSON.stringify(
        {
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: { "@/*": ["./*"] },
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"],
        },
        null,
        2,
      )}\n`,
    },
    {
      path: "next.config.ts",
      content: `import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
`,
    },
    {
      path: "next-env.d.ts",
      content: `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`,
    },
    {
      path: "app/layout.tsx",
      content: `import type { ReactNode } from "react";

export const metadata = {
  title: ${JSON.stringify(args.title)},
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        {children}
      </body>
    </html>
  );
}
`,
    },
    {
      path: "app/page.tsx",
      content: `export default function Home() {
  return (
    <main style={{ padding: 32, maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>${escapeJsxText(args.title)}</h1>
      <p style={{ color: "#555", lineHeight: 1.5 }}>
        Built with Pearl. Ask Pearl to change this app, then publish again.
      </p>
    </main>
  );
}
`,
    },
    {
      path: "README.md",
      content: `# ${args.title}

Mini app managed by Pearl (\`${args.slug}\`).

Edit through Pearl's builder; do not push unrelated changes to this repo.
`,
    },
    {
      path: ".gitignore",
      content: `node_modules
.next
.DS_Store
.env*
!.env.example
`,
    },
  ];
}

function escapeJsxText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

/** Prompt fragment that asks fx to materialize the seed into /workspace. */
export function seedPromptForFx(args: {
  readonly title: string;
  readonly slug: string;
}): string {
  const files = pearlAppSeed(args);
  const listing = files
    .map(
      (file) =>
        `### ${file.path}\n\`\`\`\n${file.content.replace(/```/g, "'''")}\n\`\`\``,
    )
    .join("\n\n");

  return [
    `Initialize /workspace as a Next.js mini app named "${args.title}" (repo ${args.slug}).`,
    "Write every file below under /workspace (create directories as needed).",
    "Do not put secrets in the files. After writing, run a typecheck or build if packages are installable.",
    "",
    listing,
  ].join("\n");
}
