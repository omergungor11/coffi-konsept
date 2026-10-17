import fs from "node:fs/promises";
import path from "node:path";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HomeSections from "@/components/HomeSections";
import { MenuChrome, FooterChrome, GlobalBehavior } from "@/components/SiteChrome";
import SmoothExperience from "@/components/SmoothExperience";
import DetailExperience from "@/components/DetailExperience";
import CookiePreferences from "@/components/CookiePreferences";
import pageIndex from "@/data/page-index.json";

type RouteProps = { params: Promise<{ slug?: string[] }> };
type DetailContent = { markup: string; stylesheet: string; title: string; bodyClass: string };
const routes: Record<string, { file: string; title: string; bodyClass: string }> = pageIndex;

function routeKey(slug?: string[]) {
  return (slug?.[0] === "en" ? slug.slice(1) : slug ?? []).join("/");
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const key = routeKey((await params).slug);
  return { title: routes[key]?.title ?? "Delta, coffee with heart | Delta Cafés" };
}

export function generateStaticParams() {
  return [{ slug: [] }, { slug: ["en"] }, ...Object.keys(routes).map(key => ({ slug: ["en", ...key.split("/")] }))];
}

export default async function Page({ params }: RouteProps) {
  const key = routeKey((await params).slug);
  const home = key === "";
  let detail: DetailContent | undefined;
  if (!home) {
    const route = routes[key];
    if (!route) notFound();
    detail = JSON.parse(await fs.readFile(path.join(process.cwd(), "src/data/pages", route.file), "utf8"));
  }

  return (
    <>
      {detail ? <link rel="stylesheet" href={detail.stylesheet} /> : null}
      <div id="global" className="main scroller" data-component="scroller" data-v-d2630b30="">
        <MenuChrome key={`menu-${key}`} />
        {home ? (
          <div data-component="page" data-slug="" data-name="page.home" data-v-f08e35e9="">
            <div data-component="home" data-v-15ca78d0="">
              <HomeSections />
              <FooterChrome />
            </div>
          </div>
        ) : detail ? <DetailExperience key={`detail-${key}`} markup={detail.markup} /> : null}
        <GlobalBehavior key={`global-${key}`} />
      </div>
      <SmoothExperience bodyClass={detail?.bodyClass ?? "page.home"} />
      <CookiePreferences />
    </>
  );
}
