import { FileTreeItem } from "../types";

/** Generate the minimal Next.js UI for a token-mint dApp */
export function genUi(projectName: string): FileTreeItem[] {
  const HOME = `
/* app/app/page.tsx */
"use client";
import MintForm from "../components/mint-form";
export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <h1 className="mb-6 text-3xl font-bold">${projectName}</h1>
      <MintForm />
    </main>
  );
}`.trimStart();

  const MINT_FORM = `
"use client";
import { useState } from "react";
export default function MintForm() {
  const [dest, setDest] = useState("");
  const [amount, setAmount] = useState("");
  return (
    <form
      onSubmit={e => { e.preventDefault(); /* TODO: call mint ix */ }}
      className="flex flex-col gap-3 w-[340px]"
    >
      <input value={dest} onChange={e=>setDest(e.target.value)} placeholder="Destination address"
        className="border rounded p-2 text-sm" required/>
      <input value={amount} onChange={e=>setAmount(e.target.value)} placeholder="Amount"
        className="border rounded p-2 text-sm" required/>
      <button className="rounded bg-black text-white py-2">Mint</button>
    </form>
  );
}`.trimStart();

  return [
    { name: "app", type: "directory", path: "app", children: [
      { name: "app", type: "directory", path: "app/app", children: [
        { name: "page.tsx", type: "file", path: "app/app/page.tsx", code: HOME }
      ]},
      { name: "components", type: "directory", path: "app/components", children: [
        { name: "mint-form.tsx", type: "file", path: "app/components/mint-form.tsx", code: MINT_FORM }
      ]}
    ]}
  ] satisfies FileTreeItem[];
}