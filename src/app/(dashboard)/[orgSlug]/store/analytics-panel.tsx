"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface AnalyticsData {
  totalViews: number;
  totalClicks: number;
  totalChats: number;
  ctr: number;
  blockClicks: { blockId: string; blockTitle: string; blockType: string; clicks: number; ctr: number }[];
  dailyViews: { day: string; views: number }[];
  socialClicks: { platform: string; clicks: number }[];
}

export function StoreAnalyticsPanel({ orgSlug }: { orgSlug: string }) {
  const t = useTranslations("store");
  const [days, setDays] = useState(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load(d: number) {
    setLoading(true);
    setError(null);
    fetch(`/api/store/analytics?orgSlug=${orgSlug}&days=${d}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) setError(json.error);
        else setData(json);
      })
      .catch(() => setError(t("analyticsLoading")))
      .finally(() => setLoading(false));
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(days); }, [orgSlug]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t("analyticsTitle")}</h3>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => { const d = parseInt(e.target.value); setDays(d); load(d); }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value={7}>{t("analyticsDays7")}</option>
            <option value={30}>{t("analyticsDays30")}</option>
          </select>
          <Button variant="outline" size="sm" onClick={() => load(days)} disabled={loading}>
            {loading ? t("analyticsLoading") : t("analyticsRefresh")}
          </Button>
        </div>
      </div>

      {!data && !loading && !error && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-6 text-center">
          <BarChart3 className="mx-auto size-10 text-blue-500/50" />
          <p className="mt-2 text-sm text-muted-foreground">{t("analyticsRefreshPrompt")}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
          {t("analyticsLoading")}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: t("pageViews"), value: data.totalViews },
              { label: t("clicks"), value: data.totalClicks },
              { label: t("avgCtr"), value: `${data.ctr}%` },
            ].map((stat) => (
              <Card key={stat.label} className="p-4 text-center">
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
              </Card>
            ))}
          </div>

          {data.dailyViews.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-sm font-medium">{t("dailyViews")}</p>
              <div className="flex items-end gap-1" style={{ height: 80 }}>
                {data.dailyViews.map((d) => {
                  const max = Math.max(...data.dailyViews.map((x) => x.views), 1);
                  const h = Math.round((d.views / max) * 100);
                  return (
                    <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-sm bg-primary/70"
                        style={{ height: `${h}%`, minHeight: d.views > 0 ? 4 : 0 }}
                        title={`${d.day}: ${d.views} views`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                <span>{data.dailyViews[0]?.day}</span>
                <span>{data.dailyViews[data.dailyViews.length - 1]?.day}</span>
              </div>
            </Card>
          )}

          {data.blockClicks.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-sm font-medium">{t("clicksByBlock")}</p>
              <div className="space-y-2">
                {data.blockClicks.map((b) => (
                  <div key={b.blockId} className="flex items-center justify-between text-sm">
                    <span className="truncate flex-1">{b.blockTitle || t("noTitle")}</span>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>{b.clicks} {t("clicks")}</span>
                      <span>{b.ctr}% CTR</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {data.socialClicks && data.socialClicks.length > 0 && (
            <Card className="p-4">
              <p className="mb-3 text-sm font-medium">{t("socialClicks")}</p>
              <div className="space-y-2">
                {data.socialClicks.map((s) => (
                  <div key={s.platform} className="flex items-center justify-between text-sm">
                    <span className="capitalize">{s.platform}</span>
                    <span className="text-muted-foreground">{s.clicks} {t("clicks")}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
