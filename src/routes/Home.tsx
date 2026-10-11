import { Link } from "@tanstack/solid-router";
import { useQuery } from "@tanstack/solid-query";
import { For } from "solid-js";
import { projectsQuery } from "../lib/api";
import { formatDate } from "../lib/format";

export function Home() {
  const projects = useQuery(() => projectsQuery);

  return (
    <section class="page">
      <h1>Research</h1>
      <p class="lede">Notes and findings on the San Juan Islands.</p>

      <For each={projects.data}>
        {(project) => (
          <article class="project">
            <h2>{project.title}</h2>
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
