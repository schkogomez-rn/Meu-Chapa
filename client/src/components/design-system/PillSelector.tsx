import React from "react";

export interface PillTab<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

interface PillSelectorProps<T extends string = string> {
  tabs: PillTab<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  size?: "sm" | "md";
}

export function PillSelector<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  size = "md",
}: PillSelectorProps<T>) {
  const isSmall = size === "sm";

  return (
    <div
      style={{
        display: "inline-flex",
        background: "rgba(22, 10, 6, 0.9)",
        border: "1px solid rgba(255, 196, 0, 0.22)",
        padding: isSmall ? "3px" : "4px",
        borderRadius: "999px",
        gap: "4px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
        overflowX: "auto",
        maxWidth: "100%",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: isSmall ? "5px" : "7px",
              border: 0,
              background: isActive ? "linear-gradient(135deg, #ffd44c, #f07b17)" : "transparent",
              color: isActive ? "#1a0b06" : "#c7b093",
              padding: isSmall ? "6px 12px" : "8px 16px",
              borderRadius: "999px",
              fontSize: isSmall ? "11px" : "12px",
              fontWeight: isActive ? 800 : 700,
              boxShadow: isActive ? "0 2px 10px rgba(240, 123, 23, 0.4)" : "none",
              cursor: "pointer",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap",
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span
                style={{
                  background: isActive ? "rgba(26, 11, 6, 0.3)" : "rgba(255, 255, 255, 0.12)",
                  color: isActive ? "#1a0b06" : "#ffd44c",
                  borderRadius: "999px",
                  padding: "1px 6px",
                  fontSize: "10px",
                  fontWeight: 800,
                  marginLeft: "2px",
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
