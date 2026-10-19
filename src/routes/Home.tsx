import { Link } from "@tanstack/solid-router";
import { useQuery } from "@tanstack/solid-query";
import { For } from "solid-js";
import { challengesQuery, projectsQuery } from "../lib/api";
import { formatDate } from "../lib/format";

export function Home() {
  const challenges = useQuery(() => challengesQuery);
  const projects = useQuery(() => projectsQuery);

  return (
    <section class="page">
      <h1>Challenges</h1>
      <p class="lede">
        Three typical roofing jobs on the islands, each written as step-by-step instructions so every step can be priced.
      </p>

      <ol class="challenge-list">
        <For each={challenges.data}>
          {(c) => (
            <li>
              <p class="eyebrow">
                Challenge {c.number} · {c.place}, {c.island}
              </p>
              <Link to="/challenges/$challengeId" params={{ challengeId: c.id }}>
                {c.title}
              </Link>
              <p>{c.summary}</p>
            </li>
          )}
        </For>
      </ol>

      <h2>Research</h2>
      <For each={projects.data}>
        {(project) => (
          <article class="project">
            <h3>{project.title}</h3>
            <p class="muted">{project.summary}</p>
            <ul class="post-list">
              <For each={project.posts}>
                {(post) => (
                  <li>
                    <Link to="/research/$projectId/$postId" params={{ projectId: project.id, postId: post.id }}>
                      {post.title}
                    </Link>
                    <p>{post.summary}</p>
                    <time datetime={post.date}>{formatDate(post.date)}</time>
                  </li>
                )}
              </For>
            </ul>
          </article>
        )}
      </For>
    </section>
  );
}
