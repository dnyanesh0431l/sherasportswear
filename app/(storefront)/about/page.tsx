import type { Metadata } from "next";
import { PageHero } from "../_components/pages/PageHero";

export const metadata: Metadata = {
  title: "About Us — Shera Sports Wear",
  description:
    "Shera Sports Wear builds high-performance running, training and lifestyle footwear engineered in India for athletes at every level.",
};

const stats = [
  { value: "15+", label: "Years in sport" },
  { value: "1M+", label: "Athletes served" },
  { value: "120+", label: "Cities delivered" },
  { value: "4.7★", label: "Avg. customer rating" },
];

const values = [
  {
    title: "Engineered for the run",
    body: "Every sole, stitch and upper is tested across road, gym and trail conditions — so it performs when it matters.",
  },
  {
    title: "Built in India",
    body: "Designed and manufactured locally, with a supply chain we can actually stand behind.",
  },
  {
    title: "Honest pricing",
    body: "Premium materials, no inflated markups. We price for the athlete, not the shelf.",
  },
  {
    title: "Comfort that lasts",
    body: "Cushioning, breathability and durability tuned over multiple seasons of use.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About Shera"
        title="Built for the run. Made in India."
        description="We make performance footwear and gear for people who show up — on the track, in the gym, on the street. Engineered with real-world testing, priced for real athletes."
      />

      <main className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Story */}
        <section className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-neutral-950">
              Our story
            </h2>
          </div>
          <div className="space-y-4 text-[15px] leading-7 text-neutral-700">
            <p>
              Shera Sports Wear started with a simple frustration: good
              running shoes were either too expensive or simply not good enough.
              We set out to build footwear that could hold up to daily training
              without costing a month&rsquo;s salary.
            </p>
            <p>
              Today we design, test and ship performance footwear — from
              carbon-plated racers like the <strong>Columbus Victory</strong>{" "}
              and <strong>Freemove</strong>, to everyday walkers like the{" "}
              <strong>Columbus Cubic</strong> — from our base in India to
              athletes in over 120 cities.
            </p>
            <p>
              Our catalog is intentionally small. We would rather perfect six
              silhouettes than ship sixty. Every product we list has been worn
              through real kilometres by real runners before it reaches you.
            </p>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-16 grid grid-cols-2 gap-4 rounded-2xl bg-neutral-950 p-8 text-white sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-black text-[#FF6B00] sm:text-4xl">
                {s.value}
              </p>
              <p className="mt-1 text-xs uppercase tracking-widest text-white/60">
                {s.label}
              </p>
            </div>
          ))}
        </section>

        {/* Values */}
        <section className="mt-20">
          <h2 className="text-3xl font-bold tracking-tight text-neutral-950">
            What we stand for
          </h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {values.map((v) => (
              <div
                key={v.title}
                className="rounded-2xl border border-neutral-200 p-6 transition hover:border-[#FF6B00]/60 hover:shadow-sm"
              >
                <h3 className="text-lg font-semibold text-neutral-950">
                  {v.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-neutral-600">
                  {v.body}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}