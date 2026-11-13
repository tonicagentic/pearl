"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createProjectChatAction,
  deleteProjectAction,
  linkProjectPinAction,
  savePlanAction,
  unlinkProjectPinAction,
  updateProjectAction,
} from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ProjectProps = {
  readonly id: string;
  readonly name: string;
  readonly instructions: string;
};

type PlanProps = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly updatedAt: string;
};

type ChatProps = {
  readonly id: string;
  readonly title: string;
  readonly updatedAt: string;
};

type PinProps = {
  readonly id: string;
  readonly fullName: string;
  readonly vercelProjectId: string | null;
};

export function ProjectWorkspace({
  project,
  plans,
  chats,
  pins,
}: {
  readonly project: ProjectProps;
  readonly plans: readonly PlanProps[];
  readonly chats: readonly ChatProps[];
  readonly pins: readonly PinProps[];
}) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [instructions, setInstructions] = useState(project.instructions);
  const [planTitle, setPlanTitle] = useState("");
  const [repoFullName, setRepoFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-lg border bg-card p-3">
        <h1 className="text-lg font-semibold">Project</h1>
        <Input
          maxLength={120}
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <Textarea
          className="min-h-28"
          maxLength={20_000}
          onChange={(event) => setInstructions(event.target.value)}
          placeholder="Instructions for every chat in this project"
          value={instructions}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={pending || !name.trim()}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await updateProjectAction({
                    projectId: project.id,
                    name,
                    instructions,
                  });
                  router.refresh();
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not save the project.",
                  );
                }
              });
            }}
            size="sm"
            type="button"
          >
            Save
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  const chat = await createProjectChatAction({
                    projectId: project.id,
                  });
                  router.push(`/chat/${chat.id}`);
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not start a chat.",
                  );
                }
              });
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            New chat
          </Button>
          <Button
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`Delete project “${project.name}”?`)) return;
              setError(null);
              startTransition(async () => {
                try {
                  await deleteProjectAction({ projectId: project.id });
                  router.push("/projects");
                  router.refresh();
                } catch (cause) {
                  setError(
                    cause instanceof Error
                      ? cause.message
                      : "Could not delete the project.",
                  );
                }
              });
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Delete
          </Button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Repos</h2>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const trimmed = repoFullName.trim();
            const [owner, repoName] = trimmed.split("/");
            if (!owner || !repoName) {
              setError("Use owner/name, e.g. vercel/next.js");
              return;
            }
            setError(null);
            startTransition(async () => {
              try {
                await linkProjectPinAction({
                  projectId: project.id,
                  owner: owner.trim(),
                  name: repoName.trim(),
                  fullName: trimmed,
                });
                setRepoFullName("");
                router.refresh();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not link the repo.",
                );
              }
            });
          }}
        >
          <Input
            className="max-w-xs"
            onChange={(event) => setRepoFullName(event.target.value)}
            placeholder="owner/name"
            required
            value={repoFullName}
          />
          <Button
            disabled={pending || !repoFullName.trim()}
            size="sm"
            type="submit"
          >
            Link repo
          </Button>
        </form>
        {pins.length === 0 ? (
          <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
            No repos linked yet. Link a GitHub repo to make this project the
            coding workspace.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {pins.map((pin) => (
              <li
                className="flex items-center justify-between gap-3 px-3 py-3"
                key={pin.id}
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {pin.fullName}
                  </div>
                  {pin.vercelProjectId ? (
                    <div className="truncate text-xs text-muted-foreground">
                      Vercel linked
                    </div>
                  ) : null}
                </div>
                <Button
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      try {
                        await unlinkProjectPinAction({
                          projectId: project.id,
                          pinId: pin.id,
                        });
                        router.refresh();
                      } catch (cause) {
                        setError(
                          cause instanceof Error
                            ? cause.message
                            : "Could not unlink the repo.",
                        );
                      }
                    });
                  }}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Unlink
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Plans</h2>
        </div>
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setError(null);
            startTransition(async () => {
              try {
                const row = await savePlanAction({
                  projectId: project.id,
                  title: planTitle,
                  markdown: `# ${planTitle.trim()}\n\n`,
                });
                setPlanTitle("");
                router.push(`/projects/${project.id}/plans/${row.id}`);
                router.refresh();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Could not create the plan.",
                );
              }
            });
          }}
        >
          <Input
            className="max-w-xs"
            maxLength={200}
            onChange={(event) => setPlanTitle(event.target.value)}
            placeholder="New plan title"
            required
            value={planTitle}
          />
          <Button disabled={pending || !planTitle.trim()} size="sm" type="submit">
            New plan
          </Button>
        </form>
        {plans.length === 0 ? (
          <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
            No plans yet. Create one here, or ask Pearl in Plan mode.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {plans.map((row) => (
              <li key={row.id}>
                <Link
                  className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-muted/40"
                  href={`/projects/${project.id}/plans/${row.id}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {row.title}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.slug}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">Chats</h2>
        {chats.length === 0 ? (
          <p className="rounded-lg border bg-card px-3 py-4 text-sm text-muted-foreground">
            No chats in this project yet.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {chats.map((row) => (
              <li key={row.id}>
                <Link
                  className="flex items-center justify-between gap-3 px-3 py-3 hover:bg-muted/40"
                  href={`/chat/${row.id}`}
                >
                  <div className="truncate text-sm font-medium">{row.title}</div>
                  <span className="text-xs text-muted-foreground">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
