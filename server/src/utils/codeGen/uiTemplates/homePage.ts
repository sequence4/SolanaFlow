export const homePage = `"use client";

// Entry point that loads the appropriate component dynamically
import DynamicComponentLoader from "@/components/DynamicComponentLoader";

export default function Home() {
  return <DynamicComponentLoader />;
}`;
