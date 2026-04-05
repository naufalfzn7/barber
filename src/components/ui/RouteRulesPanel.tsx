"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import {
  pageRulesByScope,
  type RuleEntry,
  type RuleScope,
} from "@/lib/pageRules";

function findRule(scope: RuleScope, pathname: string): RuleEntry | null {
  const routes = pageRulesByScope[scope];

  const sorted = routes.slice().sort((a, b) => b.path.length - a.path.length);

  for (const item of sorted) {
    if (item.path === "/") {
      if (pathname === "/") {
        return item.rule;
      }
      continue;
    }

    if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
      return item.rule;
    }
  }

  return null;
}

export function RouteRulesPanel({ scope }: { scope: RuleScope }) {
  const pathname = usePathname();

  const rule = useMemo(() => findRule(scope, pathname), [scope, pathname]);

  if (!rule) {
    return null;
  }

  return (
    <section className="mx-4 mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-4 lg:mx-6">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-600 text-xs font-bold text-white">
          i
        </span>
        <h3 className="text-sm font-semibold text-sky-900">
          Rules & Cara Pakai: {rule.title}
        </h3>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-800">
            Cara Pakai
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
            {rule.usage.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">
            Tidak Boleh
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-xs text-slate-700">
            {rule.forbidden.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>

      {rule.note ? (
        <p className="mt-3 rounded-lg border border-sky-200 bg-white px-3 py-2 text-xs text-slate-700">
          {rule.note}
        </p>
      ) : null}
    </section>
  );
}
