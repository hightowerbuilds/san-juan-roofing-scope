import { Link, Outlet } from "@tanstack/solid-router";

const nav = [
  { to: "/", label: "Home" },
  { to: "/areas", label: "Service area" },
] as const;

export function Layout() {
  return (
    <>
      <header class="site-header">
        <div class="wrap">
          <Link to="/" class="brand">San Juan Roofing</Link>
          <nav>
            {nav.map((item) => (
              <Link to={item.to} activeProps={{ class: "active" }} activeOptions={{ exact: true }}>{item.label}</Link>
            ))}
          </nav>
        </div>
      </header>
      <main class="wrap">
        <Outlet />
      </main>
      <footer class="site-footer">
        <div class="wrap">
          <span>San Juan Roofing · Friday Harbor, WA</span>
          <a href="tel:+13605550100">(360) 555-0100</a>
        </div>
      </footer>
    </>
  );
}

export function NotFound() {
  return (
    <section class="page">
      <h1>Page not found</h1>
      <p><Link to="/">Back home</Link></p>
    </section>
  );
}
