import type { ReactNode } from "react";
import { PageHero } from "../pages/PageHero";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

type Props = {
  title: string;
  updatedAt: string;
  intro?: string;
  sections: LegalSection[];
};

export function LegalPage({ title, updatedAt, intro, sections }: Props) {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title={title}
        description={intro}
      />

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
          {/* TOC */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
              On this page
            </p>
            <nav className="space-y-1 text-sm">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block rounded-md px-3 py-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                >
                  {s.title}
                </a>
              ))}
            </nav>
            <p className="mt-6 text-xs text-neutral-500">
              Last updated: <span className="font-medium">{updatedAt}</span>
            </p>
          </aside>

          {/* Content */}
          <article className="prose-shera max-w-none text-neutral-800">
            {sections.map((s) => (
              <section key={s.id} id={s.id} className="mb-12 scroll-mt-24">
                <h2 className="mb-3 text-xl font-bold tracking-tight text-neutral-950 sm:text-2xl">
                  {s.title}
                </h2>
                <div className="space-y-3 text-[15px] leading-7 text-neutral-700">
                  {s.body}
                </div>
              </section>
            ))}

            <p className="mt-16 rounded-xl border border-neutral-200 bg-neutral-50 p-5 text-sm text-neutral-600">
              If you have any questions about this policy, email us at{" "}
              <a
                className="font-semibold text-[#FF6B00] hover:underline"
                href="mailto:support@sherasportswear.com"
              >
                support@sherasportswear.com
              </a>
              .
            </p>
          </article>
        </div>
      </div>
    </>
  );
}