import React from "react";
import {
  ResponsiveContainer,
  ScatterChart,
  XAxis,
  YAxis,
  Tooltip,
  Scatter,
  ReferenceLine,
  LabelList,
} from "recharts";
import type { ShadowTimelineEvent } from "~/lib/iam/time-to-shadow-timeline";

interface TimelineChartProps {
  events: ShadowTimelineEvent[];
}

const severityColor = {
  critical: "#ef4444",
  high: "#f59e42",
  medium: "#eab308",
  low: "#22c55e",
};

const formatDate = (date: Date | string) => {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  return dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default function TimelineChart({ events }: TimelineChartProps) {
  if (!events || events.length === 0) return null;
  const sorted = events.slice().sort((a, b) => {
    const dateA = typeof a.estimatedDate === "string" ? new Date(a.estimatedDate) : a.estimatedDate;
    const dateB = typeof b.estimatedDate === "string" ? new Date(b.estimatedDate) : b.estimatedDate;
    return dateA.getTime() - dateB.getTime();
  });
  const data = sorted.map((e, i) => ({
    ...e,
    x: typeof e.estimatedDate === "string" ? new Date(e.estimatedDate).getTime() : e.estimatedDate.getTime(),
    y: 1,
    color: severityColor[e.severity],
  }));
  const minX = Math.min(...data.map((d) => d.x));
  const maxX = Math.max(...data.map((d) => d.x));
  const today = new Date().getTime();

  return (
    <div className="w-full h-48 bg-transparent">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 30, right: 30, left: 30, bottom: 30 }}>
          <XAxis
            type="number"
            dataKey="x"
            domain={[minX, maxX]}
            tickFormatter={(unixTime) => formatDate(new Date(unixTime))}
            axisLine={{ stroke: "#374151" }}
            tick={{ fill: "#cbd5e1", fontSize: 12 }}
          />
          <YAxis type="number" dataKey="y" hide domain={[0, 2]} />
          {/* Today marker */}
          {today >= minX && today <= maxX && (
            <ReferenceLine x={today} stroke="#60a5fa" strokeDasharray="3 3" label={{ value: "Today", position: "top", fill: "#60a5fa", fontSize: 12, offset: 10 }} />
          )}
          <Tooltip
            cursor={{ stroke: "#64748b", strokeWidth: 1 }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-gray-900 text-white rounded-lg px-3 py-2 shadow-lg text-xs">
                  <div className="font-semibold mb-1">{d.entityName}</div>
                  <div>Date: {formatDate(d.estimatedDate)}</div>
                  <div>Severity: <span style={{ color: d.color }}>{d.severity}</span></div>
                  <div>Provider: {d.provider}</div>
                  <div>Type: {d.entityType}</div>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            shape={(props) => (
              <circle
                cx={props.cx}
                cy={props.cy}
                r={10}
                fill={props.payload.color}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
          >
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
} 