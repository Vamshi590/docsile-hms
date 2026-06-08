import { GeneratePanel } from "./components/GeneratePanel"
export default function GeneratePage() {
  return (
    <div className="p-6 max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Generate Post</h1>
      <GeneratePanel />
    </div>
  )
}
