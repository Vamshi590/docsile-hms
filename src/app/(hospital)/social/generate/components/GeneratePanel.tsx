"use client"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { AiGenerateForm } from "./AiGenerateForm"
import { ImageUploadForm } from "./ImageUploadForm"

export function GeneratePanel() {
  return (
    <Tabs defaultValue="ai">
      <TabsList>
        <TabsTrigger value="ai">AI only</TabsTrigger>
        <TabsTrigger value="image">From photos</TabsTrigger>
      </TabsList>
      <TabsContent value="ai" className="mt-4"><AiGenerateForm /></TabsContent>
      <TabsContent value="image" className="mt-4"><ImageUploadForm /></TabsContent>
    </Tabs>
  )
}
